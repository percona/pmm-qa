#!/usr/bin/env bash
#
# images/mysql/setup.sh -- PS, MYSQL and SSL_MYSQL, on the prebaked ps and mysql images.

# Percona Server for MySQL, on the prebaked pmm-qa/ps image.
setup_ps() {
  setup_mysql_family ps PS PS_VERSION
}

# Upstream MySQL, on the prebaked pmm-qa/mysql image. Unlike PS it registers
# no NODES_COUNT, MY_ROCKS or BACKUP.
setup_mysql() {
  setup_mysql_family mysql MYSQL MS_VERSION
}

# Provision ENGINE (ps or mysql) on its prebaked image (lib/prebaked.sh).
#
# SETUP_TYPE selects the topology ('' single, replication, gr); the node count
# is raised to the topology's minimum. Container names, host ports, PMM service
# names and labels match what the old Ansible setups produced, because tests look them up.
#
# The mf_* helpers below read this function's locals through bash's dynamic
# scoping.
setup_mysql_family() {
  local engine=$1 type=$2 version_env=$3
  local version setup_type client nodes=1 query_source my_rocks=false backup=false encrypted
  local topology='' tarball='' password=GRgrO9301RuF suffix index minor base_port
  local -a names=() targets=()
  version=$(resolved_version "$version_env" "$type" "$DB_VERSION")
  setup_type=$(resolve_value "$type" SETUP_TYPE DB_CONFIG)
  setup_type=${setup_type,,}
  client=$(resolved_client_version "$type" DB_CONFIG)
  query_source=$(resolve_value "$type" QUERY_SOURCE DB_CONFIG)
  encrypted=$(bool_string "$(resolve_value "$type" ENCRYPTED_CLIENT_CONFIG DB_CONFIG)")
  if [[ $engine == ps ]]; then
    nodes=$(resolve_value PS NODES_COUNT DB_CONFIG)
    my_rocks=$(bool_string "$(resolve_value PS MY_ROCKS DB_CONFIG)")
    backup=$(bool_string "$(resolve_value PS BACKUP DB_CONFIG)")
  fi
  suffix=$(((RANDOM << 15 | RANDOM) % 100000 + 1))

  [[ $nodes =~ ^[1-9][0-9]*$ ]] || die "$type NODES_COUNT must be a positive integer (got '$nodes')."
  case $setup_type in
    '') ;;
    replication) topology=_replication nodes=$((nodes < 2 ? 2 : nodes)) ;;
    gr) topology=_gr nodes=$((nodes < 3 ? 3 : nodes)) ;;
    *) die "$type SETUP_TYPE must be empty, replication or gr (got '$setup_type')." ;;
  esac
  if [[ $backup == true && $version == 9.7 ]]; then
    die 'PS 9.7 does not support BACKUP=true: no compatible Percona XtraBackup is published.'
  fi
  if [[ $encrypted == true && $client == 3.*.* ]]; then
    minor=${client#3.}
    minor=${minor%%.*}
    ((minor >= 7)) || encrypted=false
  fi

  for ((index = 1; index <= nodes; index++)); do
    names+=("${engine}_pmm${topology}_${version//./_}_$index")
  done
  if [[ -z $setup_type ]]; then
    targets=("${names[@]}")
  else
    targets=("${names[0]}")
  fi

  step "Prepare image pmm-qa/$engine:$version" ensure_image "$engine" "$version"
  if [[ $client == http* ]]; then
    tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."
  fi
  step 'Clean previous run' mf_cleanup
  base_port=$(mf_first_free_port) || die 'Could not list the published host ports.'
  step 'Start database nodes' each_node names mf_start_node
  case $setup_type in
    replication) step 'Configure replication' mf_configure_replication ;;
    gr) step 'Configure group replication' mf_configure_group_replication ;;
  esac
  if [[ $query_source == slowlog ]]; then
    step 'Enable the slow query log' each_node names mf_enable_slowlog
  fi
  if [[ $my_rocks == true ]]; then
    step 'Check MyRocks' each_node names mf_check_myrocks
  fi
  if [[ $backup == true ]]; then
    step 'Start MinIO for backups' mf_start_minio
  fi
  step 'Wait for PMM Server' wait_pmm_server_ready
  step 'Install PMM Client' each_node names install_pmm_client "$client" "$tarball"
  # One registration at a time: a freshly ready pmm-managed answers concurrent
  # ones with a bare 'Internal server error'.
  step 'Set up PMM agents' mf_setup_agents
  step 'Register MySQL with PMM' each_node names mf_register
  # As the playbooks do on every node: tests write through whichever container
  # `docker ps` lists first, which can be a group-replication secondary.
  step 'Clear read-only' each_node names mf_sql 'SET GLOBAL super_read_only=OFF; SET GLOBAL read_only=OFF;'
  step 'Run workload' each_node targets mf_workload
  for index in "${names[@]}"; do
    report_agent_status "$index"
  done
}

