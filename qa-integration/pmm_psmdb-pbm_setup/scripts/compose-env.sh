#!/bin/bash
# Shared docker compose helper for replica-set setup scripts.
compose_rs() {
  if [[ "${PMM_QA_NO_SYSTEMD:-}" == "1" ]]; then
    docker compose -f docker-compose-rs.yaml -f docker-compose-rs.microvm.yaml "$@"
  else
    docker compose -f docker-compose-rs.yaml "$@"
  fi
}

compose_sharded() {
  if [[ "${PMM_QA_NO_SYSTEMD:-}" == "1" ]]; then
    docker compose -f docker-compose-sharded.yaml -f docker-compose-sharded.microvm.yaml "$@"
  else
    docker compose -f docker-compose-sharded.yaml "$@"
  fi
}
