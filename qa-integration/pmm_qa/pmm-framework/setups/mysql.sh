#!/usr/bin/env bash
# shellcheck disable=SC2034  # env_map and proxysql_config are looked up by name (run_playbook, resolve_value).
#
# setups/mysql.sh -- MySQL-family setups: PS, MYSQL, SSL_MYSQL, PXC.
#
# Every setup function here follows the same shape, which is the pattern to
# copy when adding a new one:
#
#   1. resolve the version, setup type and client version
#   2. build `declare -A env_map=(...)` -- the contract with the playbook
#   3. hand it to run_playbook() (or run_setup_script())
#
# The env maps are written out in full rather than shared through a helper. The
# repetition is deliberate: each map mirrors exactly what its playbook reads,
# and the differences between them are real (setup_external omits CLIENT_DEBUG,
# the PSMDB setups use PMM_CLIENT_VERSION instead of CLIENT_VERSION). Factoring
# out the common keys would hide those asymmetries.
#
# Reads, in every function: DB_VERSION and DB_CONFIG (set by
# parse_database_spec), PMM_SERVER_HOST, CLIENT_DEBUG.

# Percona Server for MySQL.
#
# SETUP_TYPE selects the topology inside the playbook ('' single, gr, replication).
# NODES_COUNT, MY_ROCKS and BACKUP are passed through for the playbook to act on.
setup_ps() {
  local version setup_type client
  version=$(resolved_version PS_VERSION PS "$DB_VERSION")
  setup_type=$(resolve_value PS SETUP_TYPE DB_CONFIG)
  setup_type=${setup_type,,}
  client=$(resolved_client_version PS DB_CONFIG)

  declare -A env_map=(
    [PMM_SERVER_IP]="$PMM_SERVER_HOST"
    [SETUP_TYPE]="$setup_type"
    [NODES_COUNT]="$(resolve_value PS NODES_COUNT DB_CONFIG)"
    [QUERY_SOURCE]="$(resolve_value PS QUERY_SOURCE DB_CONFIG)"
    [PS_VERSION]="$version"
    [CLIENT_VERSION]="$client"
    [ADMIN_PASSWORD]="$(admin_password)"
    [MY_ROCKS]="$(resolve_value PS MY_ROCKS DB_CONFIG)"
    [ENCRYPTED_CLIENT_CONFIG]="$(resolve_value PS ENCRYPTED_CLIENT_CONFIG DB_CONFIG)"
    [CLIENT_DEBUG]="$(bool_string "$CLIENT_DEBUG")"
    [BACKUP]="$(resolve_value PS BACKUP DB_CONFIG)"
    [TIME_ZONE]="$(resolve_value PS TIME_ZONE DB_CONFIG)"
  )
  run_playbook 'percona_server_for_mysql/percona-server-setup.yml' env_map
}

# Upstream MySQL.
#
# Unlike PS, this playbook wants the topology pre-translated: SETUP_TYPE=gr sets
# GROUP_REPLICATION=1, and SETUP_TYPE=replication asks for two nodes. Both are
# still passed alongside the raw SETUP_TYPE.
setup_mysql() {
  local version setup_type client group_replication='' nodes=1
  version=$(resolved_version MS_VERSION MYSQL "$DB_VERSION")
  setup_type=$(resolve_value MYSQL SETUP_TYPE DB_CONFIG)
  setup_type=${setup_type,,}
  client=$(resolved_client_version MYSQL DB_CONFIG)
  if [[ $setup_type == gr ]]; then
    group_replication=1
  elif [[ $setup_type == replication ]]; then
    nodes=2
  fi

  declare -A env_map=(
    [GROUP_REPLICATION]="$group_replication"
    [MS_NODES]="$nodes"
    [MS_VERSION]="$version"
    [SETUP_TYPE]="$setup_type"
    [PMM_SERVER_IP]="$PMM_SERVER_HOST"
    [MS_CONTAINER]="mysql_pmm_$version"
    [CLIENT_VERSION]="$client"
    [QUERY_SOURCE]="$(resolve_value MYSQL QUERY_SOURCE DB_CONFIG)"
    [MS_TARBALL]="$(resolve_value MYSQL TARBALL DB_CONFIG)"
    [ADMIN_PASSWORD]="$(admin_password)"
    [PMM_QA_GIT_BRANCH]="$(git_branch)"
    [ENCRYPTED_CLIENT_CONFIG]="$(resolve_value MYSQL ENCRYPTED_CLIENT_CONFIG DB_CONFIG)"
    [CLIENT_DEBUG]="$(bool_string "$CLIENT_DEBUG")"
    [TIME_ZONE]="$(resolve_value MYSQL TIME_ZONE DB_CONFIG)"
  )
  run_playbook 'mysql/mysql-setup.yml' env_map
}

# MySQL with TLS, monitored over an encrypted connection.
setup_ssl_mysql() {
  local version client
  version=$(resolved_version MS_VERSION SSL_MYSQL "$DB_VERSION")
  client=$(resolved_client_version SSL_MYSQL DB_CONFIG)
  declare -A env_map=(
    [MYSQL_VERSION]="$version"
    [PMM_SERVER_IP]="$PMM_SERVER_HOST"
    [MYSQL_SSL_CONTAINER]="mysql_ssl_$version"
    [CLIENT_VERSION]="$client"
    [ADMIN_PASSWORD]="$(admin_password)"
    [PMM_QA_GIT_BRANCH]="$(git_branch)"
    [CLIENT_DEBUG]="$(bool_string "$CLIENT_DEBUG")"
  )
  run_playbook 'tls-ssl-setup/mysql_tls_setup.yml' env_map
}

# Percona XtraDB Cluster, always three nodes, fronted by ProxySQL.
#
# ProxySQL is not separately requestable (dispatch_setup rejects it), so its
# version and package come from the PROXYSQL registration instead of a spec.
# The empty proxysql_config array exists only to satisfy resolve_value's
# signature -- there is no PROXYSQL spec to read options from.
setup_pxc() {
  local version proxysql_version client
  version=$(resolved_version PXC_VERSION PXC "$DB_VERSION")
  proxysql_version=${PROXYSQL_VERSION:-$(database_default_version PROXYSQL)}
  client=$(resolved_client_version PXC DB_CONFIG)
  declare -A proxysql_config=()
  declare -A env_map=(
    [PXC_NODES]=3
    [PXC_VERSION]="$version"
    [PROXYSQL_VERSION]="$proxysql_version"
    [PXC_TARBALL]="$(resolve_value PXC TARBALL DB_CONFIG)"
    [PROXYSQL_PACKAGE]="$(resolve_value PROXYSQL PACKAGE proxysql_config)"
    [PMM_SERVER_IP]="$PMM_SERVER_HOST"
    [PXC_CONTAINER]="pxc_proxysql_pmm_$version"
    [CLIENT_VERSION]="$client"
    [ADMIN_PASSWORD]="$(admin_password)"
    [QUERY_SOURCE]="$(resolve_value PXC QUERY_SOURCE DB_CONFIG)"
    [PMM_QA_GIT_BRANCH]="$(git_branch)"
    [CLIENT_DEBUG]="$(bool_string "$CLIENT_DEBUG")"
  )
  run_playbook 'pxc_proxysql_setup.yml' env_map
}
