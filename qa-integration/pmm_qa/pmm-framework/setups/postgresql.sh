#!/usr/bin/env bash
#
# setups/postgresql.sh -- PostgreSQL-family setups: PDPGSQL, SSL_PDPGSQL, PGSQL,
# all on prebaked images.
#
# PDPGSQL is the Percona Distribution with pg_stat_monitor (PGSM), PGSQL is
# upstream PostgreSQL with pg_stat_statements (PGSS). They keep the ports and
# container names of the playbooks they replace.

readonly PDPGSQL_PASSWORD='pass+this'
readonly -a PDPGSQL_PRIMARY_CONF=('wal_level = logical' 'max_wal_senders = 10' 'wal_keep_size = 64MB' 'hot_standby = on')
readonly -a PDPGSQL_REPLICA_CONF=(
  'pg_stat_monitor.pgsm_query_max_len = 2048'
  'pg_stat_monitor.pgsm_normalized_query=1'
  'pg_stat_monitor.pgsm_enable_query_plan=1'
)

# Percona Distribution for PostgreSQL, monitored through pg_stat_monitor, on
# pmm-qa/pdpgsql (images/pdpgsql). Keeps the end state of
# percona-distribution-postgresql/percona-distribution-postgres-setup.yml: one
# node, a streaming replica pair (replication) or three nodes under Patroni
# and etcd (patroni).
setup_pdpgsql() {
  local version setup_type pgsm_branch client encrypted minor node
  local tarball='' topology='' nodes=1 base_port=5432 suffix index
  local -a names=()
  version=$(resolved_version PDPGSQL_VERSION PDPGSQL "$DB_VERSION")
  setup_type=$(resolve_value PDPGSQL SETUP_TYPE DB_CONFIG)
  setup_type=${setup_type,,}
  pgsm_branch=$(resolve_value PDPGSQL PGSM_BRANCH DB_CONFIG)
  pgsm_branch=${pgsm_branch,,}
  client=$(resolved_client_version PDPGSQL DB_CONFIG)
  encrypted=$(bool_string "$(resolve_value PDPGSQL ENCRYPTED_CLIENT_CONFIG DB_CONFIG)")
  suffix=$((RANDOM % 9999 + 1))
  case $setup_type in
    '') ;;
    replication) topology=_replication nodes=2 ;;
    patroni) topology=_patroni nodes=3 base_port=6432 ;;
    *) die "PDPGSQL SETUP_TYPE must be empty, replication or patroni (got '$setup_type')." ;;
  esac
  if [[ $encrypted == true && $client == 3.*.* ]]; then
    minor=${client#3.}
    minor=${minor%%.*}
    ((minor >= 7)) || encrypted=false
  fi
  for ((index = 1; index <= nodes; index++)); do
    names+=("pdpgsql_pmm${topology}_${version}_$index")
  done

  step "Prepare image pmm-qa/pdpgsql:$version" ensure_image pdpgsql "$version"
  if [[ $client == http* ]]; then
    tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."
  fi
  step 'Start PostgreSQL nodes' pdpgsql_start
  case $setup_type in
    '') step 'Create the pmm user' each_node names pdpgsql_sql "CREATE ROLE pmm LOGIN PASSWORD 'pmm' IN ROLE pg_monitor;" ;;
    replication) step 'Configure replication' pdpgsql_replication ;;
    patroni) step 'Configure Patroni' pdpgsql_patroni ;;
  esac
  step 'Wait for PMM Server' wait_pmm_server_ready
  step 'Install PMM Client' each_node names install_pmm_client "$client" "$tarball"
  step 'Set up PMM agents' pdpgsql_setup_agents
  step 'Register PostgreSQL with PMM' each_node names pdpgsql_register
  step 'Load data and start the workload' pdpgsql_workload
  for node in "${names[@]}"; do
    report_agent_status "$node"
  done
}

# Usage: pdpgsql_sql NODE SQL [DATABASE]
pdpgsql_sql() {
  must docker exec --user postgres "$1" psql -v ON_ERROR_STOP=1 -qAt -d "${3:-postgres}" -c "$2" >/dev/null
}

