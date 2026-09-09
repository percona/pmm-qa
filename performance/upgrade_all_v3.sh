#!/usr/bin/env bash
# Upgrade the PMM client inside every running *client_container* Docker container
# to a requested version/repo, then verify each one reports that version. One
# container's failure is recorded and the loop continues to the rest.
set -Eeuo pipefail

version="" repo=""
while [ $# -gt 0 ]; do
  case "$1" in
    --version) version="$2"; shift 2 ;;
    --repo)    repo="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
version="${version:-3.7.0}"
repo="${repo:-testing}"

# One container's whole upgrade, in a subshell so a failed step fails just this
# container (the outer loop records it in rc and moves on) instead of aborting
# the run under set -e.
upgrade_container() {
  local c="$1" full_ver node_name
  (
    set -Eeuo pipefail
    docker exec "$c" percona-release enable pmm3-client "$repo"
    docker exec "$c" apt-get update
    docker exec "$c" sh -c 'cp /usr/local/percona/pmm/config/pmm-agent.yaml /tmp/pmm-agent.yaml.old'
    # apt's `=<version>` is an exact match (no glob), so resolve the concrete
    # published build whose version begins with the requested one (literal
    # prefix via index(), newest first).
    full_ver="$(docker exec "$c" apt-cache madison pmm-client 2>/dev/null | awk -F'|' -v v="$version" '{gsub(/ /,"",$2)} index($2, v)==1 {print $2; exit}')"
    [ -n "$full_ver" ] || { echo "no pmm-client version matching ${version} in repo ${repo}" >&2; exit 1; }
    docker exec --env DEBIAN_FRONTEND=noninteractive "$c" apt-get install -y "pmm-client=${full_ver}"
    docker exec "$c" pkill -f pmm-agent || true
    docker exec "$c" sh -c 'cp /tmp/pmm-agent.yaml.old /usr/local/percona/pmm/config/pmm-agent.yaml'
    # setsid detaches the agent from the exec session so it survives docker exec return.
    docker exec "$c" sh -c 'setsid pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml >/tmp/pmm-agent.log 2>&1 &'
    sleep 10
    docker exec "$c" pmm-admin status >/dev/null 2>&1 || { echo "pmm-agent did not come up" >&2; exit 1; }
    node_name="$(docker exec "$c" pmm-admin status | awk -F': ' '/Node name/ {print $2}')"
    docker exec "$c" pmm-admin annotate "client ${node_name} upgraded to ${version}" || true
    docker exec "$c" pmm-agent --version 2>&1 | grep -Fq -- "${version}" \
      || { echo "did not report version ${version}" >&2; exit 1; }
  )
}

mapfile -t containers < <(docker ps --format '{{.Names}}' | grep client_container || true)
[ "${#containers[@]}" -gt 0 ] || { echo "no running *client_container* containers found" >&2; exit 1; }

rc=0
for c in "${containers[@]}"; do
  echo "Upgrading PMM client on container: ${c}"
  if upgrade_container "$c"; then
    echo "client upgraded: ${c} -> ${version}"
  else
    echo "ERROR: upgrade failed on ${c}" >&2; rc=1
  fi
  echo ""
done

exit "$rc"
