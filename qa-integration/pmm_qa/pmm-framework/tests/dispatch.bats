#!/usr/bin/env bats

load helpers/test_helper

# Records every docker call and answers the probes setup_ps polls, so a PS
# setup runs end to end without a daemon.
stub_prebaked_docker() {
  DOCKER_CALLS=$BATS_TEST_TMPDIR/docker.calls
  : >"$DOCKER_CALLS"
  # shellcheck disable=SC2329,SC2317
  docker() {
    printf '%s\n' "$*" >>"$DOCKER_CALLS"
    if [[ $1 == compose && ${5:-} == */compose.yml ]]; then
      cp "$5" "$BATS_TEST_TMPDIR/override.yml"
      printf '%s' "$5" >"$BATS_TEST_TMPDIR/override.path"
    fi
    case "$*" in
      *'test -f /etc/debian_version'*)
        [[ ${DEBIAN_NODE:-false} == true ]]
        return
        ;;
      *VERSION_CODENAME*) printf 'noble\n' ;;
      *'patronictl -c /patroni.yml list'*)
        printf '| %s | %s:5432 | %s | %s | 1 |\n' pdpgsql_pmm_patroni_17_1 x Leader running \
          pdpgsql_pmm_patroni_17_2 x Replica streaming pdpgsql_pmm_patroni_17_3 x Replica streaming
        ;;
      *pg_stat_replication*) printf '1\n' ;;
      *'pmm-admin status'*)
        printf 'Connected : true\n%s\n' 'mysqld_exporter Running' 'mysqld_exporter Running' \
          'mysqld_exporter Running' 'proxysql_exporter Running' 'mongodb_exporter Running' 'valkey_exporter Running' 'postgres_exporter Running' "node_exporter ${NODE_EXPORTER_STATE:-Running}"
        ;;
      *'REPLICA STATUS'* | *'SLAVE STATUS'*)
        printf '%s_IO_Running: Yes\n%s_SQL_Running: Yes\n' Replica Replica Slave Slave
        ;;
      'ps --format {{.Ports}}') printf '%s\n' "${PUBLISHED_PORTS:-}" ;;
      *replication_group_members*) printf '3\n' ;;
      *isWritablePrimary* | *'rs.status()'* | *ismaster*) printf 'true\n' ;;
      *'cluster info'*) printf 'cluster_state:ok\n' ;;
      *information_schema.engines* | *'testdb.testdb WHERE'*) printf '1\n' ;;
    esac
  }
}

@test "PS GR runs three prebaked nodes and registers them as the playbook did" {
  stub_prebaked_docker
  parse_database_spec 'ps=8.4,SETUP_TYPE=gr,QUERY_SOURCE=slowlog'
  GLOBAL_CLIENT_VERSION=3-dev-latest
  CLIENT_DEBUG=true
  dispatch_setup

  [[ $(grep -c '^run --detach --name ps_pmm_gr_8_4_[123] ' "$DOCKER_CALLS") -eq 3 ]]
  grep -q -- '--name ps_pmm_gr_8_4_3 .*--privileged --cgroupns=host --volume /sys/fs/cgroup:/sys/fs/cgroup:rw .*--publish 3308:3306 pmm-qa/ps:8.4 --server-id=3 ' "$DOCKER_CALLS"
  grep -q -- '--loose-group-replication-group-seeds=ps_pmm_gr_8_4_1:34061,ps_pmm_gr_8_4_2:34061,ps_pmm_gr_8_4_3:34061' "$DOCKER_CALLS"
  grep -q 'START GROUP_REPLICATION' "$DOCKER_CALLS"
  [[ $(grep -c 'SET GLOBAL log_slow_rate_limit=1' "$DOCKER_CALLS") -eq 3 ]]
  # shellcheck disable=SC2016 # a literal $pkg, expanded later in the container
  [[ $(grep -Fc 'enable-only pmm3-client experimental && $pkg install -y pmm-client' "$DOCKER_CALLS") -eq 3 ]]
  grep -q -- 'pmm-agent setup .*--server-address=pmm-server:8443 .*--force --debug ps_pmm_gr_8_4_2 container ps_pmm_gr_8_4_2$' "$DOCKER_CALLS"
  [[ $(grep -c '^exec --user root ps_pmm_gr_8_4_[123] sh -c tr -d - </proc/sys/kernel/random/uuid >/etc/machine-id$' "$DOCKER_CALLS") -eq 3 ]]
  grep -Eq -- '^exec ps_pmm_gr_8_4_1 pmm-admin add mysql --query-source=slowlog --username=root --password=GRgrO9301RuF --environment=ps-gr-dev --cluster=ps-gr-dev-cluster --replication-set=ps-gr-replication --debug ps_pmm_gr_8_4_1_[0-9]+ 127\.0\.0\.1:3306$' "$DOCKER_CALLS"
  [[ $(grep -c '^exec --detach ps_pmm_gr_8_4_1 sh -c' "$DOCKER_CALLS") -eq 1 ]]
  [[ $(grep -c '^exec --detach ps_pmm_gr_8_4_[23] sh -c' "$DOCKER_CALLS") -eq 0 ]]
}

