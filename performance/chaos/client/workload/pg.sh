#!/bin/bash
# PG_TABLES tables (the Linode load had 1000 film_testing_N), insert/select/update/delete on each
# every ~20s: many distinct queries per service is what loads QAN. Deletes keep each table near
# 1000 rows. Every table also adds postgres_exporter series on every agent monitoring this DB.
n=${PG_TABLES:-100}
export PGPASSWORD=$DB_PASSWORD PGHOST=postgres PGUSER=postgres PGDATABASE=postgres
until pg_isready -q; do sleep 5; done
sleep 5
psql -q -c "DO \$\$ BEGIN FOR i IN 1..$n LOOP
  EXECUTE format('CREATE TABLE IF NOT EXISTS t_%s (id serial PRIMARY KEY, k int, c text)', i);
  EXECUTE format('CREATE INDEX IF NOT EXISTS t_%s_k ON t_%s (k)', i, i);
END LOOP; END \$\$;"
part() { # first last
  for t in $(seq "$1" "$2"); do
    k=$((RANDOM % 1000))
    echo "INSERT INTO t_$t (k, c) VALUES ($k, md5('$k'));
SELECT c FROM t_$t WHERE k = $k;
UPDATE t_$t SET c = md5(random()::text) WHERE k = $(( (k + 1) % 1000 ));
DELETE FROM t_$t WHERE k = $((RANDOM % 1000));"
  done
}
while :; do
  for s in 0 1 2 3; do part $((s * n / 4 + 1)) $(((s + 1) * n / 4)) | psql -q >/dev/null & done
  wait; sleep 20
done