pdpgsql_ready() {
  retry 60 "PostgreSQL on $1" docker exec --user postgres "$1" pg_isready -q >/dev/null
}

pdpgsql_restart() {
  must docker exec --user root "$1" systemctl restart "postgresql@$version-main"
  pdpgsql_ready "$1"
}

# Usage: pdpgsql_append_conf NODE LINE...
pdpgsql_append_conf() {
  local node=$1
  shift
  must docker exec --user postgres "$node" sh -c \
    "printf '%s\n' \"\$@\" >>/etc/postgresql/$version/main/postgresql.conf" sh "$@"
}

pdpgsql_start() {
  docker rm -fv "${names[@]}" >/dev/null 2>&1 || true
  ensure_pmm_network
  each_node names pdpgsql_start_node
  pdpgsql_sql "${names[0]}" 'CREATE EXTENSION IF NOT EXISTS pg_stat_monitor;'
  pdpgsql_sql "${names[0]}" "ALTER USER postgres WITH PASSWORD '$PDPGSQL_PASSWORD';"
}

# systemd in the container needs the host's cgroups, as the playbook's did.
pdpgsql_start_node() {
  must docker run --detach --name "$1" --restart=always --label pmm-qa.engine=pdpgsql --network pmm-qa \
    --privileged --cgroupns=host --volume /sys/fs/cgroup:/sys/fs/cgroup:rw \
    --publish "$((base_port + ${1##*_} - 1)):5432" "pmm-qa/pdpgsql:$version" >/dev/null
  pdpgsql_ready "$1"
  if [[ -n $pgsm_branch ]]; then
    retry 3 "pg_stat_monitor build tools on $1" docker exec --user root "$1" sh -c "apt-get update &&
      apt-get install -y git clang-18 llvm-18 build-essential percona-postgresql-server-dev-$version" >/dev/null
    must docker exec --user root "$1" sh -ceu "rm -rf /pg_stat_monitor
      git clone --branch '$pgsm_branch' https://github.com/percona/pg_stat_monitor.git /pg_stat_monitor
      cd /pg_stat_monitor
      make USE_PGXS=1
      make USE_PGXS=1 install" >/dev/null
    pdpgsql_restart "$1"
  fi
}

pdpgsql_replication() {
  local primary=${names[0]}
  local -a replicas=("${names[@]:1}")
  pdpgsql_append_conf "$primary" "${PDPGSQL_PRIMARY_CONF[@]}"
  pdpgsql_restart "$primary"
  pdpgsql_sql "$primary" "CREATE ROLE repl_user WITH REPLICATION LOGIN ENCRYPTED PASSWORD 'GRgrO9301RuF';"
  pdpgsql_sql "$primary" "CREATE ROLE pmm LOGIN PASSWORD 'pmm' IN ROLE pg_monitor;"
  pdpgsql_sql "$primary" 'CREATE DATABASE test_database;'
  pdpgsql_sql "$primary" 'GRANT CONNECT ON DATABASE test_database TO pmm;
    GRANT USAGE ON SCHEMA public TO pmm;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pmm;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pmm;' test_database
  each_node replicas pdpgsql_replica "$primary"
  retry 60 "$primary to stream to ${#replicas[@]} replica(s)" pdpgsql_streaming "$primary" "${#replicas[@]}"
}

# Usage: pdpgsql_replica NODE PRIMARY
pdpgsql_replica() {
  local data=/var/lib/postgresql/$version/main
  must docker exec --user root "$1" systemctl stop postgresql
  must docker exec --user postgres "$1" rm -rf "$data"
  must docker exec --user postgres --env PGPASSWORD=GRgrO9301RuF "$1" timeout 120 \
    pg_basebackup "--pgdata=$data" -R -Fp -Xs --checkpoint=fast "--host=$2" --port=5432 -U repl_user
  pdpgsql_append_conf "$1" "${PDPGSQL_REPLICA_CONF[@]}"
  must docker exec --user root "$1" systemctl start "postgresql@$version-main"
  pdpgsql_ready "$1"
}

