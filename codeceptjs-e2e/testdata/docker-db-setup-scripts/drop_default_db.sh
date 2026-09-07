#!/bin/bash

# Runs inside the postgres image as the `postgresremovedefaultdb` one-shot.
# PMM-T1087 needs postgresnodb to have no `postgres` database; retry until that
# is confirmed, since a single psql leaves it behind on a transient failure.

export PGCONNECT_TIMEOUT=5

for attempt in $(seq 1 30); do
  psql -w -Utest -hpostgresnodb -dnot_default_db -c 'DROP DATABASE IF EXISTS postgres WITH (FORCE);'
  remaining=$(psql -w -Utest -hpostgresnodb -dnot_default_db -Atc \
    "SELECT count(*) FROM pg_database WHERE datname = 'postgres'")
  if [ "${remaining}" = 0 ]; then
    echo "postgres database dropped on postgresnodb (attempt ${attempt})"
    exit 0
  fi
  echo "attempt ${attempt}: postgres database still present on postgresnodb, retrying"
  sleep 2
done

echo "failed to drop the postgres database on postgresnodb after 30 attempts" >&2
exit 1
