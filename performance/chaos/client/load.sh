#!/usr/bin/env bash
# Runs on a client VM. One MySQL, PostgreSQL and MongoDB, each with a light workload, and K
# pmm-client containers that monitor them (2:2:1 MySQL:PostgreSQL:MongoDB, like the Linode load).
# The DB load stays light on purpose: what stresses PMM is the number of agents.
#   load.sh start <vm> <count> | stats | upgrade
set -euo pipefail
cd /root/perf || exit 1
set -a; . ./run.env; set +a
W=/root/perf/client/workload

db_up() {
  docker network inspect perf >/dev/null 2>&1 || docker network create perf >/dev/null
  mkdir -p init/mysql init/pg; chmod 755 init init/mysql init/pg
  cat >init/mysql/pmm.sql <<SQL
CREATE USER 'pmm'@'%' IDENTIFIED BY '$DB_PASSWORD' WITH MAX_USER_CONNECTIONS 1000;
GRANT SELECT, PROCESS, REPLICATION CLIENT, RELOAD, BACKUP_ADMIN ON *.* TO 'pmm'@'%';
SQL
  cat >init/pg/pmm.sql <<SQL
CREATE USER pmm WITH PASSWORD '$DB_PASSWORD';
GRANT pg_monitor TO pmm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SQL
  chmod 644 init/mysql/pmm.sql init/pg/pmm.sql
  run() { docker run -d --network perf --restart unless-stopped --log-opt max-size=20m --log-opt max-file=2 "$@" >/dev/null; }
  run --name mysql -e MYSQL_ROOT_PASSWORD="$DB_PASSWORD" -v /root/perf/init/mysql:/docker-entrypoint-initdb.d:ro \
    percona/percona-server:8.0 --max-connections=2000
  run --name postgres -e POSTGRES_PASSWORD="$DB_PASSWORD" -v /root/perf/init/pg:/docker-entrypoint-initdb.d:ro \
    postgres:16 -c shared_preload_libraries=pg_stat_statements -c pg_stat_statements.track=all \
    -c pg_stat_statements.max=10000 -c max_connections=2000
  run --name mongo percona/percona-server-mongodb:7.0 --profile 2 --slowms 0 --wiredTigerCacheSizeGB 1
  run --name load-mysql -e DB_PASSWORD="$DB_PASSWORD" -v $W:/w:ro --entrypoint bash percona/percona-server:8.0 /w/mysql.sh
  run --name load-pg -e DB_PASSWORD="$DB_PASSWORD" -v $W:/w:ro --entrypoint bash postgres:16 /w/pg.sh
  run --name load-mongo -v $W:/w:ro --entrypoint mongosh percona/percona-server-mongodb:7.0 --quiet --host mongo /w/mongo.js
}

client_run() { # name node db
  docker run -d --name "$1" --hostname "$2" --network perf --restart unless-stopped --env-file run.env \
    --log-opt max-size=10m --log-opt max-file=2 \
    -e NODE_NAME="$2" -e DB="$3" -v "$1:/usr/local/percona/pmm/config" \
    -v /root/perf/client/entrypoint.sh:/perf-entrypoint.sh:ro --entrypoint /bin/sh \
    "$CLIENT_IMAGE" /perf-entrypoint.sh >/dev/null
}

cmd_start() {
  local vm=$1 count=$2 i db
  db_up
  : >containers.tsv
  for i in $(seq "$count"); do
    case $(( i % 5 )) in 1|3) db=mysql ;; 2|4) db=postgresql ;; 0) db=mongodb ;; esac
    printf '%s\t%s\t%s\n' "$(printf 'pc%03d' "$i")" "$(printf 'pc-%s-%03d' "$vm" "$i")" "$db" >>containers.tsv
  done
  # Staggered, so the server sees a ramp rather than every VM's agents registering at once.
  while IFS=$'\t' read -r name node db; do client_run "$name" "$node" "$db"; sleep 1; done <containers.tsv
  echo "$(hostname): $count clients started"
}

cmd_stats() {
  docker stats --no-stream --format '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' >stats.tsv
  awk -F'\t' '
    function mib(s,  v) { v = s + 0; if (s ~ /GiB/) v *= 1024; else if (s ~ /KiB/) v /= 1024; else if (s ~ /[^Mi]B$/ && s !~ /MiB/) v /= 1048576; return v }
    { split($3, m, " / "); c = $2 + 0; mem = mib(m[1])
      if ($1 ~ /^pc[0-9]+$/) { n++; cc += c; cm += mem; if (mem > mx) mx = mem }
      else printf "  %-11s cpu %6.1f%%  mem %7.0f MiB\n", $1, c, mem }
    END { if (n) printf "  clients: %d  cpu %.0f%% total (%.1f%% each)  mem %.0f MiB total (%.0f MiB each, max %.0f)\n", n, cc, cc/n, cm, cm/n, mx }' stats.tsv
  echo "  vm: $(nproc) vCPU, $(free -m | awk '/Mem:/ {printf "mem used %d/%d MiB", $3, $2}'), load $(cut -d' ' -f1-3 /proc/loadavg)"
  vmstat 5 3 | awk 'NR == 2 { for (i = 1; i <= NF; i++) col[$i] = i } NR > 3 { printf "  vmstat: us %s sy %s id %s wa %s st %s\n", $col["us"], $col["sy"], $col["id"], $col["wa"], $col["st"] }'
}

cmd_upgrade() {
  docker pull -q "$CLIENT_IMAGE" >/dev/null
  while IFS=$'\t' read -r name node db; do
    docker rm -f "$name" >/dev/null; client_run "$name" "$node" "$db"; sleep 1
  done <containers.tsv
}

case ${1:-} in
  start) cmd_start "$2" "$3" ;;
  stats) cmd_stats ;;
  upgrade) cmd_upgrade ;;
  *) echo "usage: load.sh start <vm> <count> | stats | upgrade" >&2; exit 2 ;;
esac
