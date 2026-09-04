#!/usr/bin/env bash
# Upgrade the PMM client inside every running *client_container* Docker container
# to a requested version/repo, then verify each one actually reports that version.
set -Eeuo pipefail

version="" repo=""
while [ $# -gt 0 ]; do
  case "$1" in
    --version) version="$2"; shift 2 ;;
    --repo)    repo="$2"; shift 2 ;;
    *) shift ;;
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

  # Pin the requested version; fall back to latest-in-repo (with a warning) only
  # if that exact build isn't published.
  if ! docker exec "$c" bash -c "DEBIAN_FRONTEND=noninteractive apt-get install -y 'pmm-client=${version}*'"; then
    echo "warning: pmm-client=${version}* unavailable on ${c}, installing latest from ${repo}" >&2
    docker exec "$c" bash -c "DEBIAN_FRONTEND=noninteractive apt-get install -y pmm-client"
  fi

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