# Usage: pdpgsql_streaming PRIMARY COUNT
pdpgsql_streaming() {
  [[ $(docker exec --user postgres "$1" psql -qAt -c "SELECT count(*) FROM pg_stat_replication WHERE state = 'streaming'") == "$2" ]]
}

pdpgsql_patroni() {
  local primary=${names[0]} data=/var/lib/postgresql/$version/main subnet
  local -a replicas=("${names[@]:1}")
  subnet=$(docker network inspect -f '{{(index .IPAM.Config 0).Subnet}}' pmm-qa) ||
    die 'Could not read the pmm-qa network subnet.'
  each_node names pdpgsql_etcd
  must docker exec --user postgres "$primary" sh -c \
    "{ printf '%s\n' \"\$@\"; cat /etc/postgresql/$version/main/postgresql.conf; } >$data/postgresql.conf" \
    sh "${PDPGSQL_PRIMARY_CONF[@]}"
  pdpgsql_sql "$primary" "CREATE ROLE replicator WITH LOGIN REPLICATION PASSWORD 'replPasswd';"
  pdpgsql_sql "$primary" 'GRANT pg_monitor TO postgres;'
  must docker exec --user postgres "$primary" sh -ceu "mkdir -p /var/lib/pgbackrest/archive/patroni_backup
    pgbackrest --stanza=patroni_backup --pg1-path=$data stanza-create" >/dev/null
  each_node names pdpgsql_patroni_start "$subnet"
  retry 120 "Patroni to run all ${#names[@]} members" pdpgsql_patroni_members "$primary" >/dev/null
}

