#!/bin/bash

# Runs on the host from db_setup.sh, asserting the state PMM-T1087 depends on.

compose_file=${DOCKER_COMPOSE_FILE:-docker-compose.yml}

drop_container=$(docker compose -f "${compose_file}" ps -aq postgresremovedefaultdb)
if [ -n "${drop_container}" ]; then
  drop_status=$(timeout 120 docker wait "${drop_container}") || drop_status=timeout
  if [ "${drop_status}" != 0 ]; then
    echo "postgresremovedefaultdb exited with ${drop_status}:" >&2
    docker logs "${drop_container}" >&2
  fi
fi

remaining=$(timeout 60 docker compose -f "${compose_file}" exec -T \
  -e PGCONNECT_TIMEOUT=5 postgresnodb \
  psql -w -U test -d not_default_db -Atc \
  "SELECT count(*) FROM pg_database WHERE datname = 'postgres'")

case "${remaining}" in
  0) ;;
  *[!0-9]*|"")
    echo "could not read pg_database on postgresnodb (got '${remaining}')" >&2
    exit 1
    ;;
  *)
    echo "postgresnodb still has a postgres database — PMM-T1087 expects its connection check to fail" >&2
    exit 1
    ;;
esac

echo "postgresnodb has no postgres database, as PMM-T1087 expects"
