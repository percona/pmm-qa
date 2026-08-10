#!/bin/sh
set -eu

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  initdb -D "$PGDATA" --username=postgres --auth-host=scram-sha-256
  printf '%s\n' "host all all 0.0.0.0/0 scram-sha-256" >> "$PGDATA/pg_hba.conf"
fi

if [ ! -s "$PGDATA/server.key" ]; then
  openssl req -new -x509 -days 3650 -nodes -subj '/CN=localhost' -keyout "$PGDATA/server.key" -out "$PGDATA/server.crt"
  chmod 600 "$PGDATA/server.key"
fi

exec postgres -D "$PGDATA" -c listen_addresses='*' "$@"