# Write NODE's etcd and Patroni configs, as data/*.j2 render them, and start
# etcd, which Patroni needs all three members of for a quorum.
pdpgsql_etcd() {
  local node=$1 index=${1##*_} cluster='' peer prefix=pdpgsql_pmm_patroni_${version}_
  for peer in "${names[@]}"; do
    cluster+=${cluster:+,}node${peer##*_}=http://$peer:2380
  done
  must docker exec --interactive --user root "$node" sh -c 'cat >/etcd.conf.yaml' <<EOF
name: 'node$index'
data-dir: /var/lib/etcd
initial-cluster-token: PostgreSQL_HA_Cluster_1
initial-cluster-state: new

listen-peer-urls: http://0.0.0.0:2380
initial-advertise-peer-urls: http://$prefix$index:2380

listen-client-urls: http://0.0.0.0:2379
advertise-client-urls: http://$prefix$index:2379

initial-cluster: $cluster
EOF
  must docker exec --user root "$node" sh -ceu "mkdir -p /data/db/logs /pg_wal
    touch /dev/watchdog
    chown -R postgres:postgres /data/db/logs /dev/watchdog /pg_wal"
  must docker exec --detach --user root "$node" sh -c 'exec etcd --config-file /etcd.conf.yaml >/data/db/logs/etcd.log 2>&1'
}

# Usage: pdpgsql_patroni_start NODE SUBNET
pdpgsql_patroni_start() {
  local node=$1 data=/var/lib/postgresql/$version/main
  must docker exec --interactive --user root "$node" sh -c 'cat >/patroni.yml' <<EOF
scope: patroni_cls
namespace: /var/lib/pgsql/config/
name: $node

restapi:
  listen: 0.0.0.0:8008
  connect_address: "$node:8008"

etcd3:
  host: "${names[0]}:2379"

bootstrap:
  dcs:
    ttl: 30
    loop_wait: 10
    retry_timeout: 10
    maximum_lag_on_failover: 1048576

    postgresql:
      use_pg_rewind: true
      use_slots: true
      parameters:
        shared_preload_libraries: 'pg_stat_monitor'
        wal_level: replica
        hot_standby: "on"
        wal_keep_size: 128MB
        max_wal_senders: 10
        max_replication_slots: 10
        wal_log_hints: "on"
        archive_mode: "on"
        archive_timeout: 600s
        archive_command: pgbackrest --stanza=patroni_backup --log-level-console=info archive-push $data/pg_wal/%f
      pg_hba:
        - host replication replicator 127.0.0.1/32 md5
        - host replication replicator $2 md5
        - host all all 0.0.0.0/0 md5
        - local all postgres trust

  initdb:
    - encoding: UTF8
    - data-checksums
    - waldir: /pg_wal
    - wal-segsize=512

  users:
    admin:
      password: admin
      options:
        - createrole
        - createdb

postgresql:
  listen: 0.0.0.0:5432
  connect_address: "$node:5432"
  data_dir: $data
  bin_dir: /usr/lib/postgresql/$version/bin
  pgpass: /tmp/pgpass

  authentication:
    replication:
      username: replicator
      password: replPasswd
    superuser:
      username: postgres
      password: $PDPGSQL_PASSWORD

  create_replica_methods:
    - pgbackrest
    - basebackup

  pgbackrest:
    command: pgbackrest --stanza=patroni_backup restore --pg1-path=$data --type=none
    keep_data: true
    no_params: true

  basebackup:
    checkpoint: fast

tags:
  nofailover: false
  noloadbalance: false
  clonefrom: false
  nosync: false
EOF
  must docker exec --user root "$node" systemctl stop postgresql
  if [[ $node != "${names[0]}" ]]; then
    must docker exec --user postgres "$node" rm -rf "$data"
  fi
  must docker exec --detach --user postgres "$node" sh -c 'exec patroni /patroni.yml >>/data/db/logs/patroni.log 2>&1'
}

# Stdout: `patronictl list` once all members run, the leader being PRIMARY
pdpgsql_patroni_members() {
  local list
  list=$(docker exec "$1" patronictl -c /patroni.yml list 2>&1) || return 1
  (($(grep -cE '\| (running|streaming) +\|' <<<"$list") == ${#names[@]})) &&
    grep -qE "\| $1 +\|[^|]*\| Leader +\|" <<<"$list" &&
    printf '%s\n' "$list"
}

pdpgsql_setup_agents() {
  local node
  for node in "${names[@]}"; do
    setup_pmm_agent "$node" "$encrypted" /var/log/pmm-agent.log "$node${SHARD_NAME:+-$SHARD_NAME}"
    wait_pmm_agent "$node"
  done
}

pdpgsql_register() {
  local node=$1 index=${1##*_}
  local -a add=(pmm-admin add postgresql --query-source=pgstatmonitor --username=pmm --password=pmm)
  case $setup_type in
    replication) add+=(--cluster=pdpgsql_replication_cluster --environment=pdpgsql_replication_environment) ;;
    patroni)
      add=(pmm-admin add postgresql --query-source=pgstatmonitor --username=postgres "--password=$PDPGSQL_PASSWORD"
        --cluster=pdpgsql_patroni_cluster --environment=pdpgsql_patroni_environment)
      ;;
  esac
  pg_add "$node" "${add[@]}" "${node}_$suffix" --debug 127.0.0.1:5432
  case $setup_type in
    '') pg_add "$node" "${add[@]}" --socket=/var/run/postgresql "socket_${node}_$suffix" ;;
    patroni)
      if ((index == 1)); then
        pg_add "$node" pmm-admin add external --listen-port=8008 "--service-name=patroni_service_1_$suffix"
      else
        pg_add "$node" pmm-admin add external --listen-port=8008 --cluster=pdpgsql_patroni_service_cluster \
          --environment=pdpgsql_patroni_service_environment "--service-name=patroni_service_${index}_$suffix"
      fi
      ;;
  esac
  wait_exporter "$node" postgres_exporter
  wait_node_exporter "$node" /var/log/pmm-agent.log
}

# Usage: pg_add NODE PMM_ADMIN_ARGS...
pg_add() {
  local node=$1
  shift
  retry_on 'pmm-agent is not connected|context deadline exceeded' 60 "registering on $node" \
    docker exec "$node" "$@" >/dev/null
}

# The school database everywhere the playbook loaded it, plus each topology's
# own load, left running as the playbook left it.
pdpgsql_workload() {
  local primary=${names[0]} data=$PMM_QA_ROOT/percona-distribution-postgresql/data node
  local -a loaded=("$primary")
  if [[ -z $setup_type ]]; then
    loaded=("${names[@]}")
  fi
  for node in "${loaded[@]}"; do
    must docker cp "$data/pgsql_load.sql" "$node:/pgsql_load.sql"
    pdpgsql_sql "$node" 'CREATE DATABASE school;'
    must docker exec --user postgres "$node" psql -v ON_ERROR_STOP=1 -q -d school -f /pgsql_load.sql >/dev/null
  done
  case $setup_type in
    '')
      for node in "${names[@]}"; do
        must docker cp "$data/pdpgsql_run_queries.sh" "$node:/pdpgsql_run_queries.sh"
        must docker exec --detach "$node" bash /pdpgsql_run_queries.sh
      done
      ;;
    replication)
      pdpgsql_sql "$primary" 'CREATE OR REPLACE VIEW pg_custom_publication AS
        SELECT pubname, puballtables, pubinsert, pubupdate, pubdelete FROM pg_publication;'
      must docker cp "$PMM_QA_ROOT/data/load_pgsql.sql" "$primary:/load_pgsql.sql"
      # shellcheck disable=SC2016 # expanded by the container's shell
      must docker exec --detach "$primary" sh -c 'while true; do
          echo "Starting insert at $(date "+%Y-%m-%d %H:%M:%S")"
          psql -U postgres -d test_database -f /load_pgsql.sql
          sleep 30
        done >/tmp/sql_loop.log 2>&1'
      pdpgsql_sql "$primary" "SELECT * FROM pg_create_logical_replication_slot('test_slot', 'test_decoding');"
      ;;
  esac
}

