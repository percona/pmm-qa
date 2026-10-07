#!/usr/bin/env bash
# package-test-cell.sh
#
# Runs one cell of pmm3-package-tests-matrix.yml: a systemd client container and
# a PMM Server on this runner, then one playbook inside the client. A failed
# attempt is retried from scratch, with both containers and the server's data
# recreated: a playbook cannot simply be run again where it failed, because its
# first attempt has already changed the MySQL root password and registered its
# services with PMM Server. The run is then judged on its final attempt, so
# whatever waits on it never sees a failure that a retry went on to clear.
#
# Environment (all required):
#   CLIENT_IMAGE SERVER_IMAGE    pulled beforehand
#   OS ARCH TEST                 the matrix cell
#   ATTEMPTS                     attempts in total, 1 meaning no retry
#   ADMIN_PASSWORD INSTALL_REPO METRICS_MODE PMM_VERSION
#   TARBALL_AMD64 TARBALL_ARM64
#
# Writes attempts.txt with the number of attempts used and, for each failed
# attempt n, ansible-<n>.log, diagnostics-<n>.log and pmm-summary-<n>.zip.

set -uo pipefail

QA_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
[[ "$ATTEMPTS" =~ ^[1-9]$ ]] || { echo "ATTEMPTS must be a number from 1 to 9, not '${ATTEMPTS}'"; exit 1; }

# Chosen here rather than with && || in a workflow expression, which would hand
# an arm64 cell the amd64 tarball whenever TARBALL_ARM64 is empty.
if [ "$ARCH" = arm64 ]; then TARBALL_LINK="$TARBALL_ARM64"; else TARBALL_LINK="$TARBALL_AMD64"; fi

start_client() {
  # Hardened units (valkey-server, mysqlrouter, valkey@default) need a private
  # mount namespace, and CAP_SYS_ADMIN on its own is not enough. Keep this list
  # in sync with privileged: in build-package-test-images.yml.
  #
  # ol8 and ol9 are deliberately left out: privileged, sudo stops working inside
  # the container ("PAM account management error: Authentication service cannot
  # retrieve authentication info") and the play dies at Change Postgresql Password.
  local needs_privileged="ol10 debian12 debian13 ubuntu2204 ubuntu2404 ubuntu2604" priv=""
  case " $needs_privileged " in *" $OS "*) priv="--privileged" ;; esac

  # Not --network host: PMM checks for a Nomad node whose address is not
  # 127.0.0.1, so the client needs an address of its own.
  # shellcheck disable=SC2086
  sudo podman run -d --name client --systemd=always $priv "$CLIENT_IMAGE" /sbin/init || return 1

  # shellcheck disable=SC2016 # expanded by the shell inside the container
  sudo podman exec client bash -c '
    for i in $(seq 1 90); do
      case "$(systemctl is-system-running 2>/dev/null)" in
        running|degraded) echo "systemd up after ${i}s"; exit 0 ;;
      esac
      sleep 1
    done
    echo "systemd never came up"; systemctl list-jobs --no-pager; exit 1' || return 1

  # The playbooks take each database and its version from database-versions, so
  # the image has to have been built from the same lines, or a cell would test
  # one version while reporting another.
  local expected actual
  expected=$(awk -v os="$OS" '$1 == os { print $2, $3, $4 }' "$QA_DIR/package_tests/docker/database-versions")
  actual=$(sudo podman exec client cat /etc/package-tests-databases 2>/dev/null)
  echo "databases in the image: ${actual:-none}"
  if [ "$actual" != "$expected" ]; then
    echo "database-versions lists ${expected:-none} for ${OS}; rebuild the image (build_images)"
    return 1
  fi

  # The bridge gateway is the runner, where pmm-server publishes its ports.
  gateway=$(sudo podman exec client ip route | awk '/^default/{print $3}')
  [ -n "$gateway" ] || { echo "client has no default route"; return 1; }
  echo "pmm-server will be reachable at ${gateway}:443"
}

# Nomad turns on cgroup controllers at the container's cgroup root, and cgroup v2
# refuses that while any process sits directly in it. A few systemd builds leave
# one or two there, and Nomad then exits with "cgroups are not writable". Moving
# them into a child cgroup is a no-op when the root is empty.
free_cgroup_root() {
  # shellcheck disable=SC2016 # expanded by the shell inside the container
  sudo podman exec client sh -c '
    if [ "$(wc -l < /sys/fs/cgroup/cgroup.procs)" -gt 0 ]; then
      mkdir -p /sys/fs/cgroup/init
      while read -r pid; do
        echo "$pid" > /sys/fs/cgroup/init/cgroup.procs 2>/dev/null || true
      done < /sys/fs/cgroup/cgroup.procs
    fi
    left=$(wc -l < /sys/fs/cgroup/cgroup.procs)
    echo "processes left at the cgroup root: $left"
    [ "$left" -eq 0 ] || echo "WARNING: Nomad will fail to start"' || true
}

