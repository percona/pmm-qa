#!/usr/bin/env bash
#
# setups/services.sh -- non-database targets and Valkey.
#
# Same shape as the other setups files (see setups/mysql.sh for the pattern),
# but these cover things that are not a relational database: proxies, exporters,
# object storage and the pre-built client images.

# HAProxy with the PMM Client attached, for the HAProxy dashboards.
setup_haproxy() {
  local client
  client=$(resolved_client_version HAPROXY DB_CONFIG)
  declare -A env_map=(
    [PMM_SERVER_IP]="$PMM_SERVER_HOST"
    [HAPROXY_CONTAINER]=haproxy_pmm
    [CLIENT_VERSION]="$client"
    [ADMIN_PASSWORD]="$(admin_password)"
    [PMM_QA_GIT_BRANCH]="$(git_branch)"
    [CLIENT_DEBUG]="$(bool_string "$CLIENT_DEBUG")"
  )
  run_playbook 'haproxy_setup.yml' env_map
}

# External exporters (redis_exporter and process_exporter) registered with PMM.
#
# Their versions are not spec options -- override them with the REDIS_VERSION
# and NODE_PROCESS_VERSION environment variables. Note this setup intentionally
# does not pass CLIENT_DEBUG; its playbook does not read it.
setup_external() {
  local client redis_version node_version
  client=$(resolved_client_version EXTERNAL DB_CONFIG)
  redis_version=${REDIS_VERSION:-1.58.0}
  node_version=${NODE_PROCESS_VERSION:-0.7.10}
  declare -A env_map=(
    [PMM_SERVER_IP]="$PMM_SERVER_HOST"
    [REDIS_EXPORTER_VERSION]="$redis_version"
    [NODE_PROCESS_EXPORTER_VERSION]="$node_version"
    [EXTERNAL_CONTAINER]=external_pmm
    [CLIENT_VERSION]="$client"
    [ADMIN_PASSWORD]="$(admin_password)"
    [PMM_QA_GIT_BRANCH]="$(git_branch)"
  )
  run_playbook 'external_setup.yml' env_map
}

# Valkey, as either a cluster or a sentinel topology.
#
# One of the two setups that pick their playbook at runtime (setup_pgsql is the
# other). Cluster is the default; sentinel must be asked for explicitly, and
# both the singular and plural spellings are accepted as aliases.
setup_valkey() {
  local version setup_type client playbook
  version=$(resolved_version VALKEY_VERSION VALKEY "$DB_VERSION")
  setup_type=$(resolve_value VALKEY SETUP_TYPE DB_CONFIG)
  setup_type=${setup_type,,}
  client=$(resolved_client_version VALKEY DB_CONFIG)
  declare -A env_map=(
    [PMM_SERVER_IP]="$PMM_SERVER_HOST"
    [VALKEY_VERSION]="$version"
    [CLIENT_VERSION]="$client"
    [ADMIN_PASSWORD]="$(admin_password)"
    [PMM_QA_GIT_BRANCH]="$(git_branch)"
    [SETUP_TYPE]="$setup_type"
    [ENCRYPTED_CLIENT_CONFIG]="$(resolve_value VALKEY ENCRYPTED_CLIENT_CONFIG DB_CONFIG)"
    [CLIENT_DEBUG]="$(bool_string "$CLIENT_DEBUG")"
  )
  case "$setup_type" in
    sentinel|sentinels) playbook='valkey/valkey-sentinel.yml' ;;
    *) playbook='valkey/valkey-cluster.yml' ;;
  esac
  run_playbook "$playbook" env_map
}

# A MinIO container holding S3 buckets, used as a backup location.
#
# BUCKET_NAMES is normalised before the playbook sees it: quotes stripped,
# lower-cased, and ';' separators turned into ',' -- the playbook splits on
# commas. So `BUCKET_NAMES=one;two` and `BUCKET_NAMES=one,two` are equivalent.
# Needs no PMM Server (see setup_requires_server).
setup_bucket() {
  local buckets
  buckets=$(resolve_value BUCKET BUCKET_NAMES DB_CONFIG)
  buckets=${buckets//\"/}
  buckets=${buckets,,}
  buckets=${buckets//;/,}
  declare -A env_map=([BUCKETS]="$buckets")
  run_playbook 'tasks/create_minio_container.yml' env_map
}

# Build the pre-baked client Docker images used by other suites.
#
# The only setup with an empty env map: the script takes no parameters. It also
# needs no PMM Server, and is script-backed rather than playbook-backed.
setup_dockerclients() {
  declare -A env_map=()
  run_setup_script "$PMM_QA_ROOT" 'setup_docker_client_images.sh' env_map
}
