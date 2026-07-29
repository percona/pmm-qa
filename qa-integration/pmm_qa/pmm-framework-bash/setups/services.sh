#!/usr/bin/env bash

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

setup_bucket() {
  local buckets
  buckets=$(resolve_value BUCKET BUCKET_NAMES DB_CONFIG)
  buckets=${buckets//\"/}
  buckets=${buckets,,}
  buckets=${buckets//;/,}
  declare -A env_map=([BUCKETS]="$buckets")
  run_playbook 'tasks/create_minio_container.yml' env_map
}

setup_dockerclients() {
  declare -A env_map=()
  run_setup_script "$PMM_QA_ROOT" 'setup_docker_client_images.sh' env_map
}
