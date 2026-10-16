#!/usr/bin/env bash
#
# images/pcsm/setup.sh -- Percona ClusterSync for MongoDB, on the prebaked pcsm image.

# PCSM syncs replica set rs-src (pcsm-src-N) to rs-tgt (pcsm-tgt-N), both on
# the psmdb image, as one HA group of INSTANCES processes (pcsm-N): one ACTIVE,
# the rest STANDBY. Each PCSM keeps its default localhost:2242 listener, which
# also serves /start and /finalize unauthenticated, so PMM Client runs beside
# it and PMM scrapes it in push mode. The URIs are in each pcsm-N's
# environment, so a test that stops an instance with `pkill -x pcsm` restarts
# it with `docker exec --detach pcsm-N sh -c 'exec pcsm >>/var/log/pcsm.log 2>&1'`.
setup_pcsm() {
  local version source_version target_version nodes_count instances client tarball='' node i
  local -a src_nodes=() tgt_nodes=() pcsm_nodes=()
  version=$(resolved_version PCSM_VERSION PCSM "$DB_VERSION")
  source_version=$(resolve_value PCSM SOURCE_VERSION DB_CONFIG)
  target_version=$(resolve_value PCSM TARGET_VERSION DB_CONFIG)
  nodes_count=$(resolve_value PCSM NODES_COUNT DB_CONFIG)
  instances=$(resolve_value PCSM INSTANCES DB_CONFIG)
  client=$(resolved_client_version PCSM DB_CONFIG)

  pcsm_supported SOURCE_VERSION "$source_version"
  pcsm_supported TARGET_VERSION "$target_version"
  if ((${target_version%%.*} < ${source_version%%.*})); then
    die "PCSM cannot sync PSMDB $source_version to an older $target_version."
  fi
  [[ $nodes_count == [1-3] ]] || die "Unsupported PCSM NODES_COUNT '$nodes_count': use 1 to 3."
  [[ $instances == [1-3] ]] || die "Unsupported PCSM INSTANCES '$instances': use 1 to 3."
  for ((i = 1; i <= nodes_count; i++)); do
    src_nodes+=("pcsm-src-$i")
    tgt_nodes+=("pcsm-tgt-$i")
  done
  for ((i = 1; i <= instances; i++)); do
    pcsm_nodes+=("pcsm-$i")
  done
  local -a mongo_nodes=("${src_nodes[@]}" "${tgt_nodes[@]}")
  local -a all_nodes=("${mongo_nodes[@]}" "${pcsm_nodes[@]}")

  step "Prepare image pmm-qa/psmdb:$source_version-ol9" ensure_image psmdb "$source_version-ol9"
  if [[ $target_version != "$source_version" ]]; then
    step "Prepare image pmm-qa/psmdb:$target_version-ol9" ensure_image psmdb "$target_version-ol9"
  fi
  step "Prepare image pmm-qa/pcsm:$version" ensure_image pcsm "$version"
  tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."

  # Every name a larger topology could have left behind.
  fresh_containers pcsm-src-{1..3} pcsm-tgt-{1..3} pcsm-{1..3}
  ensure_pmm_network
  step 'Start the source replica set rs-src' pcsm_replset rs-src "$source_version" "${src_nodes[@]}"
  step 'Start the target replica set rs-tgt' pcsm_replset rs-tgt "$target_version" "${tgt_nodes[@]}"
  step 'Create the PCSM users' pcsm_users
  step 'Load data into the source' pcsm_load
  step 'Start PCSM' each_node pcsm_nodes pcsm_start
  step 'Wait for PMM Server' wait_pmm_server_ready
  step 'Install PMM Client' each_node all_nodes install_pmm_client "$client" "$tarball"

  log_info '==> Register with PMM'
  for node in "${all_nodes[@]}"; do
    setup_pmm_agent "$node" false /var/log/pmm-agent.log "$node${SHARD_NAME:+-$SHARD_NAME}"
    wait_pmm_agent "$node"
    pcsm_register "$node"
  done
  step 'Wait for exporters' each_node mongo_nodes wait_exporters /var/log/pmm-agent.log mongodb_exporter
  step 'Wait for the PCSM node exporters' each_node pcsm_nodes wait_exporters /var/log/pmm-agent.log

  # After registering, so PMM charts the initial clone.
  step 'Start the sync' pcsm_sync
  step 'Start the source workload' pcsm_workload
  report_agent_status "${all_nodes[@]}"
}

readonly PCSM_PASSWORD=pcsmpass

# PCSM 1.0 syncs these PSMDB majors; the psmdb image's 8.3 is not one of them.
# Usage: pcsm_supported OPTION VERSION
pcsm_supported() {
  case $2 in
    6.0 | 7.0 | 8.0) ;;
    *) die "Unsupported PCSM $1 '$2': PCSM syncs PSMDB 6.0, 7.0 and 8.0." ;;
  esac
}

