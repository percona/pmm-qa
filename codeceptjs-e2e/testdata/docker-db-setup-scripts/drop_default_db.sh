#!/bin/bash

# Runs inside the postgres image as the `postgresremovedefaultdb` one-shot.
# PMM-T1087 needs postgresnodb to have no `postgres` database, so PMM's pre-add
# connection check rejects the service. Retry until the drop is confirmed: a
# single psql leaves the database behind on any transient failure, PMM then
# legitimately accepts the service, and the test fails much later looking like a
# product bug.

host=${POSTGRES_NO_DB_HOST:-postgresnodb}
user=${POSTGRES_NO_DB_USER:-test}
db=${POSTGRES_NO_DB_NAME:-not_default_db}
attempts=${POSTGRES_NO_DB_ATTEMPTS:-30}

for attempt in $(seq 1 "${attempts}"); do
  psql -U "${user}" -h "${host}" -d "${db}" -c 'DROP DATABASE IF EXISTS postgres WITH (FORCE);'
  remaining=$(psql -U "${user}" -h "${host}" -d "${db}" -Atc \
    "SELECT count(*) FROM pg_database WHERE datname = 'postgres'")
  if [ "${remaining}" = 0 ]; then
    echo "postgres database dropped on ${host} (attempt ${attempt})"
    exit 0
  fi
  echo "attempt ${attempt}: postgres database still present on ${host}, retrying"
  sleep 2
done

echo "failed to drop the postgres database on ${host} after ${attempts} attempts" >&2
exit 1