# Percona Distribution for PostgreSQL with TLS on pmm-qa/ssl-pdpgsql
# (images/ssl-pdpgsql). Keeps tls-ssl-setup/postgresql_tls_setup.yml's end
# state: the container on its own network plus pmm-qa, certificates made in
# the container and copied to tls-ssl-setup/postgres/<version>/ for the tests,
# and a pg_stat_statements service registered over TLS.
setup_ssl_pdpgsql() {
  local version client container tarball='' suffix=$((RANDOM % 10000))
  version=$(resolved_version PDPGSQL_VERSION SSL_PDPGSQL "$DB_VERSION")
  client=$(resolved_client_version SSL_PDPGSQL DB_CONFIG)
  container=pdpgsql_pgsm_ssl_$version

  step "Prepare image pmm-qa/ssl-pdpgsql:$version" ensure_image ssl-pdpgsql "$version"
  if [[ $client == http* ]]; then
    tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."
  fi
  step 'Start PostgreSQL with TLS' ssl_pdpgsql_start
  step 'Wait for PMM Server' wait_pmm_server_ready
  step 'Install PMM Client' install_pmm_client "$container" "$client" "$tarball"
  step 'Set up PMM agent' setup_pmm_agent "$container" false /pmm-agent.log "$container${SHARD_NAME:+-$SHARD_NAME}"
  step 'Wait for pmm-agent' wait_pmm_agent "$container"
  pg_add "$container" pmm-admin add postgresql --username=pmm --password=pmm --query-source=pgstatements --tls \
    --tls-ca-file=./certificates/ca.crt --tls-cert-file=./certificates/client.crt \
    --tls-key-file=./certificates/client.pem "${container}_ssl_service$suffix"
  wait_exporter "$container" postgres_exporter
  wait_node_exporter "$container" /pmm-agent.log
  step 'Copy the client certificates to the host' ssl_pdpgsql_certs
  report_agent_status "$container"
}

ssl_pdpgsql_start() {
  local data=/var/lib/postgresql/$version/main
  docker rm -fv "$container" >/dev/null 2>&1 || true
  docker network rm "${container}_network" >/dev/null 2>&1 || true
  must docker network create "${container}_network" >/dev/null
  ensure_pmm_network
  must docker run --detach --name "$container" --label pmm-qa.engine=ssl-pdpgsql --network "${container}_network" \
    "pmm-qa/ssl-pdpgsql:$version" >/dev/null
  must docker network connect pmm-qa "$container"
  # pmm-admin reads the certificates as ./certificates from the exec's working
  # directory, /.
  must docker exec "$container" sh -ceu "cd /artifacts
    bash create_certs.sh >/dev/null 2>&1
    ln -sfn /artifacts/certificates /certificates
    cp -a /artifacts/certificates/. $data/
    chown -R postgres:postgres $data
    chmod -R 0700 $data
    service postgresql start" >/dev/null
  pdpgsql_ready "$container"
}