@test "a second PS topology publishes past the ports the first one holds" {
  stub_prebaked_docker
  PUBLISHED_PORTS=$'0.0.0.0:3306->3306/tcp, [::]:3306->3306/tcp\n0.0.0.0:3307->3306/tcp, [::]:3307->3306/tcp\n0.0.0.0:33060->33060/tcp'
  parse_database_spec 'ps=8.4,SETUP_TYPE=gr'
  dispatch_setup

  grep -q -- '--name ps_pmm_gr_8_4_1 .*--publish 3308:3306 ' "$DOCKER_CALLS"
  grep -q -- '--name ps_pmm_gr_8_4_3 .*--publish 3310:3306 ' "$DOCKER_CALLS"
}

@test "PS 5.7 replication uses the 5.7 statements and publishes no port" {
  stub_prebaked_docker
  parse_database_spec 'ps=5.7,SETUP_TYPE=replication'
  dispatch_setup

  [[ $(grep -c '^run --detach --name ps_pmm_replication_5_7_[12] ' "$DOCKER_CALLS") -eq 2 ]]
  [[ $(grep -c -- '--publish' "$DOCKER_CALLS") -eq 0 ]]
  grep -q -- '--log-slave-updates=ON' "$DOCKER_CALLS"
  grep -q "CHANGE MASTER TO MASTER_HOST='ps_pmm_replication_5_7_1'" "$DOCKER_CALLS"
  grep -Eq -- '--environment=ps-replication-dev --cluster=ps-replication-dev-cluster --replication-set=ps-async-replication --debug ps_pmm_replication_5_7_2_[0-9]+ ' "$DOCKER_CALLS"
}

@test "single PS honours MY_ROCKS and skips encryption on a client older than 3.7" {
  stub_prebaked_docker
  parse_database_spec 'ps=8.0,MY_ROCKS=true,ENCRYPTED_CLIENT_CONFIG=true,CLIENT_VERSION=3.6.0'
  dispatch_setup

  grep -q -- '--name ps_pmm_8_0_1 .*--publish 3306:3306 --env INIT_ROCKSDB=1 pmm-qa/ps:8.0 ' "$DOCKER_CALLS"
  grep -q -- '--name ps_pmm_8_0_1 --hostname ps_pmm_8_0_1 --user root .* --user=mysql' "$DOCKER_CALLS"
  [[ $(grep -c 'mysql-sockets' "$DOCKER_CALLS") -eq 0 ]]
  grep -q 'pmm-client-3.6.0-7.el' "$DOCKER_CALLS"
  [[ $(grep -c 'openssl genpkey' "$DOCKER_CALLS") -eq 0 ]]
  grep -Eq -- '--environment=ps-dev --cluster=ps-single-dev-cluster --debug ps_pmm_8_0_1_[0-9]+ ' "$DOCKER_CALLS"
  grep -q '^exec --detach ps_pmm_8_0_1 sh -c' "$DOCKER_CALLS"
}

@test "PS rejects what it cannot provision before touching docker" {
  stub_prebaked_docker
  local spec
  for spec in 'ps=9.7,BACKUP=true' 'ps,SETUP_TYPE=bogus' 'ps,NODES_COUNT=two'; do
    parse_database_spec "$spec"
    run dispatch_setup
    [[ $status -ne 0 ]]
  done
  [[ ! -s $DOCKER_CALLS ]]
}

