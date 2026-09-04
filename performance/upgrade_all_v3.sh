#!/usr/bin/env bash
# Upgrade the PMM client inside every running *client_container* Docker container
# to a requested version/repo, then verify each one reports that version.
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

mapfile -t containers < <(docker ps --format '{{.Names}}' | grep client_container || true)
[ "${#containers[@]}" -gt 0 ] || { echo "no running *client_container* containers found" >&2; exit 1; }

rc=0
for c in "${containers[@]}"; do
  echo "Upgrading PMM client on container: ${c}"
  docker exec "$c" percona-release enable pmm3-client "$repo"
  docker exec "$c" apt-get update
  docker exec "$c" sh -c 'cp /usr/local/percona/pmm/config/pmm-agent.yaml /tmp/pmm-agent.yaml.old'

  # apt's `=<version>` is an exact match (no glob), so resolve the concrete
  # published build whose version begins with the requested one, newest first.
  full_ver="$(docker exec "$c" apt-cache madison pmm-client 2>/dev/null | awk -F'|' -v v="$version" '{gsub(/ /,"",$2)} $2 ~ ("^" v) {print $2; exit}')"
  if [ -z "$full_ver" ]; then
    echo "ERROR: no pmm-client version matching ${version} in repo ${repo} on ${c}" >&2; exit 1
  fi
  docker exec --env DEBIAN_FRONTEND=noninteractive "$c" apt-get install -y "pmm-client=${full_ver}"

  docker exec "$c" pkill -f pmm-agent || true
  docker exec "$c" sh -c 'cp /tmp/pmm-agent.yaml.old /usr/local/percona/pmm/config/pmm-agent.yaml'
  # setsid detaches the agent from the exec session so it survives docker exec return.
  docker exec "$c" sh -c 'setsid pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml >/tmp/pmm-agent.log 2>&1 &'
  sleep 10

  if ! docker exec "$c" pmm-admin status >/dev/null 2>&1; then
    echo "ERROR: pmm-agent did not come up on ${c}" >&2; rc=1; continue
  fi
  node_name="$(docker exec "$c" pmm-admin status | awk -F': ' '/Node name/ {print $2}')"
  docker exec "$c" pmm-admin annotate "client ${node_name} upgraded to ${version}" || true

  echo "Verifying installation in container: ${c}"
  if docker exec "$c" pmm-agent --version 2>&1 | grep -q "${version}"; then
    echo "client upgraded: ${node_name} -> ${version}"
  else
    echo "ERROR: ${c} did not report version ${version}" >&2; rc=1
  fi
  echo ""
done

exit "$rc"
