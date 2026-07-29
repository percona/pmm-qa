#!/usr/bin/env bash

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
