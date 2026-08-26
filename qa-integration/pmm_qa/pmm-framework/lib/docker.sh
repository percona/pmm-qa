#!/usr/bin/env bash
# shellcheck disable=SC2034  # set here for setups/ to read; shellcheck sees one file at a time.
#
# lib/docker.sh -- locating the PMM Server the setups should report to.
#
# Every setup needs an address to point pmm-agent at. It comes from one of two
# places, and the choice also decides the port:
#
#   --pmm-server-ip 10.0.0.5   an external/remote server, reached on 443
#   (omitted)                  a local container on the pmm-qa Docker network,
#                              reached by container name on 8443
#
# Both are published as PMM_SERVER_HOST / PMM_SERVER_PORT for the setup
# functions to drop into their env maps.

# Name of the discovered PMM Server container; empty until discovery runs.
PMM_SERVER_CONTAINER=''

# Find a running PMM Server container and attach it to the pmm-qa network.
#
# Matches any running container whose *image* contains 'pmm-server'. When
# several match, the first is used and a warning names them all -- picking
# silently would let a run monitor the wrong server, which is confusing to
# debug. Pass --pmm-server-ip to be explicit.
#
# Creates the pmm-qa network if missing and connects the server to it, so the
# database containers the setups create can reach it by name.
#
# Writes:  PMM_SERVER_CONTAINER
# Returns: 0 when a server was found, 1 when none is running
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

# Decide the PMM Server address for this run.
#
# Called once from preflight, and only when at least one requested setup
# actually needs a server (BUCKET and DOCKERCLIENTS do not).
#
# Reads:  PMM_SERVER_IP_ARG
# Writes: PMM_SERVER_HOST, PMM_SERVER_PORT
# Exits:  via die() when no server is running and no address was given
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
