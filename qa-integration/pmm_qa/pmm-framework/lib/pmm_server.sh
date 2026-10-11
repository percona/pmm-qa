#!/usr/bin/env bash
# shellcheck disable=SC2034  # set here for images/ to read; shellcheck sees one file at a time.
#
# lib/pmm_server.sh -- locating the PMM Server: --pmm-server-ip on 443, or a
# local pmm-server container on the pmm-qa network on 8443.

PMM_SERVER_CONTAINER=''

# Several matches: use the first, but warn, so a run never silently monitors
# the wrong server.
discover_pmm_server() {
  local image name
  local -a candidates=()
  while IFS=$'\t' read -r image name; do
    if [[ $image == *pmm-server* ]]; then
      candidates+=("$name")
    fi
  done < <(docker ps --format '{{.Image}}{{"\t"}}{{.Names}}')

  ((${#candidates[@]} > 0)) || return 1
  PMM_SERVER_CONTAINER=${candidates[0]}
  if ((${#candidates[@]} > 1)); then
    log_warn "Found ${#candidates[@]} PMM Server containers (${candidates[*]});" \
      "using '$PMM_SERVER_CONTAINER'. Pass --pmm-server-ip to select one explicitly."
  fi

  # Called under `||`, where errexit is off, so each docker call dies itself.
  if ! docker network inspect pmm-qa \
    --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}' |
    grep -Fxq "$PMM_SERVER_CONTAINER"; then
    must docker network connect pmm-qa "$PMM_SERVER_CONTAINER"
  fi
}

resolve_pmm_server() {
  # Once, before any setup forks: parallel setups racing to create it would
  # fail all but one.
  ensure_pmm_network
  if [[ -n ${PMM_SERVER_IP_ARG:-} ]]; then
    PMM_SERVER_HOST=$PMM_SERVER_IP_ARG
    PMM_SERVER_PORT=443
    return
  fi

  discover_pmm_server ||
    die "PMM Server is not running and --pmm-server-ip was not provided."
  PMM_SERVER_HOST=$PMM_SERVER_CONTAINER
  PMM_SERVER_PORT=8443
}

# Only a discovered local server can be probed; an --pmm-server-ip is trusted.
wait_pmm_server_ready() {
  [[ -n $PMM_SERVER_CONTAINER ]] || return 0
  retry 180 'PMM Server readiness' \
    docker exec "$PMM_SERVER_CONTAINER" curl -fsS --max-time 5 http://127.0.0.1:8080/v1/server/readyz >/dev/null
}
