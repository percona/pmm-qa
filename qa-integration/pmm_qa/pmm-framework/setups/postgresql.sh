#!/usr/bin/env bash
# shellcheck disable=SC2034  # env_map is passed to run_playbook by name, so shellcheck cannot see the read.
#
# setups/postgresql.sh -- PostgreSQL-family setups: PDPGSQL, SSL_PDPGSQL, PGSQL.
#
# Same shape as setups/mysql.sh -- see that file's header for the pattern and
# for why the env maps are spelled out rather than shared.
#
# The distinction between the two products: PDPGSQL is the Percona Distribution
# with pg_stat_monitor (PGSM), PGSQL is upstream PostgreSQL with
# pg_stat_statements (PGSS). They use different playbooks, ports and container
# names.

# Percona Distribution for PostgreSQL, monitored through pg_stat_monitor.
#
# PGSTAT_MONITOR_BRANCH is pinned to 'main' while PGSM_BRANCH stays
# spec-controlled: the playbook uses them for different things, so the
# similar-looking names are not a duplicate. DISTRIBUTION is intentionally
# empty -- the playbook fills in its own default.
setup_pdpgsql() {
  local version setup_type pgsm_branch client
  version=$(resolved_version PDPGSQL_VERSION PDPGSQL "$DB_VERSION")
  setup_type=$(resolve_value PDPGSQL SETUP_TYPE DB_CONFIG)
  setup_type=${setup_type,,}
  pgsm_branch=$(resolve_value PDPGSQL PGSM_BRANCH DB_CONFIG)
  pgsm_branch=${pgsm_branch,,}
  client=$(resolved_client_version PDPGSQL DB_CONFIG)

  declare -A env_map=(
    [PGSTAT_MONITOR_BRANCH]=main
    [PDPGSQL_VERSION]="$version"
    [PMM_SERVER_IP]="$PMM_SERVER_HOST"
    [PDPGSQL_PGSM_CONTAINER]="pdpgsql_pgsm_pmm_$version"
    [CLIENT_VERSION]="$client"
    [USE_SOCKET]="$(resolve_value PDPGSQL USE_SOCKET DB_CONFIG)"
    [ADMIN_PASSWORD]="$(admin_password)"
    [PDPGSQL_PGSM_PORT]=5447
    [DISTRIBUTION]=''
    [PMM_QA_GIT_BRANCH]="$(git_branch)"
    [SETUP_TYPE]="$setup_type"
    [PGSM_BRANCH]="$pgsm_branch"
    [ENCRYPTED_CLIENT_CONFIG]="$(resolve_value PDPGSQL ENCRYPTED_CLIENT_CONFIG DB_CONFIG)"
    [CLIENT_DEBUG]="$(bool_string "$CLIENT_DEBUG")"
  )
  run_playbook \
    'percona-distribution-postgresql/percona-distribution-postgres-setup.yml' \
    env_map
}

# Percona Distribution for PostgreSQL with TLS.
#
# Note the env key is PGSQL_VERSION even though the type is SSL_PDPGSQL -- that
# is what the TLS playbook reads. Match the playbook, not the type name.
setup_ssl_pdpgsql() {
  local version client
  version=$(resolved_version PDPGSQL_VERSION SSL_PDPGSQL "$DB_VERSION")
  client=$(resolved_client_version SSL_PDPGSQL DB_CONFIG)
  declare -A env_map=(
    [PGSTAT_MONITOR_BRANCH]=main
    [PGSQL_VERSION]="$version"
    [PMM_SERVER_IP]="$PMM_SERVER_HOST"
    [PGSQL_SSL_CONTAINER]="pdpgsql_pgsm_ssl_$version"
    [CLIENT_VERSION]="$client"
    [USE_SOCKET]="$(resolve_value SSL_PDPGSQL USE_SOCKET DB_CONFIG)"
    [ADMIN_PASSWORD]="$(admin_password)"
    [PMM_QA_GIT_BRANCH]="$(git_branch)"
    [CLIENT_DEBUG]="$(bool_string "$CLIENT_DEBUG")"
  )
  run_playbook 'tls-ssl-setup/postgresql_tls_setup.yml' env_map
}

# Upstream PostgreSQL, monitored through pg_stat_statements.
#
# One of the two setups that pick their playbook at runtime (setup_valkey is
# the other). SETUP_TYPE=replication switches to the replication playbook and
# adds two keys that only it reads -- which is why they are appended after the
# map literal rather than always being present.
setup_pgsql() {
  local version setup_type client playbook
  version=$(resolved_version PGSQL_VERSION PGSQL "$DB_VERSION")
  setup_type=$(resolve_value PGSQL SETUP_TYPE DB_CONFIG)
  setup_type=${setup_type,,}
  client=$(resolved_client_version PGSQL DB_CONFIG)

  declare -A env_map=(
    [PGSQL_VERSION]="$version"
    [PMM_SERVER_IP]="$PMM_SERVER_HOST"
    [PGSQL_PGSS_CONTAINER]="pgsql_pgss_pmm_$version"
    [CLIENT_VERSION]="$client"
    [USE_SOCKET]="$(resolve_value PGSQL USE_SOCKET DB_CONFIG)"
    [ADMIN_PASSWORD]="$(admin_password)"
    [PGSQL_PGSS_PORT]=5448
    [PMM_QA_GIT_BRANCH]="$(git_branch)"
    [CLIENT_DEBUG]="$(bool_string "$CLIENT_DEBUG")"
  )

  if [[ $setup_type == replication ]]; then
    env_map[SETUP_TYPE]=$setup_type
    env_map[ENCRYPTED_CLIENT_CONFIG]=$(resolve_value PGSQL ENCRYPTED_CLIENT_CONFIG DB_CONFIG)
    playbook='postgresql/postgresql-setup.yml'
  else
    playbook='pgsql_pgss_setup.yml'
  fi
  run_playbook "$playbook" env_map
}