# Started after the client because PMM_PUBLIC_ADDRESS has to be an address the
# client can reach -- 127.0.0.1 would point it back at itself. Nomad also stays
# switched off unless PMM_PUBLIC_ADDRESS is set (PMM-14921).
start_server() {
  sudo podman run -d --name pmm-server \
    -p 80:8080 -p 443:8443 -p 9000:9000 -p 4647:4647 \
    --volume pmm-data:/srv \
    -e GF_SECURITY_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    -e PMM_ENABLE_TELEMETRY=0 \
    -e PMM_DATA_RETENTION=48h \
    -e PMM_ENABLE_NOMAD=1 \
    -e PMM_ENABLE_INTERNAL_PG_QAN=1 \
    -e PMM_PUBLIC_ADDRESS="$gateway" \
    "$SERVER_IMAGE"
}

# readyz goes green before Nomad is listening, and the playbook only retries a
# few times before giving up on it. 502 means Nomad is not up yet.
wait_for_server() {
  curl -ksf --retry 60 --retry-delay 5 --retry-all-errors \
    https://127.0.0.1/v1/server/readyz || return 1

  local code=000
  for _ in $(seq 1 60); do
    code=$(curl -ks -o /dev/null -w '%{http_code}' https://127.0.0.1/nomad/v1/nodes || echo 000)
    case "$code" in 502|504|000) sleep 5 ;; *) break ;; esac
  done
  if [ "$code" = 502 ]; then
    sudo podman logs pmm-server --tail 50 || true
    echo "Nomad never started listening"; return 1
  fi
  echo "Nomad is listening (HTTP $code)"

  # Check the client can actually get there; a wrong public address breaks it.
  sudo podman exec client bash -c "timeout 5 bash -c '</dev/tcp/${gateway}/4647'"
}

copy_pmm_qa() {
  sudo podman cp "$QA_DIR" client:/root/pmm-qa &&
    sudo podman exec client sh -c 'ls /root/pmm-qa/package_tests >/dev/null'
}

# Same invocation as Jenkins. DEBIAN_FRONTEND and friends are baked into the deb
# images, so apt cannot stop and wait for input. 85 minutes keeps an attempt
# inside the 90 the Jenkins job allowed. Inside bash -c, $1 is the playbook; out
# here it is the attempt number.
run_playbook() {
  # shellcheck disable=SC2016 # expanded by the shell inside the container
  timeout 85m sudo podman exec \
    -e PMM_SERVER_IP="${gateway}:443" \
    -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    -e install_repo="$INSTALL_REPO" \
    -e METRICS_MODE="$METRICS_MODE" \
    -e PMM_VERSION="$PMM_VERSION" \
    -e TARBALL_LINK="$TARBALL_LINK" \
    -w /root/pmm-qa \
    client \
    bash -c '
      # podman exec drops us in the cgroup root, which would undo free_cgroup_root,
      # so move into a child cgroup before starting anything.
      mkdir -p /sys/fs/cgroup/ansible 2>/dev/null &&
        echo $$ > /sys/fs/cgroup/ansible/cgroup.procs 2>/dev/null || true
      exec ansible-playbook -vvv --connection=local \
        --inventory 127.0.0.1, --limit 127.0.0.1 \
        "package_tests/$1.yml"' bash "$TEST" 2>&1 | tee "ansible-$1.log"
}

# The playbooks write pmm-summary.zip next to package_tests/ when a metric check
# fails.
collect_diagnostics() {
  {
    echo "===== pmm-server ====="; sudo podman logs pmm-server --tail 200 2>&1
    echo "===== pmm-admin status ====="; sudo podman exec client pmm-admin status 2>&1
    echo "===== failed units ====="; sudo podman exec client systemctl --failed --no-pager 2>&1
    echo "===== client journal ====="; sudo podman exec client journalctl --no-pager -n 300 2>&1
  } > "diagnostics-$1.log"
  sudo podman cp client:/root/pmm-qa/pmm-summary.zip "pmm-summary-$1.zip" 2>/dev/null || true
  tail -80 "diagnostics-$1.log"
}

# --ignore: without it, podman removes neither container when one was never
# created -- an attempt that failed before PMM Server started -- and still exits
# 0, so the next attempt finds the old client in its way.
teardown() {
  sudo podman rm -f --ignore client pmm-server >/dev/null
  sudo podman volume rm -f pmm-data >/dev/null
  return 0
}

for attempt in $(seq 1 "$ATTEMPTS"); do
  echo "$attempt" > attempts.txt
  gateway=""

  echo "::group::Attempt ${attempt} of ${ATTEMPTS}: start the ${OS} client and PMM Server"
  start_client && free_cgroup_root && start_server && wait_for_server && copy_pmm_qa
  ready=$?
  echo "::endgroup::"

  if [ "$ready" -eq 0 ]; then
    echo "::group::Attempt ${attempt} of ${ATTEMPTS}: ${TEST}"
    run_playbook "$attempt"
    passed=$?
    echo "::endgroup::"
    if [ "$passed" -eq 0 ]; then
      rm -f "ansible-${attempt}.log"
      teardown
      exit 0
    fi
  else
    echo "the environment did not come up" > "ansible-${attempt}.log"
  fi

  echo "::group::Attempt ${attempt} of ${ATTEMPTS}: diagnostics"
  collect_diagnostics "$attempt"
  echo "::endgroup::"
  teardown

  if [ "$attempt" -lt "$ATTEMPTS" ]; then
    echo "::warning::${OS}-${ARCH} / ${TEST}: attempt ${attempt} failed, retrying from scratch"
  else
    echo "::error::${OS}-${ARCH} / ${TEST}: failed on all ${ATTEMPTS} attempts"
  fi
done
exit 1
