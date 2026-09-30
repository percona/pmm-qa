#!/usr/bin/env bash
# Upgrades pmm-client in every client container in parallel and verifies each one
# reports the expected version. Logs are printed only for containers that fail.
#
# Usage: upgrade_clients.sh <expected-version>
# Env:   CLIENT_INSTALL_VERSION  pmm3-rc upgrades from the experimental repository, anything else from testing
#        CLIENT_TARBALL_UPGRADE  tarball URL to upgrade from instead of the repository (optional)
set -uo pipefail

want="${1:?usage: $0 <expected-version>}"

if [[ "${CLIENT_INSTALL_VERSION:-}" == "pmm3-rc" ]]; then
  repository=experimental
else
  repository=testing
fi

upgrade_client() {
  local c="$1" log status running versions got fail=0
  echo "== upgrading client in $c =="
  log=$(mktemp)
  {
    if [ -n "${CLIENT_TARBALL_UPGRADE:-}" ]; then
      docker exec "$c" sh -c 'command -v wget >/dev/null || (command -v dnf >/dev/null && dnf install -y wget || apt-get install -y wget)'
      docker exec "$c" wget -qO /pmm-client.tar.gz "$CLIENT_TARBALL_UPGRADE"
      docker exec "$c" sh -c 'cd / && tar -zxpf /pmm-client.tar.gz &&
        d=$(ls -1td pmm-client*/ | head -n1) &&
        rm -rf /usr/local/bin/pmm-client &&
        mv -f "$d" /usr/local/bin/pmm-client &&
        bash -x /usr/local/bin/pmm-client/install_tarball -u'
    else
      echo "Upgrading using packages to repository: $repository"
      docker exec "$c" percona-release enable-only pmm3-client "$repository"
      docker exec "$c" sh -c 'command -v apt >/dev/null && apt install -y pmm-client || dnf install -y pmm-client'
    fi
    # The pmm-client package ships a pmm-agent.service, but the QA DB
    # containers already run pmm-agent as a standalone (nohup) process that
    # holds the agent's local API port (127.0.0.1:7777). A bare
    # `systemctl restart` then starts the new binary as a service that cannot
    # bind that port and crash-loops (Restart=always), while the old process
    # keeps serving pmm-admin on the previous version. Stop every instance and
    # wait for the port to free before starting the upgraded agent.
    docker exec "$c" sh -c '
      systemctl stop pmm-agent 2>/dev/null || true
      pkill -x pmm-agent 2>/dev/null || true
      for _ in $(seq 1 15); do pgrep -x pmm-agent >/dev/null || break; sleep 1; done
      if systemctl cat pmm-agent >/dev/null 2>&1; then
        systemctl restart pmm-agent
      else
        nohup pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml >/var/log/pmm-agent.log 2>&1 &
      fi
    '
  } >"$log" 2>&1
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "!! upgrade failed in $c, showing logs:"
    cat "$log"
    rm -f "$log"
    return "$status"
  fi

  # pmm-admin --version reads the on-disk binaries; pmm-admin status confirms the
  # RUNNING agent was restarted onto the new version, retried while it reconnects.
  running=""
  for _ in $(seq 1 30); do
    running=$(docker exec "$c" sh -c 'pmm-admin status 2>/dev/null | awk "/pmm-agent version/ {print \$NF}"')
    [[ "$running" == *"$want"* ]] && break
    sleep 2
  done
  versions=$(docker exec "$c" pmm-admin --version 2>&1)
  for got in "$(sed -n 2p <<<"$versions")" "$(sed -n 3p <<<"$versions")" "running pmm-agent: $running"; do
    if [[ "$got" == *"$want"* ]]; then
      echo "OK: $c: $got"
    else
      echo "FAIL: $c: expected $want, got '$got'"
      fail=1
    fi
  done
  if [ "$fail" -ne 0 ]; then
    echo "== upgrade verification failed in $c, showing logs: =="
    cat "$log"
    rm -f "$log"
    return 1
  fi
  rm -f "$log"
  echo "== upgrade succeeded in $c =="
}

# Each container writes its own output so per-container logs stay contiguous when printed.
outdir=$(mktemp -d)
pids=()
for c in $(docker ps --format '{{.Names}}' | grep -Ev '^(pmm-server|pmm-server-old|watchtower|ldap-server|kerberos|minio|redis_container|chunk-churn|external_pmm|nginx)$'); do
  upgrade_client "$c" >"$outdir/$c.out" 2>&1 &
  pids+=("$!")
done

rc=0
for pid in "${pids[@]}"; do
  wait "$pid" || rc=1
done

for f in "$outdir"/*.out; do
  [ -e "$f" ] || continue
  cat "$f"
done
rm -rf "$outdir"
exit "$rc"