ssl_pdpgsql_certs() {
  local dir=$PMM_QA_ROOT/tls-ssl-setup/postgres/$version file
  must mkdir -p "$dir"
  for file in ca.crt client.crt client.pem; do
    must docker cp "$container:/artifacts/certificates/$file" "$dir/$file"
  done
}

# Upstream PostgreSQL, monitored through pg_stat_statements. The default is
# pgsql_pgss_setup.yml's single node on pmm-qa/pgsql (images/pgsql);
# SETUP_TYPE=replication is postgresql/postgresql-setup.yml's primary and
# replica on the official postgres image, which needs nothing baked in.
setup_pgsql() {
  local version setup_type client encrypted minor tarball='' suffix=$((RANDOM % 10000))
  version=$(resolved_version PGSQL_VERSION PGSQL "$DB_VERSION")
  setup_type=$(resolve_value PGSQL SETUP_TYPE DB_CONFIG)
  setup_type=${setup_type,,}
  client=$(resolved_client_version PGSQL DB_CONFIG)
  encrypted=$(bool_string "$(resolve_value PGSQL ENCRYPTED_CLIENT_CONFIG DB_CONFIG)")
  if [[ $encrypted == true && $client == 3.*.* ]]; then
    minor=${client#3.}
    minor=${minor%%.*}
    ((minor >= 7)) || encrypted=false
  fi
  case $setup_type in
    '') ;;
    replication) ;;
    *) die "PGSQL SETUP_TYPE must be empty or replication (got '$setup_type')." ;;
  esac
  if [[ $client == http* ]]; then
    tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."
  fi
  if [[ -z $setup_type ]]; then
    pgsql_pgss
  else
    pgsql_replication
  fi
}

# Only the replication playbook read ENCRYPTED_CLIENT_CONFIG.
pgsql_pgss() {
  local container=pgsql_pgss_pmm_$version
  step "Prepare image pmm-qa/pgsql:$version" ensure_image pgsql "$version"
  step 'Start PostgreSQL' pgsql_pgss_start
  step 'Wait for PMM Server' wait_pmm_server_ready
  step 'Install PMM Client' install_pmm_client "$container" "$client" "$tarball"
  step 'Set up PMM agent' setup_pmm_agent "$container" false /pmm-agent.log "$container${SHARD_NAME:+-$SHARD_NAME}"
  step 'Wait for pmm-agent' wait_pmm_agent "$container"
  pg_add "$container" pmm-admin add postgresql --username=pmm --password=pmm --query-source=pgstatements \
    "${container}_service_$suffix"
  wait_exporter "$container" postgres_exporter
  wait_node_exporter "$container" /pmm-agent.log
  must docker exec --detach "$container" bash /pgsm_run_queries.sh
  report_agent_status "$container"
}

pgsql_pgss_start() {
  docker rm -fv "$container" >/dev/null 2>&1 || true
  ensure_pmm_network
  must docker run --detach --name "$container" --label pmm-qa.engine=pgsql --network pmm-qa \
    --publish 5448:5432 "pmm-qa/pgsql:$version" >/dev/null
  must docker exec "$container" service postgresql start >/dev/null
  pdpgsql_ready "$container"
}

pgsql_replication() {
  local image=postgres:$version-bookworm node
  local -a names=("pgsql_pmm_${version}_1" "pgsql_pmm_${version}_2")
  step 'Start the primary and its replica' pgsql_replication_start
  step 'Wait for PMM Server' wait_pmm_server_ready
  step 'Install PMM Client' each_node names install_pmm_client "$client" "$tarball"
  step 'Set up PMM agents' pdpgsql_setup_agents
  step 'Register PostgreSQL with PMM' each_node names pgsql_register
  # pgbench runs detached: the playbook waited out its 120 s.
  must docker exec --detach --user postgres "${names[0]}" sh -c \
    'pgbench -i -s 1000 pgbench && pgbench -c 10 -T 120 -j 4 pgbench >/tmp/pgbench.log 2>&1'
  for node in "${names[@]}"; do
    report_agent_status "$node"
  done
}

