#!/usr/bin/env bash
#
# setups/services.sh -- HAProxy, the External exporters and Valkey.

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

# External exporters (redis_exporter and process-exporter) registered with PMM,
# on the prebaked pmm-qa/external image (images/external), with
# external_setup.yml's end state: redis_container on host port 6379 and
# external_pmm serving redis_exporter on :42200, which remote-instance tests
# reach from the server, and process-exporter on :9256.
#
# Their versions are not spec options -- override them with the REDIS_VERSION
# and NODE_PROCESS_VERSION environment variables, which build their own tag.
setup_external() {
  local container=external_pmm client tarball='' tag suffix=$((RANDOM % 10000))
  client=$(resolved_client_version EXTERNAL DB_CONFIG)
  tag=${REDIS_VERSION:-1.58.0}-${NODE_PROCESS_VERSION:-0.7.10}
  step "Prepare image pmm-qa/external:$tag" ensure_image external "$tag"
  if [[ $client == http* ]]; then
    tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."
  fi
  step 'Start Redis and the exporters' external_start
  step 'Wait for PMM Server' wait_pmm_server_ready
  step 'Install PMM Client' install_pmm_client "$container" "$client" "$tarball"
  step 'Set up PMM agent' setup_pmm_agent "$container" false /var/log/pmm-agent.log "$container${SHARD_NAME:+-$SHARD_NAME}"
  step 'Wait for pmm-agent' wait_pmm_agent "$container"
  retry_on 'pmm-agent is not connected|context deadline exceeded' 60 "registering redis_external_service_$suffix" \
    docker exec "$container" pmm-admin add external --listen-port=42200 --group=redis \
    "--service-name=redis_external_service_$suffix" >/dev/null
  retry_on 'pmm-agent is not connected|context deadline exceeded' 60 "registering nodeprocess_service_$suffix" \
    docker exec "$container" pmm-admin add external --listen-port=9256 --group=processes \
    "--service-name=nodeprocess_service_$suffix" >/dev/null
  wait_node_exporter "$container" /var/log/pmm-agent.log
  report_agent_status "$container"
}

external_start() {
  docker rm -fv "$container" redis_container >/dev/null 2>&1 || true
  ensure_pmm_network
  must docker run --detach --name redis_container --label pmm-qa.engine=external --network pmm-qa \
    --publish 6379:6379 redis --requirepass oFukiBRg7GujAJXq3tmd >/dev/null
  must docker run --detach --name "$container" --hostname "$container" --label pmm-qa.engine=external \
    --network pmm-qa "pmm-qa/external:$tag" >/dev/null
  must docker exec --detach "$container" sh -c 'exec redis_exporter --redis.addr=redis://redis_container:6379 \
    --redis.password=oFukiBRg7GujAJXq3tmd --web.listen-address=:42200 >/redis.log 2>&1'
  must docker exec --detach "$container" sh -c 'exec process-exporter --web.listen-address=:9256 >/process-exporter.log 2>&1'
  retry 60 'redis_exporter on :42200' docker exec "$container" curl -fsS http://127.0.0.1:42200/metrics >/dev/null
  retry 60 'process-exporter on :9256' docker exec "$container" curl -fsS http://127.0.0.1:9256/metrics >/dev/null
}

