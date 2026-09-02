#!/bin/bash

# Runs on the host from db_setup.sh. `docker compose up -d` never checks the
# exit code of the drop one-shot, so assert the state PMM-T1087 depends on here,
# where a failure fails the setup step instead of a test 10 minutes later.

compose_file=${DOCKER_COMPOSE_FILE:-docker-compose.yml}
service=${POSTGRES_NO_DB_SERVICE:-postgresnodb}
drop_service=${POSTGRES_NO_DB_DROP_SERVICE:-postgresremovedefaultdb}
user=${POSTGRES_NO_DB_USER:-test}
db=${POSTGRES_NO_DB_NAME:-not_default_db}

drop_container=$(docker compose -f "${compose_file}" ps -aq "${drop_service}")
if [ -n "${drop_container}" ]; then
  drop_status=$(docker wait "${drop_container}")
  if [ "${drop_status}" != 0 ]; then
    echo "${drop_service} exited with ${drop_status}:" >&2
    docker logs "${drop_container}" >&2
  fi
fi

remaining=$(docker compose -f "${compose_file}" exec -T "${service}" \
  psql -U "${user}" -d "${db}" -Atc \
  "SELECT count(*) FROM pg_database WHERE datname = 'postgres'")

if [ "${remaining}" != 0 ]; then
  echo "${service} still has a postgres database — PMM-T1087 expects its connection check to fail" >&2
  exit 1
fi

echo "${service} has no postgres database, as PMM-T1087 expects"
