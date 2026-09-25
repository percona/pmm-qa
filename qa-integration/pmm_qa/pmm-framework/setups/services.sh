#!/usr/bin/env bash
# shellcheck disable=SC2034  # env_map is passed to run_playbook by name, so shellcheck cannot see the read.
#
# setups/services.sh -- non-database targets and Valkey.
#
# Same shape as the other setups files (see setups/mysql.sh for the pattern),
# but these cover things that are not a relational database: proxies, exporters,
# object storage and the pre-built client images.

# HAProxy with the PMM Client attached, for the HAProxy dashboards, on the
# prebaked pmm-qa/haproxy image (images/haproxy). The end state is
# haproxy_setup.yml's: haproxy_pmm serving haproxy.cfg on host port 42100,
# registered with --environment=haproxy, with a request every 10 s.
setup_haproxy() {
  local container=haproxy_pmm client tarball='' suffix=$((RANDOM % 10000))
  client=$(resolved_client_version HAPROXY DB_CONFIG)
  step 'Prepare image pmm-qa/haproxy:ol9' ensure_image haproxy ol9
  if [[ $client == http* ]]; then
    tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."
  fi
  step 'Start HAProxy' haproxy_start
  step 'Wait for PMM Server' wait_pmm_server_ready
  step 'Install PMM Client' install_pmm_client "$container" "$client" "$tarball"
  # The playbook named the node after the container plus the nightly shard,
  # so shards sharing one PMM Server do not replace each other's node.
  step 'Set up PMM agent' setup_pmm_agent "$container" false /pmm-agent.log "$container${SHARD_NAME:+-$SHARD_NAME}"
  step 'Wait for pmm-agent' wait_pmm_agent "$container"
  retry_on 'pmm-agent is not connected|context deadline exceeded' 60 "registering ${container}_service_$suffix" \
    docker exec "$container" pmm-admin add haproxy --listen-port=42100 --environment=haproxy \
    "${container}_service_$suffix" >/dev/null
  wait_node_exporter "$container" /pmm-agent.log
  must docker exec --detach "$container" sh -c 'while true; do curl -s http://127.0.0.1:42100/ >/dev/null; sleep 10; done'
  report_agent_status "$container"
}

haproxy_start() {
  docker rm -fv "$container" >/dev/null 2>&1 || true
  ensure_pmm_network
  must docker run --detach --name "$container" --hostname "$container" --label pmm-qa.engine=haproxy \
    --network pmm-qa --publish 42100:42100 pmm-qa/haproxy:ol9 >/dev/null
  must docker cp "$PMM_QA_ROOT/haproxy.cfg" "$container:/haproxy.cfg"
  must docker exec "$container" haproxy -f /haproxy.cfg -D
  retry 30 "HAProxy's metrics on :42100" docker exec "$container" curl -fsS http://127.0.0.1:42100/metrics >/dev/null
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