@test "parallel setups can fetch the same client tarball at once" {
  export XDG_CACHE_HOME=$BATS_TEST_TMPDIR/cache
  # shellcheck disable=SC2329
  curl() {
    local out
    while (($#)); do
      if [[ $1 == -o ]]; then out=$2; fi
      shift
    done
    sleep 0.3
    printf 'tarball\n' >"$out"
  }
  (fetch_client_tarball https://example.test/pmm-client.tar.gz >/dev/null) &
  local first=$!
  (fetch_client_tarball https://example.test/pmm-client.tar.gz >/dev/null) &
  local second=$!
  wait "$first"
  wait "$second"
  [[ $(cat "$XDG_CACHE_HOME"/pmm-framework/pmm-client-*.tar.gz) == tarball ]]
}

@test "retry_on stops on an unmatched error and reports short output whole" {
  # shellcheck disable=SC2329,SC2317
  sleep() { :; }
  run retry_on 'flaky' 3 'the probe' sh -c 'echo "no such thing" >&2; exit 1'
  [[ $status -ne 0 ]]
  [[ $output == *'Gave up on the probe after 1 attempt(s); last output: no such thing'* ]]

  run retry 3 'the probe' sh -c 'echo flaky; exit 1'
  [[ $output == *'after 3 attempt(s); last output: flaky'* ]]
}

@test "ensure_image pulls the published image before building one" {
  stub_prebaked_docker
  # shellcheck disable=SC2329,SC2317
  docker() {
    printf '%s\n' "$*" >>"$DOCKER_CALLS"
    [[ $1 != image ]]
  }
  ensure_image ps 8.4
  grep -q '^pull --quiet ghcr.io/percona/pmm-qa/ps:8.4$' "$DOCKER_CALLS"
  grep -q '^tag ghcr.io/percona/pmm-qa/ps:8.4 pmm-qa/ps:8.4$' "$DOCKER_CALLS"
  [[ $(grep -c '^build ' "$DOCKER_CALLS") -eq 0 ]]

  : >"$DOCKER_CALLS"
  PREBAKED_REGISTRY='' ensure_image ps 8.4
  [[ $(grep -c '^pull ' "$DOCKER_CALLS") -eq 0 ]]
  grep -q '^build .* -t pmm-qa/ps:8.4 ' "$DOCKER_CALLS"
}

@test "the PS image builds from the shared Dockerfile with the version's base image" {
  stub_prebaked_docker
  build_ps_image 8.0
  grep -q -- "^build --build-arg PS_IMAGE=percona/percona-server:8.0.46 --build-arg XTRABACKUP_PACKAGE=percona-xtrabackup-80 --label org.opencontainers.image.source=https://github.com/percona/pmm-qa -t pmm-qa/ps:8.0 $FRAMEWORK_DIR/images/ps$" "$DOCKER_CALLS"
  run build_ps_image 9.9
  [[ $status -ne 0 ]]
}

@test "MySQL GR runs on the mysql image with mysql labels and no PS-only settings" {
  stub_prebaked_docker
  parse_database_spec 'mysql=8.4,SETUP_TYPE=gr,QUERY_SOURCE=slowlog'
  dispatch_setup

  [[ $(grep -c '^run --detach --name mysql_pmm_gr_8_4_[123] ' "$DOCKER_CALLS") -eq 3 ]]
  grep -q -- '--label pmm-qa.engine=mysql .*--publish 3306:3306 pmm-qa/mysql:8.4 ' "$DOCKER_CALLS"
  [[ $(grep -c -- '--userstat' "$DOCKER_CALLS") -eq 0 ]]
  [[ $(grep -c 'log_slow_rate_limit' "$DOCKER_CALLS") -eq 0 ]]
  grep -Eq -- '--environment=mysql-gr-dev --cluster=mysql-gr-dev-cluster --replication-set=mysql-gr-replication --debug mysql_pmm_gr_8_4_2_[0-9]+ ' "$DOCKER_CALLS"
  grep -q -- '--time=60 run' "$DOCKER_CALLS"
}

@test "MySQL 5.7 publishes its port and builds from the 5.7 stage" {
  stub_prebaked_docker
  parse_database_spec 'mysql=5.7'
  dispatch_setup
  grep -q -- '--name mysql_pmm_5_7_1 .*--publish 3306:3306 pmm-qa/mysql:5.7 ' "$DOCKER_CALLS"
  grep -q -- '^run --rm --volume /tmp:/host-tmp busybox:1.37.0 ' "$DOCKER_CALLS"
  grep -q -- 'ln -s mysqld.sock /host-tmp/mysql-sockets/1/mysql.sock' "$DOCKER_CALLS"
  grep -q -- '--name mysql_pmm_5_7_1 --hostname mysql_pmm_5_7_1 --user root .*--volume /tmp/mysql-sockets/1:/var/run/mysqld ' "$DOCKER_CALLS"
  grep -q -- 'pmm-qa/mysql:5.7 .* --user=mysql' "$DOCKER_CALLS"
  grep -Eq -- '--environment=mysql-dev --cluster=mysql-single-dev-cluster --debug mysql_pmm_5_7_1_[0-9]+ ' "$DOCKER_CALLS"

  build_mysql_image 5.7
  grep -q -- "^build --target mysql-57 --label org.opencontainers.image.source=https://github.com/percona/pmm-qa -t pmm-qa/mysql:5.7 $FRAMEWORK_DIR/images/mysql$" "$DOCKER_CALLS"
  build_mysql_image 8.0
  grep -q -- '--target mysql-epel --build-arg MYSQL_IMAGE=mysql:8.0 --label org.opencontainers.image.source=https://github.com/percona/pmm-qa -t pmm-qa/mysql:8.0 ' "$DOCKER_CALLS"
}

@test "single PGSQL starts the prebaked node through service and registers it as pgsql_pgss_setup.yml did" {
  stub_prebaked_docker
  SHARD_NAME=nightly
  parse_database_spec 'pgsql=17'
  dispatch_setup

  grep -q -- '^run --detach --name pgsql_pgss_pmm_17 .*--publish 5448:5432 pmm-qa/pgsql:17$' "$DOCKER_CALLS"
  grep -q '^exec pgsql_pgss_pmm_17 service postgresql start$' "$DOCKER_CALLS"
  grep -q -- ' pgsql_pgss_pmm_17 container pgsql_pgss_pmm_17-nightly$' "$DOCKER_CALLS"
  grep -q ">>'/pmm-agent.log'" "$DOCKER_CALLS"
  grep -Eq '^exec pgsql_pgss_pmm_17 pmm-admin add postgresql --username=pmm --password=pmm --query-source=pgstatements pgsql_pgss_pmm_17_service_[0-9]+$' "$DOCKER_CALLS"
  grep -q '^exec --detach pgsql_pgss_pmm_17 bash /pgsm_run_queries.sh$' "$DOCKER_CALLS"
}

@test "PGSQL replication clones a replica on the official image and names services as the playbook did" {
  stub_prebaked_docker
  parse_database_spec 'pgsql=16,SETUP_TYPE=replication,ENCRYPTED_CLIENT_CONFIG=true'
  dispatch_setup

  grep -q -- '^run --detach --name pgsql_pmm_16_1 .*--publish 6432:5432 postgres:16-bookworm -c config_file=/etc/postgresql/postgresql.conf$' "$DOCKER_CALLS"
  grep -q -- '^run --detach --name pgsql_pmm_16_2 .*--publish 6433:5432 --entrypoint bash postgres:16-bookworm -ceu ' "$DOCKER_CALLS"
  # shellcheck disable=SC2016 # a literal $PGDATA, expanded in the container
  grep -Fq 'pg_basebackup "--pgdata=$PGDATA"' "$DOCKER_CALLS"
  [[ $(grep -c 'openssl genpkey' "$DOCKER_CALLS") -eq 2 ]]
  grep -q '^exec pgsql_pmm_16_2 pmm-admin add postgresql --username=pmm --password=pmm --query-source=pgstatements pgsql_pmm_16_2 --debug 127.0.0.1:5432$' "$DOCKER_CALLS"
  grep -q 'pgbench -i -s 1000 pgbench' "$DOCKER_CALLS"

  parse_database_spec 'pgsql=17,SETUP_TYPE=patroni'
  run dispatch_setup
  [[ $status -ne 0 ]]
  [[ $output == *'PGSQL SETUP_TYPE must be empty or replication'* ]]
}

# Stands in for lib/fetch-pmm-client-deb.sh, recording its arguments.
stub_deb_fetch() {
  DEBIAN_NODE=true
  FRAMEWORK_DIR=$BATS_TEST_TMPDIR/framework
  mkdir -p "$FRAMEWORK_DIR/lib"
  cat >"$FRAMEWORK_DIR/lib/fetch-pmm-client-deb.sh" <<EOF
#!/usr/bin/env bash
echo "\$*" >>'$BATS_TEST_TMPDIR/deb.calls'
echo /cache/pmm-client.deb
EOF
  chmod +x "$FRAMEWORK_DIR/lib/fetch-pmm-client-deb.sh"
}

@test "single PDPGSQL runs the prebaked node, installs the Debian client package and registers TCP and socket services" {
  stub_prebaked_docker
  stub_deb_fetch
  parse_database_spec 'pdpgsql=17'
  GLOBAL_CLIENT_VERSION=3-dev-latest
  dispatch_setup

  grep -q -- '^run --detach --name pdpgsql_pmm_17_1 .*--privileged --cgroupns=host .*--publish 5432:5432 pmm-qa/pdpgsql:17$' "$DOCKER_CALLS"
  [[ $(cat "$BATS_TEST_TMPDIR/deb.calls") == 'experimental noble /tmp/pmm-client-cache 1800 ' ]]
  grep -q '^cp /cache/pmm-client.deb pdpgsql_pmm_17_1:/tmp/pmm-client.deb$' "$DOCKER_CALLS"
  grep -q 'apt-get install -y /tmp/pmm-client.deb' "$DOCKER_CALLS"
  grep -q "CREATE ROLE pmm LOGIN PASSWORD 'pmm' IN ROLE pg_monitor;" "$DOCKER_CALLS"
  grep -q -- ' pdpgsql_pmm_17_1 container pdpgsql_pmm_17_1$' "$DOCKER_CALLS"
  grep -Eq '^exec pdpgsql_pmm_17_1 pmm-admin add postgresql --query-source=pgstatmonitor --username=pmm --password=pmm pdpgsql_pmm_17_1_[0-9]+ --debug 127\.0\.0\.1:5432$' "$DOCKER_CALLS"
  grep -Eq '^exec pdpgsql_pmm_17_1 pmm-admin add postgresql .* --socket=/var/run/postgresql socket_pdpgsql_pmm_17_1_[0-9]+$' "$DOCKER_CALLS"
  grep -q "ALTER USER postgres WITH PASSWORD 'pass+this';" "$DOCKER_CALLS"
  grep -q '^exec --detach pdpgsql_pmm_17_1 bash /pdpgsql_run_queries.sh$' "$DOCKER_CALLS"
}

@test "PDPGSQL patroni runs three nodes under etcd, builds PGSM_BRANCH and registers the Patroni API" {
  stub_prebaked_docker
  stub_deb_fetch
  SHARD_NAME=nightly
  parse_database_spec 'pdpgsql=17,SETUP_TYPE=patroni,PGSM_BRANCH=feature,CLIENT_VERSION=3.9.1'
  dispatch_setup

  grep -q -- '--name pdpgsql_pmm_patroni_17_3 .*--publish 6434:5432 ' "$DOCKER_CALLS"
  [[ $(grep -c "git clone --branch 'feature'" "$DOCKER_CALLS") -eq 3 ]]
  grep -q 'main noble /tmp/pmm-client-cache 1800 3.9.1' "$BATS_TEST_TMPDIR/deb.calls"
  [[ $(grep -c '^exec --detach --user postgres pdpgsql_pmm_patroni_17_[123] sh -c exec patroni /patroni.yml' "$DOCKER_CALLS") -eq 3 ]]
  grep -q 'stanza=patroni_backup .*stanza-create' "$DOCKER_CALLS"
  grep -q -- ' pdpgsql_pmm_patroni_17_2 container pdpgsql_pmm_patroni_17_2-nightly$' "$DOCKER_CALLS"
  grep -Eq -- '^exec pdpgsql_pmm_patroni_17_2 pmm-admin add postgresql --query-source=pgstatmonitor --username=postgres --password=pass\+this --cluster=pdpgsql_patroni_cluster --environment=pdpgsql_patroni_environment pdpgsql_pmm_patroni_17_2_[0-9]+ ' "$DOCKER_CALLS"
  grep -Eq -- '^exec pdpgsql_pmm_patroni_17_1 pmm-admin add external --listen-port=8008 --service-name=patroni_service_1_[0-9]+$' "$DOCKER_CALLS"
  grep -Eq -- '^exec pdpgsql_pmm_patroni_17_3 pmm-admin add external --listen-port=8008 --cluster=pdpgsql_patroni_service_cluster --environment=pdpgsql_patroni_service_environment --service-name=patroni_service_3_[0-9]+$' "$DOCKER_CALLS"
}

@test "PDPGSQL replication streams a basebackup replica and rejects an unknown SETUP_TYPE" {
  stub_prebaked_docker
  parse_database_spec 'pdpgsql=16,SETUP_TYPE=replication,CLIENT_VERSION=https://example.com/pmm-client.tar.gz'
  fetch_client_tarball() { printf '/cache/client.tar.gz'; }
  dispatch_setup

  grep -q -- '^exec --user postgres --env PGPASSWORD=GRgrO9301RuF pdpgsql_pmm_replication_16_2 timeout 120 pg_basebackup .*--host=pdpgsql_pmm_replication_16_1 ' "$DOCKER_CALLS"
  [[ $(grep -c 'pg_basebackup' "$DOCKER_CALLS") -eq 1 ]]
  grep -Eq -- '--cluster=pdpgsql_replication_cluster --environment=pdpgsql_replication_environment pdpgsql_pmm_replication_16_2_[0-9]+ ' "$DOCKER_CALLS"
  grep -q "pg_create_logical_replication_slot('test_slot', 'test_decoding')" "$DOCKER_CALLS"

  parse_database_spec 'pdpgsql=17,SETUP_TYPE=gr'
  run dispatch_setup
  [[ $status -ne 0 ]]
  [[ $output == *'PDPGSQL SETUP_TYPE must be empty, replication or patroni'* ]]
}

@test "PSMDB pss runs the compose stack on the prebaked image and registers it as configure-agents.sh did" {
  stub_prebaked_docker
  parse_database_spec 'psmdb=7.0,SETUP_TYPE=pss,GSSAPI=true,OL_VERSION=8'
  GLOBAL_CLIENT_VERSION=3-dev-latest
  dispatch_setup

  grep -q '^tag pmm-qa/psmdb:7.0-ol8 replica_member/local$' "$DOCKER_CALLS"
  grep -q '^compose -f docker-compose-rs.yaml up -d --no-deps minio createbucket$' "$DOCKER_CALLS"
  ! grep -q 'compose.* build' "$DOCKER_CALLS" || false
  grep -Fq 'exec -i rs101 mongo --quiet --eval rs.initiate({ _id: "rs", members: [{ _id: 0, host: "rs101:27017", priority: 2 },{ _id: 1, host: "rs102:27017", priority: 1 },{ _id: 2, host: "rs103:27017", priority: 1 }] })' "$DOCKER_CALLS"
  # shellcheck disable=SC2016 # a literal $external
  grep -Fq 'getSiblingDB("$external").createUser({ user: "pmm@PERCONATEST.COM"' "$DOCKER_CALLS"
  [[ $(grep -c '^exec rs10[123] systemctl restart pbm-agent$' "$DOCKER_CALLS") -eq 3 ]]
  grep -q '^exec rs101 pbm config --file /etc/pbm/minio.yaml$' "$DOCKER_CALLS"
  [[ $(grep -c 'tr -d - </proc/sys/kernel/random/uuid >/etc/machine-id' "$DOCKER_CALLS") -eq 3 ]]
  grep -Eq '^exec -e PMM_AGENT_SETUP_NODE_NAME=rs102\._[0-9]+ rs102 pmm-agent setup$' "$DOCKER_CALLS"
  # shellcheck disable=SC2016 # a literal $external
  grep -Eq '^exec rs101 pmm-admin add mongodb --enable-all-collectors --agent-password=mypass rs101_gssapi_[0-9]+ --environment=psmdb-dev --cluster=replicaset --replication-set=rs --username=pmm@PERCONATEST.COM --password=password1 --authentication-mechanism=GSSAPI --authentication-database=\$external --host=rs101 --port=27017$' "$DOCKER_CALLS"
  grep -q '^exec rs101 mgodatagen -f /etc/datagen/replicaset.json' "$DOCKER_CALLS"
}

@test "PSMDB psa with the extra set registers the arbiters and the extra set as the scripts did" {
  stub_prebaked_docker
  parse_database_spec 'psmdb,SETUP_TYPE=psa,COMPOSE_PROFILES=extra,MINIO=false'
  dispatch_setup

  grep -q '^tag pmm-qa/psmdb:8.0-ol9 replica_member/local$' "$DOCKER_CALLS"
  ! grep -q 'minio createbucket' "$DOCKER_CALLS" || false
  grep -Fq '{ _id: 2, host: "rs103:27017", arbiterOnly: true }' "$DOCKER_CALLS"
  grep -Fq '{ _id: 2, host: "rs203:27017", arbiterOnly: true }' "$DOCKER_CALLS"
  # shellcheck disable=SC2016 # a literal $external
  ! grep -Fq '$external' "$DOCKER_CALLS" || false
  grep -q '^exec rs103 systemctl stop pbm-agent$' "$DOCKER_CALLS"
  grep -q '^exec rs203 systemctl stop pbm-agent$' "$DOCKER_CALLS"
  grep -Eq '^exec rs103 pmm-admin add mongodb --enable-all-collectors --agent-password=mypass rs103_[0-9]+ --environment=psmdb-dev --cluster=replicaset --replication-set=rs --host=rs103 --port=27017$' "$DOCKER_CALLS"
  grep -Eq '^exec rs202 pmm-admin add mongodb --enable-all-collectors --agent-password=mypass rs202_[0-9]+ --cluster=replicaset --username=pmm --password=pmmpass --host=rs202 --port=27017$' "$DOCKER_CALLS"
  grep -Eq '^exec rs203 pmm-admin add mongodb --enable-all-collectors --agent-password=mypass rs203_[0-9]+ --cluster=replicaset --replication-set=rs1 --host=rs203 --port=27017$' "$DOCKER_CALLS"
}

@test "PSMDB sharding initiates three sets, adds both shards and registers mongos" {
  stub_prebaked_docker
  # shellcheck disable=SC2329
  psmdb_traffic() { printf 'traffic\n' >>"$DOCKER_CALLS"; }
  parse_database_spec 'psmdb=8.0,SETUP_TYPE=shards'
  dispatch_setup

  grep -q '^compose -f docker-compose-sharded.yaml up -d$' "$DOCKER_CALLS"
  for name in rs1 rs2 rscfg; do
    grep -Fq "rs.initiate({ _id: \"$name\", members: [{ _id: 0, host: \"${name}01:27017\", priority: 2 }" "$DOCKER_CALLS"
  done
  grep -Fq 'sh.addShard("rs2/rs201:27017,rs202:27017,rs203:27017")' "$DOCKER_CALLS"
  grep -Eq '^exec rscfg02 pmm-admin add mongodb --enable-all-collectors --agent-password=mypass rscfg02_[0-9]+ --environment=mongo-sharded-dev --cluster=sharded --replication-set=rscfg --username=pmm --password=pmmpass --host=rscfg02 --port=27017$' "$DOCKER_CALLS"
  grep -Eq '^exec mongos pmm-admin add mongodb --enable-all-collectors --agent-password=mypass mongos_[0-9]+ --disable-collectors=indexstats --environment=mongo-sharded-dev --cluster=sharded --username=pmm --password=pmmpass 127\.0\.0\.1:27017$' "$DOCKER_CALLS"
  [[ $(grep -c 'systemctl restart pbm-agent$' "$DOCKER_CALLS") -eq 9 ]]
  ! grep -q 'pbm config' "$DOCKER_CALLS" || false
  grep -q '^exec --detach mongos bash -c while true' "$DOCKER_CALLS"
  grep -q '^traffic$' "$DOCKER_CALLS"
}

@test "SSL PSMDB runs the TLS stack on the prebaked image without writing the password to disk" {
  stub_prebaked_docker
  # shellcheck disable=SC2329
  ssl_psmdb_certs() { :; }
  PMM_SERVER_PASSWORD=$'quote" slash\\ newline\nvalue'
  parse_database_spec 'ssl_psmdb=latest,SETUP_TYPE=pss'
  dispatch_setup

  grep -q '^tag pmm-qa/psmdb:8.0-ol9 replica_member/local$' "$DOCKER_CALLS"
  ! grep -q 'minio createbucket' "$DOCKER_CALLS" || false
  # shellcheck disable=SC2016
  grep -Fq 'PMM_AGENT_SERVER_PASSWORD: "${ADMIN_PASSWORD}"' "$BATS_TEST_TMPDIR/override.yml"
  grep -A1 -q '^  test:$' "$BATS_TEST_TMPDIR/override.yml"
  ! grep -Fq 'slash' "$BATS_TEST_TMPDIR/override.yml" || false
  [[ ! -e $(dirname "$(cat "$BATS_TEST_TMPDIR/override.path")") ]]
  grep -q -- ' --server-insecure-tls --force$' "$DOCKER_CALLS"
  grep -Eq '^exec psmdb-server pmm-admin add mongodb psmdb-server_[0-9]+ --agent-password=mypass --username=pmm_mongodb --password=5M\]\(Q%q/U\+YQ<\^m --host psmdb-server --port 27017 --tls --tls-certificate-key-file=/mongodb_certs/client.pem --tls-ca-file=/mongodb_certs/ca-certs.pem --cluster=mycluster$' "$DOCKER_CALLS"
}

@test "PXC runs in one container and registers its nodes and ProxySQL as the playbook did" {
  stub_prebaked_docker
  parse_database_spec 'PXC=8.4,QUERY_SOURCE=slowlog'
  dispatch_setup

  grep -q -- '^run --detach --init --name pxc_proxysql_pmm_8.4 .*--publish 6033:6033 pmm-qa/pxc-proxysql:8.4$' "$DOCKER_CALLS"
  grep -q '^exec --user root pxc_proxysql_pmm_8.4 pmm-pxc start$' "$DOCKER_CALLS"
  grep -q -- '^exec --user root pxc_proxysql_pmm_8.4 pmm-agent setup .* pxc_proxysql_pmm_8.4 container pxc_proxysql_pmm_8_4$' "$DOCKER_CALLS"
  [[ $(grep -c "SET GLOBAL log_slow_rate_limit=1" "$DOCKER_CALLS") -eq 3 ]]
  grep -Eq -- '^exec pxc_proxysql_pmm_8.4 pmm-admin add mysql --query-source=slowlog --username=admin --password=admin --host=127.0.0.1 --port=3308 --environment=pxc-dev --cluster=pxc-dev-cluster --replication-set=pxc-repl pxc_node__3_[0-9]+$' "$DOCKER_CALLS"
  grep -Eq -- '^exec pxc_proxysql_pmm_8.4 pmm-admin add proxysql --username=admin --password=admin --service-name=my-new-proxysql_pxc_proxysql_pmm_8.4_[0-9]+ --host=127.0.0.1 --port=6032$' "$DOCKER_CALLS"
  grep -q -- '--mysql-host=127.0.0.1 --mysql-port=6033' "$DOCKER_CALLS"
}

@test "PXC appends the nightly shard to its node name" {
  stub_prebaked_docker
  SHARD_NAME=ps-gr-pxc-valkey
  parse_database_spec 'PXC=8.4'
  dispatch_setup

  grep -q -- ' pxc_proxysql_pmm_8.4 container pxc_proxysql_pmm_8_4-ps-gr-pxc-valkey$' "$DOCKER_CALLS"
}

@test "a prebaked setup fails when node_exporter never reaches Running" {
  stub_prebaked_docker
  # shellcheck disable=SC2329,SC2317
  sleep() { :; }
  NODE_EXPORTER_STATE=Waiting
  parse_database_spec 'pxc=8.4'
  run dispatch_setup
  [[ $status -ne 0 ]]
  [[ $output == *'node_exporter is not running on pxc_proxysql_pmm_8.4.'* ]]
  grep -q "grep -i node_exporter '/pmm-agent.log'" "$DOCKER_CALLS"

  NODE_EXPORTER_STATE=Running
  : >"$DOCKER_CALLS"
  run dispatch_setup
  [[ $status -eq 0 ]]
  [[ $output == *'agent-status pxc_proxysql_pmm_8.4: node_exporter Running'* ]]
}

@test "a PXC tarball builds its own image tag, and ProxySQL overrides are refused" {
  stub_prebaked_docker
  # shellcheck disable=SC2329,SC2317
  docker() {
    printf '%s\n' "$*" >>"$DOCKER_CALLS"
    [[ $1 != image ]]
  }
  build_pxc_proxysql_image 8.0 https://example.com/pxc.tar.gz
  grep -Eq -- '--build-arg PXC_VERSION=8.0 --build-arg PROXYSQL_PACKAGE= --build-arg PXC_TARBALL=https://example.com/pxc.tar.gz --label org.opencontainers.image.source=https://github.com/percona/pmm-qa -t pmm-qa/pxc-proxysql:8.0-tb[0-9a-f]{8} ' "$DOCKER_CALLS"
  build_pxc_proxysql_image 9.7
  grep -q -- 'PROXYSQL_PACKAGE=https://github.com/sysown/proxysql/releases/download/v3.0.11/proxysql-3.0.11-1-almalinux9.x86_64.rpm --build-arg PXC_TARBALL= --label org.opencontainers.image.source=https://github.com/percona/pmm-qa -t pmm-qa/pxc-proxysql:9.7 ' "$DOCKER_CALLS"

  parse_database_spec 'pxc=8.0'
  PROXYSQL_VERSION=3 run dispatch_setup
  [[ $status -ne 0 ]]
  [[ $output == *'PROXYSQL_VERSION and PROXYSQL_PACKAGE are not supported'* ]]
}

@test "Valkey cluster runs six prebaked nodes and registers them as valkey-cluster.yml did" {
  stub_prebaked_docker
  parse_database_spec 'valkey=7'
  dispatch_setup

  grep -q -- '^run --detach --name valkey-primary-1 --hostname valkey-primary-1-node .*--publish 6379:6379 --volume valkey-primary-1-data:/data pmm-qa/valkey:7 valkey-server --port 6379 ' "$DOCKER_CALLS"
  grep -q -- '^run --detach --name valkey-replica-4 .*--publish 6385:6379 .*--cluster-enabled yes' "$DOCKER_CALLS"
  grep -q -- '--cluster create valkey-primary-1:6379 valkey-primary-2:6379 valkey-primary-3:6379 valkey-replica-4:6379 valkey-replica-5:6379 valkey-replica-6:6379 --cluster-replicas 1 --cluster-yes$' "$DOCKER_CALLS"
  grep -q -- ' valkey-replica-5 container valkey-replica-5-node$' "$DOCKER_CALLS"
  grep -q -- '^exec valkey-replica-5 pmm-admin add valkey --service-name=valkey-replica-5-svc --cluster=valkey-native-cluster --custom-labels=role=replica --environment=valkey-test --username=default --password=VKvl41568AsE --host=valkey-replica-5 --port=6379$' "$DOCKER_CALLS"
}

@test "Valkey sentinel alias runs the sentinel topology and registers it as valkey-sentinel.yml did" {
  stub_prebaked_docker
  parse_database_spec 'valkey=8,SETUP_TYPE=sentinels'
  dispatch_setup

  grep -q -- '^run --detach --name valkey-replica-2 .*--publish 6381:6379 .*--replicaof valkey-primary 6379$' "$DOCKER_CALLS"
  grep -q -- '^run --detach --name sentinel-3 --hostname sentinel-3-node .*--publish 26381:26379 ' "$DOCKER_CALLS"
  grep -q -- '^exec valkey-replica-1 pmm-admin add valkey --service-name=valkey-replica1-svc --cluster=valkey-cluster --replication-set=valkey-repl --custom-labels=role=replica ' "$DOCKER_CALLS"
  grep -q -- '^exec sentinel-2 pmm-admin add valkey --service-name=sentinel2-svc --cluster=valkey-cluster --custom-labels=role=sentinel .*--port=26379$' "$DOCKER_CALLS"
}

@test "SSL MySQL runs Percona Server on the PS image, requiring TLS, and registers over TLS" {
  stub_prebaked_docker
  SHARD_NAME=nightly-shard
  parse_database_spec 'ssl_mysql=8.4'
  dispatch_setup

  grep -q -- '^run --detach --name mysql_ssl_8.4 --hostname mysql_ssl_8.4 --user root .*--network mysql_ssl_8.4_network .* pmm-qa/ps:8.4 .*--require-secure-transport=ON .*--log-slow-replica-statements=ON$' "$DOCKER_CALLS"
  grep -q '^network connect pmm-qa mysql_ssl_8.4$' "$DOCKER_CALLS"
  grep -Fq "CREATE USER 'pmm_tls'@'%' REQUIRE X509" "$DOCKER_CALLS"
  grep -q -- ' mysql_ssl_8.4 container mysql_ssl_8.4-nightly-shard$' "$DOCKER_CALLS"
  grep -Eq '^exec mysql_ssl_8.4 pmm-admin add mysql --username=pmm --password=pmm --query-source=perfschema --tls --tls-skip-verify --tls-ca=/var/lib/mysql/ca.pem --tls-cert=/var/lib/mysql/client-cert.pem --tls-key=/var/lib/mysql/client-key.pem mysql_ssl_8.4_ssl_service_[0-9]+$' "$DOCKER_CALLS"
  grep -q '^cp mysql_ssl_8.4:/var/lib/mysql/client-key.pem .*/pmm_qa/tls-ssl-setup/mysql/8.4/client-key.pem$' "$DOCKER_CALLS"
}

@test "SSL PDPGSQL makes its own certificates, registers over TLS and copies the client certificates out" {
  stub_prebaked_docker
  parse_database_spec 'ssl_pdpgsql=16'
  dispatch_setup

  grep -q '^network create pdpgsql_pgsm_ssl_16_network$' "$DOCKER_CALLS"
  grep -q -- '^run --detach --name pdpgsql_pgsm_ssl_16 .*--network pdpgsql_pgsm_ssl_16_network pmm-qa/ssl-pdpgsql:16$' "$DOCKER_CALLS"
  grep -q '^network connect pmm-qa pdpgsql_pgsm_ssl_16$' "$DOCKER_CALLS"
  grep -q 'bash create_certs.sh' "$DOCKER_CALLS"
  grep -Eq '^exec pdpgsql_pgsm_ssl_16 pmm-admin add postgresql --username=pmm --password=pmm --query-source=pgstatements --tls --tls-ca-file=./certificates/ca.crt --tls-cert-file=./certificates/client.crt --tls-key-file=./certificates/client.pem pdpgsql_pgsm_ssl_16_ssl_service[0-9]+$' "$DOCKER_CALLS"
  grep -q '^cp pdpgsql_pgsm_ssl_16:/artifacts/certificates/client.pem .*/pmm_qa/tls-ssl-setup/postgres/16/client.pem$' "$DOCKER_CALLS"
}

@test "External runs both exporters on the prebaked image and registers them as external_setup.yml did" {
  stub_prebaked_docker
  SHARD_NAME=nightly-shard
  REDIS_VERSION=1.14.0
  NODE_PROCESS_VERSION=0.7.5
  parse_database_spec external
  dispatch_setup

  grep -q '^image inspect pmm-qa/external:1.14.0-0.7.5$' "$DOCKER_CALLS"
  grep -q -- '^run --detach --name redis_container .*--publish 6379:6379 redis --requirepass oFukiBRg7GujAJXq3tmd$' "$DOCKER_CALLS"
  grep -q -- '^run --detach --name external_pmm --hostname external_pmm .*--network pmm-qa --privileged --cgroupns=host --volume /sys/fs/cgroup:/sys/fs/cgroup:rw pmm-qa/external:1.14.0-0.7.5$' "$DOCKER_CALLS"
  grep -q -- '--web.listen-address=:42200 >/redis.log' "$DOCKER_CALLS"
  grep -q -- ' external_pmm container external_pmm-nightly-shard$' "$DOCKER_CALLS"
  grep -Eq '^exec external_pmm pmm-admin add external --listen-port=42200 --group=redis --service-name=redis_external_service_([0-9]+)$' "$DOCKER_CALLS"
  grep -Eq '^exec external_pmm pmm-admin add external --listen-port=9256 --group=processes --service-name=nodeprocess_service_[0-9]+$' "$DOCKER_CALLS"
}

@test "HAProxy runs on the prebaked image and registers as haproxy_setup.yml did" {
  stub_prebaked_docker
  SHARD_NAME=extra-pxc-pdpgsql-haproxy
  CLIENT_DEBUG=true
  parse_database_spec haproxy
  dispatch_setup

  grep -q -- '^run --detach --name haproxy_pmm --hostname haproxy_pmm --label pmm-qa.engine=haproxy --network pmm-qa --publish 42100:42100 --privileged --cgroupns=host --volume /sys/fs/cgroup:/sys/fs/cgroup:rw pmm-qa/haproxy:ol9$' "$DOCKER_CALLS"
  grep -q '^cp .*/images/haproxy/haproxy.cfg haproxy_pmm:/haproxy.cfg$' "$DOCKER_CALLS"
  grep -q '^exec haproxy_pmm haproxy -f /haproxy.cfg -D$' "$DOCKER_CALLS"
  grep -q -- 'pmm-agent setup .*--debug haproxy_pmm container haproxy_pmm-extra-pxc-pdpgsql-haproxy$' "$DOCKER_CALLS"
  grep -Eq '^exec haproxy_pmm pmm-admin add haproxy --listen-port=42100 --environment=haproxy haproxy_pmm_service_[0-9]+$' "$DOCKER_CALLS"
  grep -q '^exec --detach haproxy_pmm sh -c while true; do curl -s http://127.0.0.1:42100/' "$DOCKER_CALLS"
}