# Valkey as a cluster (the default) or a sentinel topology, on the prebaked
# pmm-qa/valkey image (images/valkey), with the end state of
# valkey/valkey-cluster.yml and valkey-sentinel.yml: the dashboard tests look
# services up as <container>-svc and nodes as <container>-node, and the CLI
# test reads /var/log/pmm-agent.log in valkey-primary-1.
setup_valkey() {
  local version setup_type client tarball='' encrypted node
  local -a nodes=()
  version=$(resolved_version VALKEY_VERSION VALKEY "$DB_VERSION")
  setup_type=$(resolve_value VALKEY SETUP_TYPE DB_CONFIG)
  setup_type=${setup_type,,}
  client=$(resolved_client_version VALKEY DB_CONFIG)
  encrypted=$(bool_string "$(resolve_value VALKEY ENCRYPTED_CLIENT_CONFIG DB_CONFIG)")
  step "Prepare image pmm-qa/valkey:$version" ensure_image valkey "$version"
  if [[ $client == http* ]]; then
    tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."
  fi
  case $setup_type in
    sentinel | sentinels)
      nodes=(valkey-primary valkey-replica-1 valkey-replica-2 sentinel-1 sentinel-2 sentinel-3)
      step 'Start the primary, replicas and sentinels' valkey_sentinel_start
      ;;
    *)
      nodes=(valkey-primary-1 valkey-primary-2 valkey-primary-3 valkey-replica-4 valkey-replica-5 valkey-replica-6)
      step 'Start and form the cluster' valkey_cluster_start
      ;;
  esac
  step 'Wait for PMM Server' wait_pmm_server_ready
  step 'Install PMM Client' each_node nodes install_pmm_client "$client" "$tarball"
  log_info '==> Register with PMM'
  local -a labels
  for node in "${nodes[@]}"; do
    setup_pmm_agent "$node" "$encrypted" /var/log/pmm-agent.log "$node-node"
    wait_pmm_agent "$node"
    mapfile -t labels < <(valkey_labels "$node")
    retry_on 'pmm-agent is not connected|context deadline exceeded' 60 "registering ${labels[0]#*=}" \
      docker exec "$node" pmm-admin add valkey "${labels[@]}" --environment=valkey-test --username=default \
      "--password=$VALKEY_PASSWORD" "--host=$node" "--port=$(valkey_port "$node")" >/dev/null
  done
  step 'Wait for exporters' each_node nodes valkey_exporters
  step 'Run workload' valkey_workload
  for node in "${nodes[@]}"; do
    report_agent_status "$node"
  done
}

readonly VALKEY_PASSWORD=VKvl41568AsE

# Usage: valkey_run NAME HOST_PORT CONTAINER_PORT COMMAND...
valkey_run() {
  local name=$1 host_port=$2 port=$3
  shift 3
  docker rm -fv "$name" >/dev/null 2>&1 || true
  docker volume rm -f "$name-data" >/dev/null 2>&1 || true
  must docker run --detach --name "$name" --hostname "$name-node" --label pmm-qa.engine=valkey \
    --network pmm-qa --restart unless-stopped --publish "$host_port:$port" --volume "$name-data:/data" \
    "pmm-qa/valkey:$version" "$@" >/dev/null
  local -a auth=(-a "$VALKEY_PASSWORD" --no-auth-warning)
  if ((port == 26379)); then
    auth=()
  fi
  retry 60 "$name to answer" docker exec "$name" valkey-cli -p "$port" "${auth[@]}" ping >/dev/null
}

valkey_cluster_ok() {
  [[ $(docker exec valkey-primary-1 valkey-cli -a "$VALKEY_PASSWORD" --no-auth-warning cluster info) == *cluster_state:ok* ]]
}

valkey_server_args() {
  printf '%s\n' valkey-server --port 6379 --requirepass "$VALKEY_PASSWORD" --masterauth "$VALKEY_PASSWORD" \
    --protected-mode no --save '900 1 300 10 60 10000' --loglevel notice \
    --maxmemory-policy allkeys-lru --maxmemory 1gb
}

valkey_cluster_start() {
  local node port=6379
  local -a server
  mapfile -t server < <(valkey_server_args)
  ensure_pmm_network
  for node in "${nodes[@]}"; do
    # Replicas start at host port 6385, as the playbook's (6379+3-1)+N put them.
    if [[ $node == valkey-replica-4 ]]; then
      port=6385
    fi
    valkey_run "$node" "$port" 6379 "${server[@]}" --appendonly yes --cluster-enabled yes \
      --cluster-config-file nodes.conf --cluster-node-timeout 5000
    port=$((port + 1))
  done
  must docker exec valkey-primary-1 valkey-cli -a "$VALKEY_PASSWORD" --no-auth-warning --cluster create \
    "${nodes[@]/%/:6379}" --cluster-replicas 1 --cluster-yes >/dev/null
  retry 60 'cluster_state:ok' valkey_cluster_ok
}

