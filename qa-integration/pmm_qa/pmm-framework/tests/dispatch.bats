#!/usr/bin/env bats

load helpers/test_helper

@test "PS GR selects the existing playbook and exact environment" {
  parse_database_spec 'ps=8.4,SETUP_TYPE=gr,QUERY_SOURCE=slowlog'
  GLOBAL_CLIENT_VERSION=latest-tarball
  CLIENT_DEBUG=true
  dispatch_setup

  [[ $CAPTURE_KIND == playbook ]]
  [[ $CAPTURE_TARGET == percona_server_for_mysql/percona-server-setup.yml ]]
  [[ ${CAPTURE_ENV[PS_VERSION]} == 8.4 ]]
  [[ ${CAPTURE_ENV[SETUP_TYPE]} == gr ]]
  [[ ${CAPTURE_ENV[QUERY_SOURCE]} == slowlog ]]
  [[ ${CAPTURE_ENV[NODES_COUNT]} == 1 ]]
  [[ ${CAPTURE_ENV[CLIENT_DEBUG]} == true ]]
  [[ ${CAPTURE_ENV[CLIENT_VERSION]} == https://pmm-build-cache.s3.us-east-2.amazonaws.com/PR-BUILDS/pmm-client/pmm-client-latest.tar.gz ]]
  # Prebaked-image plumbing was a POC and is no longer part of the framework.
  [[ -z ${CAPTURE_ENV[USE_PREBAKED_PS]-} ]]
  [[ -z ${CAPTURE_ENV[PREBAKED_PS_IMAGE]-} ]]
}

@test "MySQL GR maps group replication and node values" {
  parse_database_spec 'mysql=8.4,SETUP_TYPE=gr'
  dispatch_setup

  [[ $CAPTURE_TARGET == mysql/mysql-setup.yml ]]
  [[ ${CAPTURE_ENV[MS_VERSION]} == 8.4 ]]
  [[ ${CAPTURE_ENV[GROUP_REPLICATION]} == 1 ]]
  [[ ${CAPTURE_ENV[MS_NODES]} == 1 ]]
  [[ ${CAPTURE_ENV[MS_CONTAINER]} == mysql_pmm_8.4 ]]
}

@test "PGSQL replication selects replication playbook" {
  parse_database_spec 'pgsql=16,SETUP_TYPE=replication,ENCRYPTED_CLIENT_CONFIG=true'
  dispatch_setup

  [[ $CAPTURE_TARGET == postgresql/postgresql-setup.yml ]]
  [[ ${CAPTURE_ENV[PGSQL_VERSION]} == 16 ]]
  [[ ${CAPTURE_ENV[SETUP_TYPE]} == replication ]]
  [[ ${CAPTURE_ENV[ENCRYPTED_CLIENT_CONFIG]} == true ]]
}

@test "PDPGSQL maps patroni and PGSM values" {
  parse_database_spec 'pdpgsql=17,SETUP_TYPE=patroni,PGSM_BRANCH=feature'
  dispatch_setup

  [[ $CAPTURE_TARGET == percona-distribution-postgresql/percona-distribution-postgres-setup.yml ]]
  [[ ${CAPTURE_ENV[PDPGSQL_VERSION]} == 17 ]]
  [[ ${CAPTURE_ENV[SETUP_TYPE]} == patroni ]]
  [[ ${CAPTURE_ENV[PGSM_BRANCH]} == feature ]]
  [[ ${CAPTURE_ENV[PDPGSQL_PGSM_PORT]} == 5447 ]]
}

@test "PSMDB sharding alias selects sharded script and PMM client env name" {
  parse_database_spec 'psmdb=latest,SETUP_TYPE=shards,COMPOSE_PROFILES=extra,OL_VERSION=8,GSSAPI=true'
  GLOBAL_CLIENT_VERSION=3-dev-latest
  dispatch_setup

  [[ $CAPTURE_KIND == script ]]
  [[ $CAPTURE_TARGET == start-sharded.sh ]]
  [[ $CAPTURE_DIRECTORY == "$QA_INTEGRATION_ROOT/pmm_psmdb-pbm_setup" ]]
  [[ ${CAPTURE_ENV[PSMDB_VERSION]} == latest ]]
  [[ ${CAPTURE_ENV[MONGO_SETUP_TYPE]} == shards ]]
  [[ ${CAPTURE_ENV[COMPOSE_PROFILES]} == extra ]]
  [[ ${CAPTURE_ENV[OL_VERSION]} == 8 ]]
  [[ ${CAPTURE_ENV[GSSAPI]} == true ]]
  [[ ${CAPTURE_ENV[PMM_CLIENT_VERSION]} == 3-dev-latest ]]
}

@test "PXC tarball selects PXC and ProxySQL playbook" {
  parse_database_spec 'PXC=8.0,TARBALL=/tmp/pxc.tar.gz'
  dispatch_setup

  [[ $CAPTURE_TARGET == pxc_proxysql_setup.yml ]]
  [[ ${CAPTURE_ENV[PXC_VERSION]} == 8.0 ]]
  [[ ${CAPTURE_ENV[PXC_TARBALL]} == /tmp/pxc.tar.gz ]]
  [[ ${CAPTURE_ENV[PROXYSQL_VERSION]} == 2 ]]
  [[ ${CAPTURE_ENV[PXC_NODES]} == 3 ]]
}

@test "Valkey sentinel alias selects sentinel playbook" {
  parse_database_spec 'valkey=8,SETUP_TYPE=sentinels'
  dispatch_setup

  [[ $CAPTURE_TARGET == valkey/valkey-sentinel.yml ]]
  [[ ${CAPTURE_ENV[VALKEY_VERSION]} == 8 ]]
  [[ ${CAPTURE_ENV[SETUP_TYPE]} == sentinels ]]
}

@test "multiple specs dispatch sequentially without leaking environment maps" {
  local -a targets=()
  local spec
  for spec in 'ps=8.4' 'external' 'haproxy'; do
    parse_database_spec "$spec"
    dispatch_setup
    targets+=("$CAPTURE_TARGET")
  done

  [[ ${targets[0]} == percona_server_for_mysql/percona-server-setup.yml ]]
  [[ ${targets[1]} == external_setup.yml ]]
  [[ ${targets[2]} == haproxy_setup.yml ]]
  [[ -z ${CAPTURE_ENV[PS_VERSION]-} ]]
  [[ -z ${CAPTURE_ENV[REDIS_EXPORTER_VERSION]-} ]]
}

@test "SSL variants select their existing playbooks" {
  parse_database_spec 'ssl_mysql=8.4'
  dispatch_setup
  [[ $CAPTURE_TARGET == tls-ssl-setup/mysql_tls_setup.yml ]]

  parse_database_spec 'ssl_pdpgsql=16'
  dispatch_setup
  [[ $CAPTURE_TARGET == tls-ssl-setup/postgresql_tls_setup.yml ]]

  parse_database_spec 'ssl_mlaunch=8.0'
  dispatch_setup
  [[ $CAPTURE_TARGET == tls-ssl-setup/mlaunch_tls_setup.yml ]]
}

@test "mlaunch variants retain their playbook and variable names" {
  parse_database_spec 'mlaunch_psmdb=8.0,SETUP_TYPE=sharding'
  dispatch_setup
  [[ $CAPTURE_TARGET == mlaunch_psmdb_setup.yml ]]
  [[ ${CAPTURE_ENV[PSMDB_SETUP]} == sharding ]]

  parse_database_spec 'mlaunch_modb=7.0,SETUP_TYPE=pss'
  dispatch_setup
  [[ $CAPTURE_TARGET == mlaunch_modb_setup.yml ]]
  [[ ${CAPTURE_ENV[MODB_VERSION]} == 7.0 ]]
  [[ ${CAPTURE_ENV[MODB_SETUP]} == pss ]]
}

@test "SSL PSMDB uses a temporary script without editing tracked setup files" {
  PMM_SERVER_HOST=192.0.2.10
  PMM_SERVER_PORT=443
  PMM_SERVER_PASSWORD=$'quote" slash\\ newline\nvalue'
  parse_database_spec 'ssl_psmdb=latest,SETUP_TYPE=pss'
  dispatch_setup

  [[ $CAPTURE_KIND == script ]]
  [[ $CAPTURE_DIRECTORY == "$QA_INTEGRATION_ROOT/pmm_psmdb_diffauth_setup" ]]
  [[ $CAPTURE_TARGET == */pmm-framework-ssl-psmdb.*/test-auth.sh ]]
  [[ ! -e $CAPTURE_TARGET ]]
  [[ $CAPTURE_SCRIPT_CONTENT == *'--server-address=192.0.2.10:443'* ]]
  # shellcheck disable=SC2016
  [[ $CAPTURE_OVERRIDE_CONTENT == *'PMM_AGENT_SERVER_PASSWORD: "${ADMIN_PASSWORD}"'* ]]
  [[ $CAPTURE_OVERRIDE_CONTENT != *"$PMM_SERVER_PASSWORD"* ]]
  [[ ${CAPTURE_ENV[PSMDB_VERSION]} == latest ]]
  [[ ${CAPTURE_ENV[MONGO_SETUP_TYPE]} == pss ]]

  first_target=$CAPTURE_TARGET
  dispatch_setup
  [[ $CAPTURE_TARGET != "$first_target" ]]
  [[ ! -e $CAPTURE_TARGET ]]
}

@test "service handlers map exporters and client debug" {
  REDIS_VERSION=1.14.0
  NODE_PROCESS_VERSION=0.7.5
  parse_database_spec external
  dispatch_setup
  [[ $CAPTURE_TARGET == external_setup.yml ]]
  [[ ${CAPTURE_ENV[REDIS_EXPORTER_VERSION]} == 1.14.0 ]]
  [[ ${CAPTURE_ENV[NODE_PROCESS_EXPORTER_VERSION]} == 0.7.5 ]]

  CLIENT_DEBUG=true
  parse_database_spec haproxy
  dispatch_setup
  [[ $CAPTURE_TARGET == haproxy_setup.yml ]]
  [[ ${CAPTURE_ENV[CLIENT_DEBUG]} == true ]]
}

@test "bucket and Docker client setups reuse current targets" {
  parse_database_spec 'bucket,BUCKET_NAMES=one;two'
  dispatch_setup
  [[ $CAPTURE_TARGET == tasks/create_minio_container.yml ]]
  [[ ${CAPTURE_ENV[BUCKETS]} == one,two ]]

  parse_database_spec dockerclients
  dispatch_setup
  [[ $CAPTURE_KIND == script ]]
  [[ $CAPTURE_DIRECTORY == "$PMM_QA_ROOT" ]]
  [[ $CAPTURE_TARGET == setup_docker_client_images.sh ]]
}
