#!/usr/bin/env bash
# Upgrade the PMM client inside every *client_container* Docker container to a
# requested version/repo, then verify each one's running pmm-agent reports that
# version and is connected to PMM Server. Containers are upgraded in parallel; one
# container's failure is recorded and the rest carry on.
set -Eeuo pipefail

version="" repo="" parallel=""
while [ $# -gt 0 ]; do
  case "$1" in
    --version)  version="$2"; shift 2 ;;
    --repo)     repo="$2"; shift 2 ;;
    --parallel) parallel="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
version="${version:-3.7.0}"
repo="${repo:-testing}"
parallel="${parallel:-4}"
[[ "$parallel" =~ ^[1-9][0-9]*$ ]] || { echo "--parallel must be a positive integer, got: $parallel" >&2; exit 2; }

CONFIG=/usr/local/percona/pmm/config/pmm-agent.yaml
APT_OPTS=(-o Acquire::Retries=5 -o DPkg::Lock::Timeout=300)

# Retry a docker exec a few times: at load-test scale repo.percona.com and the
# PMM server drop requests, and one transient error must not skip a client.
retry() {
  local n
  for n in 1 2 3; do
    "$@" && return 0
    echo "attempt $n failed: $*" >&2
    sleep $((n * 10))
  done
  return 1
}

# Print `pmm-admin status` once the agent answers it and is connected to the server.
wait_connected() {
  local c="$1" out
  for _ in $(seq 1 24); do
    if out="$(docker exec "$c" pmm-admin status 2>/dev/null)" \
      && printf '%s\n' "$out" | grep -Eq '^[[:space:]]*Connected[[:space:]]*:[[:space:]]*true'; then
      printf '%s\n' "$out"
      return 0
    fi
    sleep 5
  done
  return 1
}

# One container's whole upgrade. Run it only as a background job (never as an
# `if`/`||` condition): bash ignores set -e inside a function or subshell called
# from a condition, which let a failed step fall through to the next one.
upgrade_container() (
  set -Eeuo pipefail
  c="$1"
  retry docker exec "$c" percona-release enable pmm3-client "$repo"
  retry docker exec "$c" apt-get "${APT_OPTS[@]}" update
  docker exec "$c" cp "$CONFIG" /tmp/pmm-agent.yaml.old
  # apt's `=<version>` is an exact match (no glob), so resolve the concrete
  # published build whose version begins with the requested one (literal
  # prefix via index(), newest first).
  full_ver="$(docker exec "$c" apt-cache madison pmm-client | awk -F'|' -v v="$version" '{gsub(/ /,"",$2)} index($2, v)==1 {print $2; exit}')"
  [ -n "$full_ver" ] || { echo "no pmm-client version matching ${version} in repo ${repo}" >&2; exit 1; }
  retry docker exec --env DEBIAN_FRONTEND=noninteractive "$c" \
    apt-get "${APT_OPTS[@]}" install -y -o Dpkg::Options::=--force-confold "pmm-client=${full_ver}"

  # Stop the old agent and wait for it to exit: it takes a few seconds to stop its
  # exporters, and a new agent started before then can't bind its port and dies.
  # -x matches the process name exactly, so the exec'd shell itself isn't matched.
  docker exec "$c" pkill -x pmm-agent || true
  for _ in $(seq 1 30); do
    docker exec "$c" pgrep -x pmm-agent >/dev/null || break
    sleep 2
  done
  docker exec "$c" pkill -9 -x pmm-agent || true

  docker exec "$c" cp /tmp/pmm-agent.yaml.old "$CONFIG"
  # setsid detaches the agent from the exec session so it survives docker exec return.
  docker exec "$c" sh -c "setsid pmm-agent --config-file=$CONFIG >/tmp/pmm-agent.log 2>&1 &"
  status="$(wait_connected "$c")" \
    || { echo "pmm-agent did not connect to PMM Server; tail of /tmp/pmm-agent.log:" >&2; docker exec "$c" tail -n 20 /tmp/pmm-agent.log >&2 || true; exit 1; }
  running="$(printf '%s\n' "$status" | awk -F': *' '/pmm-agent version/ {print $2; exit}')"
  [ "${running#"$version"}" != "$running" ] \
    || { echo "running pmm-agent reports version '${running}', expected ${version}" >&2; exit 1; }
  node_name="$(printf '%s\n' "$status" | awk -F': *' '/Node name/ {print $2; exit}')"
  docker exec "$c" pmm-admin annotate "client ${node_name} upgraded to ${version}" || true
)

mapfile -t containers < <(docker ps --format '{{.Names}}' | grep client_container || true)
mapfile -t stopped < <(docker ps -a --filter status=exited --filter status=created --filter status=dead \
  --format '{{.Names}}' | grep client_container || true)
[ "${#containers[@]}" -gt 0 ] || { echo "no running *client_container* containers found" >&2; exit 1; }

rc=0
# A stopped client is a client that will not be upgraded: report it rather than skip it silently.
for c in "${stopped[@]}"; do
  echo "ERROR: ${c} is not running, not upgraded" >&2; rc=1
done

logdir="$(mktemp -d)"
for c in "${containers[@]}"; do
  while [ "$(jobs -rp | wc -l)" -ge "$parallel" ]; do wait -n || true; done
  echo "Upgrading PMM client on container: ${c}"
  # set +e here, not `|| rc=$?`, so upgrade_container still runs under its own set -e.
  ( set +e; upgrade_container "$c" >"${logdir}/${c}.log" 2>&1; echo $? >"${logdir}/${c}.rc" ) &
done
wait

ok=0
for c in "${containers[@]}"; do
  echo "----- ${c}"
  if [ "$(cat "${logdir}/${c}.rc" 2>/dev/null)" = 0 ]; then
    cat "${logdir}/${c}.log"; echo "client upgraded: ${c} -> ${version}"; ok=$((ok + 1))
  else
    cat "${logdir}/${c}.log"; echo "ERROR: upgrade failed on ${c}" >&2; rc=1
  fi
done
rm -rf "$logdir"

echo "upgrade summary: upgraded=${ok} failed=$(( ${#containers[@]} - ok )) not_running=${#stopped[@]} version=${version}"
exit "$rc"
