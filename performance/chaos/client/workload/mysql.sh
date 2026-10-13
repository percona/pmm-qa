#!/bin/bash
# 16 sessions over 24 tables, 300s busy then 30s idle, forever. Random-key deletes keep each
# table near 32k rows, so a soak's disk does not grow with the workload.
export MYSQL_PWD=$DB_PASSWORD
m() { mysql -h mysql -uroot "$@"; }
until m -e 'SELECT 1' >/dev/null 2>&1; do sleep 5; done
m -e 'CREATE DATABASE IF NOT EXISTS sbtest'
for t in $(seq 24); do
  m sbtest -e "CREATE TABLE IF NOT EXISTS t$t (id INT AUTO_INCREMENT PRIMARY KEY, k INT, c CHAR(32), KEY (k))"
done
round() {
  for _ in $(seq 100); do
    t=$((RANDOM % 24 + 1)); k=$RANDOM
    echo "INSERT INTO t$t (k, c) VALUES ($k, MD5($k));
SELECT c FROM t$t WHERE k = $k;
UPDATE t$t SET c = MD5(RAND()) WHERE k BETWEEN $k AND $((k + 20));
SELECT COUNT(*), AVG(k) FROM t$t WHERE id > $((RANDOM * 10));
DELETE FROM t$t WHERE k = $RANDOM;"
  done
}
while :; do
  end=$((SECONDS + 300))
  while [ $SECONDS -lt $end ]; do
    for _ in $(seq 16); do round | m sbtest >/dev/null & done
    wait; sleep 1
  done
  sleep 30
done