valkey_sentinel_start() {
  local -a server
  mapfile -t server < <(valkey_server_args)
  ensure_pmm_network
  valkey_run valkey-primary 6379 6379 "${server[@]}" --bind 0.0.0.0 --replica-serve-stale-data yes \
    --replica-read-only yes --repl-diskless-sync no --repl-diskless-sync-delay 5
  valkey_run valkey-replica-1 6380 6379 "${server[@]}" --bind 0.0.0.0 --replicaof valkey-primary 6379
  valkey_run valkey-replica-2 6381 6379 "${server[@]}" --bind 0.0.0.0 --replicaof valkey-primary 6379
  local n
  for n in 1 2 3; do
    valkey_run "sentinel-$n" "$((26378 + n))" 26379 sh -c "printf '%s\n' 'bind 0.0.0.0' 'port 26379' \
      'sentinel monitor valkey-primary valkey-primary 6379 2' 'sentinel auth-user valkey-primary default' \
      'sentinel auth-pass valkey-primary $VALKEY_PASSWORD' 'sentinel resolve-hostnames yes' \
      'sentinel down-after-milliseconds valkey-primary 5000' 'sentinel failover-timeout valkey-primary 10000' \
      'sentinel parallel-syncs valkey-primary 1' 'protected-mode no' 'loglevel notice' 'maxmemory 1gb' \
      >/data/sentinel.conf && exec valkey-sentinel /data/sentinel.conf"
  done
}

# The playbooks' service name (first) and labels, per node. The sentinel
# topology's replicas and sentinels drop the dash before their number.
valkey_labels() {
  case $1 in
    valkey-primary-?) printf '%s\n' "--service-name=$1-svc" --cluster=valkey-native-cluster --custom-labels=role=primary ;;
    valkey-replica-[4-6]) printf '%s\n' "--service-name=$1-svc" --cluster=valkey-native-cluster --custom-labels=role=replica ;;
    valkey-primary) printf '%s\n' --service-name=valkey-primary-svc --cluster=valkey-cluster --replication-set=valkey-repl --custom-labels=role=primary ;;
    valkey-replica-?) printf '%s\n' "--service-name=valkey-replica${1##*-}-svc" --cluster=valkey-cluster --replication-set=valkey-repl --custom-labels=role=replica ;;
    sentinel-?) printf '%s\n' "--service-name=sentinel${1##*-}-svc" --cluster=valkey-cluster --custom-labels=role=sentinel ;;
  esac
}

valkey_port() {
  if [[ $1 == sentinel-? ]]; then
    printf 26379
  else
    printf 6379
  fi
}

valkey_exporters() {
  wait_exporter "$1" valkey_exporter
  wait_node_exporter "$1" /var/log/pmm-agent.log
}

# The playbooks' load: writes on each primary, reads on each replica, without
# -c, so a key owned by another primary just gets a MOVED reply.
valkey_workload() {
  local node cli="valkey-cli -a $VALKEY_PASSWORD --no-auth-warning"
  local writes="for i in \$(seq 1 50); do $cli SET k\$i v\$i; $cli GET k\$i; $cli HSET h\$i f v; $cli LPUSH l\$i a b c;
    $cli RPUSH l\$i d e f; $cli LRANGE l\$i 0 -1; $cli LPOP l\$i; $cli RPOP l\$i; done >/dev/null 2>&1; true"
  local reads="for i in \$(seq 1 50); do $cli GET k\$i; $cli LRANGE l\$i 0 -1; done >/dev/null 2>&1; true"
  must docker exec "${nodes[0]}" sh -c "$cli RPUSH mylist one two three four five && $cli RPOP mylist" >/dev/null
  for node in "${nodes[@]}"; do
    case $node in
      valkey-primary*) must docker exec "$node" sh -c "$writes" ;;
      valkey-replica*) must docker exec "$node" sh -c "$reads" ;;
    esac
  done
}