mf_sql() {
  docker exec -e "MYSQL_PWD=$password" "$1" mysql -uroot --batch --skip-column-names -e "$2" ||
    die "SQL failed on $1: ${2:0:80}"
}

mf_cleanup() {
  local ids agent_ids volumes prefix=${engine}_pmm${topology}_${version//./_}_
  ids=$(docker ps -aq --filter "name=^$prefix") || die 'docker ps failed.'
  agent_ids=$(docker ps -a --filter label=pmm-qa.engine=pmm-agent --format '{{.ID}} {{.Label "pmm-qa.parent"}}') ||
    die 'docker ps failed.'
  ids+=${ids:+$'\n'}$(awk -v p="$prefix" 'index($2, p) == 1 { print $1 }' <<<"$agent_ids")
  if [[ -n $ids ]]; then
    # shellcheck disable=SC2086 # one id per word
    must docker rm -fv $ids >/dev/null
  fi
  volumes=$(docker volume ls -q --filter "name=^$prefix") || die 'docker volume ls failed.'
  if [[ -n $volumes ]]; then
    # shellcheck disable=SC2086 # one volume per word
    must docker volume rm -f $volumes >/dev/null
  fi
  ensure_pmm_network
}

# The first host port from 3306 with room for every node after it, as
# the old Ansible setup picked it, so a second topology on the same
# host does not collide with the ports the first one published.
# Stdout: the base port
mf_first_free_port() {
  local published port=3306 offset taken
  published=$(docker ps --format '{{.Ports}}') || return 1
  while :; do
    taken=false
    for ((offset = 0; offset < nodes; offset++)); do
      if [[ $published == *":$((port + offset))->"* ]]; then
        taken=true
        break
      fi
    done
    if [[ $taken == false ]]; then
      break
    fi
    port=$((port + offset + 1))
  done
  printf '%s' "$port"
}

mf_start_node() {
  local name=$1 node=${1##*_} seed seeds=''
  # Root, as the playbooks' containers were: tests `docker exec` without --user
  # and read pmm-agent's root-owned config. mysqld itself still runs as mysql.
  local -a run=(
    docker run --detach --name "$name" --hostname "$name" --user root
    --label "pmm-qa.engine=$engine" --label "pmm-qa.$engine.setup-type=${setup_type:-single}"
    --network pmm-qa --env "MYSQL_ROOT_PASSWORD=$password"
    --volume "${name}_pmm:/usr/local/percona/pmm" --volume "${name}_tmp:/tmp"
  )
  # As the old Ansible setup: the host reaches node N's socket at
  # /tmp/mysql-sockets/N/mysql.sock, which the CLI socket tests use.
  if [[ $engine == mysql ]]; then
    must docker run --rm --volume /tmp:/host-tmp "$BUSYBOX_IMAGE" sh -c "
      rm -rf /host-tmp/mysql-sockets/$node && mkdir -p /host-tmp/mysql-sockets/$node &&
      chmod 0777 /host-tmp/mysql-sockets/$node && ln -s mysqld.sock /host-tmp/mysql-sockets/$node/mysql.sock"
    run+=(--volume "/tmp/mysql-sockets/$node:/var/run/mysqld")
  fi
  # As in the playbooks: node N on host port base+N-1, except PS 5.7, which has none.
  if [[ $engine != ps || $version != 5.7 ]]; then
    run+=(--publish "$((base_port + node - 1)):3306")
  fi
  if [[ $my_rocks == true ]]; then
    run+=(--env INIT_ROCKSDB=1)
  fi
  run+=(
    "pmm-qa/$engine:$version" "--server-id=$node" "--report-host=$name"
    --bind-address=0.0.0.0 --max-connections=1000 --innodb-buffer-pool-size=256M
    --innodb-monitor-enable=all --user=mysql
  )
  if [[ $engine == ps ]]; then
    run+=(--userstat=1)
  fi
  # The playbook's my.cnf loads native password auth below 9.x; only 8.4 ships it off.
  if [[ $version == 8.4 ]]; then
    run+=(--mysql-native-password=ON)
  fi
  if [[ -n $setup_type ]]; then
    run+=(
      --gtid-mode=ON --enforce-gtid-consistency=ON --log-bin=binlog --binlog-checksum=NONE
      "--relay-log=$name-relay-bin" --relay-log-recovery=ON
    )
    if [[ $version == 5.7 ]]; then
      run+=(--log-slave-updates=ON)
    else
      run+=(--log-replica-updates=ON)
    fi
  fi
  if [[ $setup_type == gr ]]; then
    for seed in "${names[@]}"; do
      seeds+=${seeds:+,}$seed:34061
    done
    if [[ $version == 5.7 ]]; then
      run+=(
        --binlog-format=ROW --master-info-repository=TABLE --relay-log-info-repository=TABLE
        --transaction-write-set-extraction=XXHASH64
      )
    else
      run+=(--loose-group-replication-recovery-get-public-key=ON)
    fi
    run+=(
      --plugin-load-add=group_replication.so
      --loose-group-replication-group-name=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
      "--loose-group-replication-local-address=$name:34061"
      "--loose-group-replication-group-seeds=$seeds"
      --loose-group-replication-communication-stack=XCOM
      --loose-group-replication-start-on-boot=OFF
      --loose-group-replication-bootstrap-group=OFF
      --loose-group-replication-single-primary-mode=ON
      --loose-group-replication-enforce-update-everywhere-checks=OFF
      --loose-group-replication-recovery-retry-count=10
      --loose-group-replication-recovery-reconnect-interval=60
    )
  fi
  must "${run[@]}" >/dev/null
  if ! (retry 60 "$name to accept MySQL connections" docker exec "$name" mysqladmin ping \
    --host=127.0.0.1 --protocol=tcp -uroot "-p$password" --silent >/dev/null); then
    docker logs --tail 40 "$name" >&2 || true
    die "$name did not start."
  fi
}

mf_replica_running() {
  local status field=Replica statement='SHOW REPLICA STATUS'
  if [[ $version == 5.7 ]]; then
    field=Slave statement='SHOW SLAVE STATUS'
  fi
  status=$(docker exec -e "MYSQL_PWD=$password" "$1" mysql -uroot --vertical -e "$statement") || return 1
  [[ $status == *"${field}_IO_Running: Yes"* && $status == *"${field}_SQL_Running: Yes"* ]]
}

mf_start_replica() {
  if [[ $version == 5.7 ]]; then
    mf_sql "$1" "CHANGE MASTER TO MASTER_HOST='${names[0]}', MASTER_PORT=3306,
      MASTER_USER='repl_user', MASTER_PASSWORD='$password', MASTER_AUTO_POSITION=1; START SLAVE;"
  else
    mf_sql "$1" "CHANGE REPLICATION SOURCE TO SOURCE_HOST='${names[0]}', SOURCE_PORT=3306,
      SOURCE_USER='repl_user', SOURCE_PASSWORD='$password', SOURCE_AUTO_POSITION=1,
      GET_SOURCE_PUBLIC_KEY=1; START REPLICA;"
  fi
  retry 60 "$1 replication threads" mf_replica_running "$1" >/dev/null
}

mf_configure_replication() {
  local -a replicas=("${names[@]:1}")
  mf_sql "${names[0]}" "CREATE USER IF NOT EXISTS 'repl_user'@'%' IDENTIFIED BY '$password';
    GRANT REPLICATION SLAVE ON *.* TO 'repl_user'@'%';"
  each_node replicas mf_start_replica
  mf_seed_testdb
}

# The upstream mysql image logs its first-boot user setup, and a member carrying
# GTIDs the group lacks is refused (ERROR 3092), so each member starts clean, as
# in the playbooks.
mf_prepare_gr_member() {
  local grants reset='RESET MASTER;'
  if [[ $version != 5.7 && $version != 8.0 ]]; then
    reset='RESET BINARY LOGS AND GTIDS;'
  fi
  if [[ $version == 5.7 ]]; then
    grants="GRANT REPLICATION SLAVE ON *.* TO 'repl_user'@'%';
      CHANGE MASTER TO MASTER_USER='repl_user', MASTER_PASSWORD='$password'
        FOR CHANNEL 'group_replication_recovery';"
  else
    grants="GRANT REPLICATION SLAVE, CONNECTION_ADMIN, BACKUP_ADMIN, GROUP_REPLICATION_STREAM,
        SERVICE_CONNECTION_ADMIN, SYSTEM_VARIABLES_ADMIN ON *.* TO 'repl_user'@'%';
      CHANGE REPLICATION SOURCE TO SOURCE_USER='repl_user', SOURCE_PASSWORD='$password'
        FOR CHANNEL 'group_replication_recovery';"
  fi
  mf_sql "$1" "$reset SET SQL_LOG_BIN=0;
    CREATE USER IF NOT EXISTS 'repl_user'@'%' IDENTIFIED BY '$password';
    $grants
    SET SQL_LOG_BIN=1;"
}

mf_gr_online() {
  [[ $(mf_sql "${names[0]}" "SELECT COUNT(*) FROM performance_schema.replication_group_members
    WHERE MEMBER_STATE='ONLINE';") == "${#names[@]}" ]]
}

mf_configure_group_replication() {
  local -a members=("${names[@]:1}")
  each_node names mf_prepare_gr_member
  mf_sql "${names[0]}" 'SET GLOBAL group_replication_bootstrap_group=ON;
    START GROUP_REPLICATION; SET GLOBAL group_replication_bootstrap_group=OFF;'
  each_node members mf_sql 'START GROUP_REPLICATION;'
  retry 120 "${#names[@]} online GR members" mf_gr_online >/dev/null
  mf_seed_testdb
}

mf_has_test_row() {
  [[ $(mf_sql "$1" 'SELECT COUNT(*) FROM testdb.testdb WHERE id=1;') == 1 ]]
}

mf_wait_test_row() {
  retry 60 "test row on $1" mf_has_test_row "$1" >/dev/null
}

mf_seed_testdb() {
  local -a replicas=("${names[@]:1}")
  mf_sql "${names[0]}" "CREATE DATABASE IF NOT EXISTS testdb;
    CREATE TABLE IF NOT EXISTS testdb.testdb (id INT PRIMARY KEY, data VARCHAR(100));
    INSERT INTO testdb.testdb VALUES (1, 'Initial data from node mysql1')
      ON DUPLICATE KEY UPDATE data=VALUES(data);"
  each_node replicas mf_wait_test_row
}

mf_enable_slowlog() {
  local replica_statements=log_slow_replica_statements rate_limit=''
  if [[ $version == 5.7 ]]; then
    replica_statements=log_slow_slave_statements
  fi
  # log_slow_rate_limit is a Percona Server variable.
  if [[ $engine == ps ]]; then
    rate_limit='SET GLOBAL log_slow_rate_limit=1;'
  fi
  mf_sql "$1" "SET GLOBAL slow_query_log=ON; SET GLOBAL long_query_time=0; $rate_limit
    SET GLOBAL log_slow_admin_statements=ON; SET GLOBAL $replica_statements=ON;"
}

mf_check_myrocks() {
  [[ $(mf_sql "$1" "SELECT COUNT(*) FROM information_schema.engines
    WHERE engine='ROCKSDB' AND support IN ('YES', 'DEFAULT');") == 1 ]] ||
    die "MyRocks is not enabled on $1."
}

# Same container, volume, ports and buckets as the old Ansible setup.
mf_start_minio() {
  local bucket
  docker rm -fv minio >/dev/null 2>&1 || true
  docker volume rm -f minio_backups >/dev/null 2>&1 || true
  must docker run --detach --name minio --network pmm-qa --volume minio_backups:/backups \
    --publish 9010:9000 --publish 9001:9001 \
    --env MINIO_ROOT_USER=minio1234 --env MINIO_ROOT_PASSWORD=minio1234 \
    pgsty/minio:RELEASE.2026-08-04T00-00-00Z server /backups --address 0.0.0.0:9000 --console-address 0.0.0.0:9001 >/dev/null
  retry 60 MinIO docker exec minio mc alias set myminio http://127.0.0.1:9000 minio1234 minio1234 >/dev/null
  local -a buckets=()
  IFS=, read -ra buckets <<<"${BUCKETS:-bcp}"
  for bucket in "${buckets[@]}"; do
    must docker exec minio mc mb --ignore-existing "myminio/$bucket" >/dev/null
  done
}

mf_setup_agents() {
  local name agent
  for name in "${names[@]}"; do
    # Tests find the database container by grepping container names for ps,
    # ps_pmm or mysql_pmm, so the companion's name must contain none of them.
    agent=nomad_agent_$(cksum <<<"$name" | cut -d' ' -f1)
    must docker run --detach --name "$agent" --user root \
      --label pmm-qa.engine=pmm-agent --label "pmm-qa.parent=$name" \
      --network "container:$name" --pid "container:$name" --volumes-from "$name" \
      "${NOMAD_CGROUPS[@]}" --entrypoint sleep "pmm-qa/$engine:$version" infinity >/dev/null
    must docker exec --user root "$agent" sh -c \
      'ln -sf /usr/local/percona/pmm/bin/pmm-admin /usr/local/bin/pmm-admin
       ln -sf /usr/local/percona/pmm/bin/pmm-agent /usr/local/bin/pmm-agent'
    setup_pmm_agent "$name" "$encrypted" /tmp/pmm-agent.log "$name" "$agent"
  done
  each_node names wait_pmm_agent
}

mf_register() {
  local -a add=(pmm-admin add mysql "--query-source=$query_source" --username=root "--password=$password")
  case $setup_type in
    gr)
      add+=("--environment=$engine-gr-dev" "--cluster=$engine-gr-dev-cluster")
      add+=("--replication-set=$engine-gr-replication")
      ;;
    replication)
      add+=("--environment=$engine-replication-dev" "--cluster=$engine-replication-dev-cluster")
      add+=("--replication-set=$engine-async-replication")
      ;;
    *) add+=("--environment=$engine-dev" "--cluster=$engine-single-dev-cluster") ;;
  esac
  retry_on 'pmm-agent is not connected|context deadline exceeded' 60 "registering $1" \
    docker exec "$1" "${add[@]}" --debug "${1}_$suffix" 127.0.0.1:3306 >/dev/null
  wait_exporter "$1" mysqld_exporter
  wait_node_exporter "$1" /tmp/pmm-agent.log
}

# sysbench runs detached, so the setup does not wait out its run (30 s for PS,
# 60 s for MySQL, as in the playbooks); the rc check at the end only catches a
# workload that already failed.
mf_workload() {
  local seconds=30
  if [[ $engine == mysql ]]; then
    seconds=60
  fi
  local sysbench='sysbench /usr/share/sysbench/oltp_read_write.lua --mysql-host=127.0.0.1
    --mysql-port=3306 --mysql-user=sbtest --mysql-password=password --mysql-db=sbtest
    --tables=10 --table-size=100000'
  mf_sql "$1" "CREATE DATABASE IF NOT EXISTS sbtest;
    CREATE USER IF NOT EXISTS 'sbtest'@'localhost' IDENTIFIED BY 'password';
    GRANT ALL PRIVILEGES ON *.* TO 'sbtest'@'localhost';
    CREATE USER IF NOT EXISTS 'sbtest'@'127.0.0.1' IDENTIFIED BY 'password';
    GRANT ALL PRIVILEGES ON *.* TO 'sbtest'@'127.0.0.1';
    FLUSH PRIVILEGES;"
  must docker exec "$1" sh -c 'echo running > /tmp/workload.rc'
  must docker exec --detach "$1" sh -c "{ ${sysbench//$'\n'/ } --threads=10 prepare &&
    ${sysbench//$'\n'/ } --threads=16 --time=$seconds run; } > /tmp/workload.log 2>&1
    echo \$? > /tmp/workload.rc"
  mf_sql "$1" 'CREATE DATABASE IF NOT EXISTS school;'
  docker exec -i -e "MYSQL_PWD=$password" "$1" mysql -uroot school <"$FRAMEWORK_DIR/images/mysql/mysql_load.sql" >/dev/null ||
    die "Loading the school schema into $1 failed."
  # shellcheck disable=SC2016 # expanded by the container's shell
  must docker exec "$1" sh -c 'rc=$(cat /tmp/workload.rc)
    [ "$rc" = running ] || [ "$rc" = 0 ] || { tail -20 /tmp/workload.log; exit 1; }'
}

# Percona Server requiring TLS, on the prebaked pmm-qa/ps image, with
# the old Ansible setup's end state: mysql_ssl_VERSION with its my.cnf
# settings, users pmm/pmm and X509-only pmm_tls, registered over TLS
# with mysqld's own certificates, which tests read from
# tls-ssl-setup/mysql/VERSION/ on the host.
setup_ssl_mysql() {
  local version client tarball='' container password=GRgrO9301RuF suffix=$((RANDOM % 10000))
  version=$(resolved_version MS_VERSION SSL_MYSQL "$DB_VERSION")
  client=$(resolved_client_version SSL_MYSQL DB_CONFIG)
  container=mysql_ssl_$version
  step "Prepare image pmm-qa/ps:$version" ensure_image ps "$version"
  if [[ $client == http* ]]; then
    tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."
  fi
  step 'Start mysqld' ssl_mysql_start
  step 'Wait for PMM Server' wait_pmm_server_ready
  step 'Install PMM Client' install_pmm_client "$container" "$client" "$tarball"
  step 'Set up PMM agent' setup_pmm_agent "$container" false /pmm-agent.log "$container${SHARD_NAME:+-$SHARD_NAME}"
  step 'Wait for pmm-agent' wait_pmm_agent "$container"
  retry_on 'pmm-agent is not connected|context deadline exceeded' 60 "registering ${container}_ssl_service_$suffix" \
    docker exec "$container" pmm-admin add mysql --username=pmm --password=pmm --query-source=perfschema --tls \
    --tls-skip-verify --tls-ca=/var/lib/mysql/ca.pem --tls-cert=/var/lib/mysql/client-cert.pem \
    --tls-key=/var/lib/mysql/client-key.pem "${container}_ssl_service_$suffix" >/dev/null
  wait_exporter "$container" mysqld_exporter
  wait_node_exporter "$container" /pmm-agent.log
  step 'Copy the client certificates' ssl_mysql_certs
  report_agent_status "$container"
}

ssl_mysql_start() {
  local -a args=(
    --server-id=1 --bind-address=0.0.0.0 --require-secure-transport=ON --user=mysql
    --innodb-buffer-pool-size=256M --innodb-buffer-pool-instances=1 --innodb-flush-method=O_DIRECT
    --innodb-numa-interleave=1 --innodb-flush-neighbors=0 --innodb-monitor-enable=all --userstat=1
    --log-bin --log-output=file --slow-query-log=ON --long-query-time=0 --log-slow-rate-limit=1
    --log-slow-rate-type=query --log-slow-verbosity=full --log-slow-admin-statements=ON
    --slow-query-log-always-write-time=1 --slow-query-log-use-global-control=all
  )
  case $version in
    5.7) args+=(--innodb-log-file-size=1G --expire-logs-days=1 --log-slow-slave-statements=ON) ;;
    8.0) args+=(--innodb-log-file-size=1G --binlog-expire-logs-seconds=600 --log-slow-slave-statements=ON) ;;
    8.4) args+=(--innodb-log-file-size=1G --binlog-expire-logs-seconds=600 --log-slow-replica-statements=ON) ;;
    *) args+=(--innodb-redo-log-capacity=1G --binlog-expire-logs-seconds=600 --log-slow-replica-statements=ON) ;;
  esac
  docker rm -fv "$container" >/dev/null 2>&1 || true
  docker network rm "${container}_network" >/dev/null 2>&1 || true
  ensure_pmm_network
  must docker network create "${container}_network" >/dev/null
  must docker run --detach --name "$container" --hostname "$container" --user root --label pmm-qa.engine=ssl_mysql \
    --network "${container}_network" --env "MYSQL_ROOT_PASSWORD=$password" "pmm-qa/ps:$version" "${args[@]}" >/dev/null
  must docker network connect pmm-qa "$container"
  ssl_mysql_wait
  # PS 5.7's entrypoint writes the certificates as the container user, root,
  # so mysqld (running as mysql) cannot read its key and starts without TLS.
  if [[ $version == 5.7 ]]; then
    must docker exec "$container" sh -c 'chown mysql:mysql /var/lib/mysql/*.pem'
    must docker restart "$container" >/dev/null
    ssl_mysql_wait
  fi
  mf_sql "$container" "CREATE USER pmm@'%' IDENTIFIED BY 'pmm'; GRANT ALL ON *.* TO pmm@'%'; CREATE USER 'pmm_tls'@'%' REQUIRE X509;"
}

ssl_mysql_wait() {
  retry 180 "$container to accept MySQL connections" docker exec "$container" mysqladmin ping \
    --host=127.0.0.1 --protocol=tcp -uroot "-p$password" --silent >/dev/null
}

ssl_mysql_certs() {
  local dir=$PMM_QA_ROOT/tls-ssl-setup/mysql/$version file
  must mkdir -p "$dir"
  for file in ca.pem client-key.pem client-cert.pem; do
    must docker cp "$container:/var/lib/mysql/$file" "$dir/$file"
  done
}