# Start mongod on MEMBERS and initiate replica set NAME with the root and pmm
# users. The image's systemd unit needs pmm_psmdb-pbm_setup's mounts, so
# mongod runs as the container's command, with the image's keyfile.
# Usage: pcsm_replset NAME VERSION MEMBERS...
pcsm_replset() {
  local name=$1 image=pmm-qa/psmdb:$2-ol9 node
  shift 2
  local -a members=("$@")
  for node in "${members[@]}"; do
    must docker run --detach --name "$node" --hostname "$node" --label pmm-qa.engine=pcsm --network pmm-qa \
      "$image" mongod --replSet "$name" --bind_ip_all --keyFile /etc/keyfile >/dev/null
  done
  each_node members psmdb_wait_mongod
  psmdb_replset "$name" '' false "${members[@]}"
}

# The source and target roles of PCSM's authentication docs.
pcsm_users() {
  psmdb_js "${src_nodes[0]}" "$PSMDB_ROOT_URI" \
    "db.getSiblingDB(\"admin\").createUser({ user: \"pcsm_source\", pwd: \"$PCSM_PASSWORD\", roles: [\"backup\", \"clusterMonitor\", \"readAnyDatabase\"] })" \
    >/dev/null || die 'Creating the PCSM source user failed.'
  psmdb_js "${tgt_nodes[0]}" "$PSMDB_ROOT_URI" \
    "db.getSiblingDB(\"admin\").createUser({ user: \"pcsm_target\", pwd: \"$PCSM_PASSWORD\", roles: [\"restore\", \"clusterMonitor\", \"clusterManager\", \"readWriteAnyDatabase\"] })" \
    >/dev/null || die 'Creating the PCSM target user failed.'
}

# About 100 MB, so the dashboard's copy panels have a clone to chart.
pcsm_load() {
  psmdb_js "${src_nodes[0]}" "$PSMDB_ROOT_URI" 'const orders = db.getSiblingDB("pcsm_qa").orders;
    for (let i = 0; i < 200; i++) orders.insertMany(Array.from({ length: 1000 }, (_, j) => ({ i, j, pad: "x".repeat(500) })));' \
    >/dev/null || die 'Loading the source data failed.'
}

# Usage: pcsm_uri USER REPLSET MEMBERS...
pcsm_uri() {
  local user=$1 name=$2 hosts
  shift 2
  hosts=$(printf '%s:27017,' "$@")
  printf 'mongodb://%s:%s@%s/?replicaSet=%s' "$user" "$PCSM_PASSWORD" "${hosts%,}" "$name"
}

pcsm_start() {
  must docker run --detach --name "$1" --hostname "$1" --label pmm-qa.engine=pcsm --network pmm-qa \
    --env "PCSM_SOURCE_URI=$(pcsm_uri pcsm_source rs-src "${src_nodes[@]}")" \
    --env "PCSM_TARGET_URI=$(pcsm_uri pcsm_target rs-tgt "${tgt_nodes[@]}")" \
    --env PCSM_GROUP_NAME=pcsm-sync-1 "pmm-qa/pcsm:$version" >/dev/null
  must docker exec --detach "$1" sh -c 'exec pcsm >>/var/log/pcsm.log 2>&1'
  if ! (retry 60 "PCSM on $1" docker exec "$1" curl -fsS http://127.0.0.1:2242/metrics >/dev/null); then
    docker exec "$1" tail -20 /var/log/pcsm.log >&2 || true
    die "PCSM did not start on $1."
  fi
}

pcsm_register() {
  local node=$1 replset
  if [[ $node == pcsm-[0-9] ]]; then
    pmm_register "$node" pmm-admin add external "--service-name=$node" --group=pcsm --cluster=pcsm-sync-1 \
      --environment=pcsm-dev --listen-port=2242 --metrics-path=/metrics --scheme=http --metrics-mode=push
    return
  fi
  replset=rs-${node:5:3}
  pmm_register "$node" pmm-admin add mongodb --enable-all-collectors --username=pmm --password=pmmpass \
    "--host=$node" --port=27017 --environment=pcsm-dev "--cluster=$replset" "--replication-set=$replset" "$node"
}

# Stdout: the instance that holds the HA lease
pcsm_active() {
  local node metrics
  for node in "${pcsm_nodes[@]}"; do
    metrics=$(docker exec "$node" curl -fsS http://127.0.0.1:2242/metrics) || continue
    if [[ $metrics == *$'\npercona_clustersync_mongodb_ha_active 1'* ]]; then
      printf '%s' "$node"
      return 0
    fi
  done
  return 1
}

# A STANDBY answers 409, so the sync starts on the ACTIVE instance. The wait
# covers the whole initial clone, which a failover cannot resume.
pcsm_sync() {
  local active
  active=$(retry 60 'an ACTIVE PCSM instance' pcsm_active)
  log_info "ACTIVE PCSM instance: $active"
  must docker exec "$active" pcsm start >/dev/null
  retry 600 "the initial sync on $active" docker exec "$active" sh -c \
    'pcsm status | jq -e ".state == \"running\" and .initialSync.completed" >/dev/null' >/dev/null
}

pcsm_workload() {
  must docker exec --detach "${src_nodes[0]}" mongo --quiet "$PSMDB_ROOT_URI" --eval \
    'const orders = db.getSiblingDB("pcsm_qa").orders; while (true) { orders.insertOne({ ts: new Date(), pad: "x".repeat(500) }); sleep(100); }'
}
