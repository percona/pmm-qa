#!/usr/bin/env bash

PMM_SERVER_CONTAINER=''

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

  if ! docker network inspect pmm-qa >/dev/null 2>&1; then
    docker network create pmm-qa >/dev/null
  fi

  if ! docker network inspect pmm-qa \
    --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}' |
    grep -Fxq "$PMM_SERVER_CONTAINER"; then
    docker network connect pmm-qa "$PMM_SERVER_CONTAINER"
  fi
}

resolve_pmm_server() {
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