pgsql_replication_start() {
  local conf=$PMM_QA_ROOT/postgresql/data hba=${XDG_CACHE_HOME:-$HOME/.cache}/pmm-framework/pgsql_pg_hba.conf
  local primary=${names[0]} replica=${names[1]}
  docker rm -fv "${names[@]}" >/dev/null 2>&1 || true
  ensure_pmm_network
  must mkdir -p "${hba%/*}"
  printf '%s\n' 'host    replication     repl_user      0.0.0.0/0       md5' \
    'host    all             all             0.0.0.0/0       md5' \
    'local   all             postgres                        trust' >"$hba" || die "Could not write $hba."
  must docker run --detach --name "$primary" --restart=always --label pmm-qa.engine=pgsql --network pmm-qa \
    --env POSTGRES_PASSWORD=GRgrO9301RuF --volume "$conf/postgresql-primary.conf:/etc/postgresql/postgresql.conf:ro" \
    --volume "$hba:/etc/postgresql/pg_hba.conf:ro" --publish 6432:5432 \
    "$image" -c config_file=/etc/postgresql/postgresql.conf >/dev/null
  # Over TCP: the entrypoint's first-boot server listens on the socket only.
  retry 120 "PostgreSQL on $primary" docker exec --user postgres "$primary" pg_isready -q -h 127.0.0.1 >/dev/null
  pdpgsql_sql "$primary" "CREATE ROLE repl_user WITH REPLICATION LOGIN ENCRYPTED PASSWORD 'GRgrO9301RuF';"
  pdpgsql_sql "$primary" "CREATE USER pmm WITH PASSWORD 'pmm'; GRANT pg_monitor TO pmm;"
  pdpgsql_sql "$primary" 'CREATE DATABASE pgbench;'
  pdpgsql_sql "$primary" 'GRANT CONNECT ON DATABASE pgbench TO pmm;
    GRANT USAGE ON SCHEMA public TO pmm;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pmm;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pmm;' pgbench
  # The replica clones the primary into its own PGDATA before its first start,
  # so it needs no host data directory.
  # shellcheck disable=SC2016 # expanded by the container's shell
  must docker run --detach --name "$replica" --label pmm-qa.engine=pgsql --network pmm-qa \
    --env POSTGRES_PASSWORD=GRgrO9301RuF --volume "$conf/postgres-replica.conf:/etc/postgresql/postgresql.conf:ro" \
    --volume "$hba:/etc/postgresql/pg_hba.conf:ro" --publish 6433:5432 --entrypoint bash "$image" -ceu \
    'mkdir -p "$PGDATA" && chown postgres "$PGDATA"
     gosu postgres env PGPASSWORD=GRgrO9301RuF pg_basebackup "--pgdata=$PGDATA" -R -Fp -Xs --checkpoint=fast \
       "--host=$0" --port=5432 -U repl_user
     exec docker-entrypoint.sh postgres -c config_file=/etc/postgresql/postgresql.conf' "$primary" >/dev/null
  retry 120 "PostgreSQL on $replica" docker exec --user postgres "$replica" pg_isready -q -h 127.0.0.1 >/dev/null
  retry 60 "$primary to stream to $replica" pdpgsql_streaming "$primary" 1
  pdpgsql_sql "$primary" 'CREATE EXTENSION IF NOT EXISTS pg_stat_statements;'
}

# The playbook suffixed a service name only when the server already had it.
pgsql_register() {
  local out
  local -a add=(pmm-admin add postgresql --username=pmm --password=pmm --query-source=pgstatements)
  if ! out=$(docker exec "$1" "${add[@]}" "$1" --debug 127.0.0.1:5432 2>&1); then
    [[ $out == *'already exists'* ]] || die "Registering $1 failed: $out"
    pg_add "$1" "${add[@]}" "${1}_$suffix" --debug 127.0.0.1:5432
  fi
  wait_exporter "$1" postgres_exporter
  wait_node_exporter "$1" /var/log/pmm-agent.log
}
