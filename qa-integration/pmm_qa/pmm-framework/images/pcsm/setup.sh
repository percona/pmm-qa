#!/usr/bin/env bash
#
# images/pcsm/setup.sh -- Percona ClusterSync for MongoDB, on the prebaked pcsm image.

# Syncs rs-src (or, with SOURCE=psmdb, the PSMDB setup's rs) to rs-tgt with an HA group of pcsm-N instances.
setup_pcsm() {
  local version sync_source source_version target_version nodes_count instances handover client tarball='' node i
  local source_set=rs-src source_uri=$PSMDB_ROOT_URI
  local -a src_nodes=() tgt_nodes=() pcsm_nodes=() own_src_nodes=()
  version=$(resolved_version PCSM_VERSION PCSM "$DB_VERSION")
  sync_source=$(resolve_value PCSM SOURCE DB_CONFIG)
  sync_source=${sync_source,,}
  source_version=$(resolve_value PCSM SOURCE_VERSION DB_CONFIG)
  target_version=$(resolve_value PCSM TARGET_VERSION DB_CONFIG)
  nodes_count=$(resolve_value PCSM NODES_COUNT DB_CONFIG)
  instances=$(resolve_value PCSM INSTANCES DB_CONFIG)
  handover=$(bool_string "$(resolve_value PCSM HANDOVER DB_CONFIG)")
  client=$(resolved_client_version PCSM DB_CONFIG)

  case $sync_source in
    '' | psmdb) ;;
    *) die "Unsupported PCSM SOURCE '$sync_source': leave it empty for rs-src, or use psmdb." ;;
  esac
  if [[ $sync_source == psmdb && ( -v 'DB_CONFIG[SOURCE_VERSION]' || -n ${SOURCE_VERSION:-} ) ]]; then
    die "PCSM SOURCE_VERSION does not apply to SOURCE=psmdb, which syncs the PSMDB setup's version."
  fi
  pcsm_supported TARGET_VERSION "$target_version"
  [[ $nodes_count == [1-3] ]] || die "Unsupported PCSM NODES_COUNT '$nodes_count': use 1 to 3."
  [[ $instances == [1-3] ]] || die "Unsupported PCSM INSTANCES '$instances': use 1 to 3."
  if [[ $handover == true && $instances == 1 ]]; then
    die 'PCSM HANDOVER needs INSTANCES of 2 or 3.'
  fi
  if [[ $sync_source == psmdb ]]; then
    source_set=rs
    source_uri=$PCSM_PSMDB_URI
    src_nodes=(rs101 rs102 rs103)
    source_version=$(pcsm_psmdb_version)
    pcsm_supported 'source version' "$source_version"
  else
    pcsm_supported SOURCE_VERSION "$source_version"
    for ((i = 1; i <= nodes_count; i++)); do
      own_src_nodes+=("pcsm-src-$i")
    done
    src_nodes=("${own_src_nodes[@]}")
  fi
  if ((${target_version%%.*} < ${source_version%%.*})); then
    die "PCSM cannot sync PSMDB $source_version to an older $target_version."
  fi
  if ((${target_version%%.*} - ${source_version%%.*} > 1)); then
    die "PCSM syncs PSMDB $source_version only to the same or the next major, not $target_version."
  fi
  for ((i = 1; i <= nodes_count; i++)); do
    tgt_nodes+=("pcsm-tgt-$i")
  done
  for ((i = 1; i <= instances; i++)); do
    pcsm_nodes+=("pcsm-$i")
  done
  local -a mongo_nodes=("${own_src_nodes[@]}" "${tgt_nodes[@]}")
  local -a all_nodes=("${mongo_nodes[@]}" "${pcsm_nodes[@]}")

  if [[ $sync_source != psmdb ]]; then
    step "Prepare image pmm-qa/psmdb:$source_version-ol9" ensure_image psmdb "$source_version-ol9"
  fi
  if [[ $sync_source == psmdb || $target_version != "$source_version" ]]; then
    step "Prepare image pmm-qa/psmdb:$target_version-ol9" ensure_image psmdb "$target_version-ol9"
  fi
  step "Prepare image pmm-qa/pcsm:$version" ensure_image pcsm "$version"
  tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."

  # Every name a larger topology could have left behind.
  fresh_containers pcsm-src-{1..3} pcsm-tgt-{1..3} pcsm-{1..3}
  ensure_pmm_network
  if [[ $sync_source == psmdb ]]; then
    log_info "Syncing the PSMDB setup's replica set rs (PSMDB $source_version) to rs-tgt"
  else
    step 'Start the source replica set rs-src' pcsm_replset rs-src "$source_version" "${src_nodes[@]}"
  fi
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
  if [[ $handover == true ]]; then
    step 'Hand the HA lease to every instance, then clone again' pcsm_handover
  fi
  report_agent_status "${all_nodes[@]}"
}

readonly PCSM_PASSWORD=pcsmpass
# Long enough for an ACTIVE instance's worker and flush panels to chart a few 10 s scrapes.
readonly PCSM_HANDOVER_SECONDS=60
# setup_psmdb's replica set rs, through whichever member is primary.
readonly PCSM_PSMDB_URI='mongodb://root:root@127.0.0.1:27017/admin?replicaSet=rs'

# PCSM 1.0 syncs these PSMDB majors; the psmdb image's 8.3 is not one of them.
# Usage: pcsm_supported WHAT VERSION
pcsm_supported() {
  case $2 in
    6.0 | 7.0 | 8.0) ;;
    *) die "Unsupported PCSM $1 '$2': PCSM syncs PSMDB 6.0, 7.0 and 8.0." ;;
  esac
}

# Stdout: the major of the PSMDB setup's replica set, from rs101 (8.0.32-14 -> 8.0)
pcsm_psmdb_version() {
  local probe set version
  probe=$(psmdb_js rs101 "$PSMDB_ROOT_URI" 'db.hello().setName + " " + db.version()' 2>/dev/null) ||
    die 'PCSM SOURCE=psmdb needs a running --database psmdb replica set (SETUP_TYPE=pss or psa).'
  set=${probe%% *}
  [[ $set == rs ]] || die "PCSM SOURCE=psmdb syncs replica set rs, but rs101 is in '$set'."
  version=${probe#* }
  version=${version%%-*}
  printf '%s' "${version%.*}"
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

# The source and target roles of PCSM's authentication docs. A PSMDB source
# may hold the user from an earlier run.
pcsm_users() {
  psmdb_js "${src_nodes[0]}" "$source_uri" \
    "const admin = db.getSiblingDB(\"admin\"); admin.getUser(\"pcsm_source\") || admin.createUser({ user: \"pcsm_source\", pwd: \"$PCSM_PASSWORD\", roles: [\"backup\", \"clusterMonitor\", \"readAnyDatabase\"] })" \
    >/dev/null || die 'Creating the PCSM source user failed.'
  psmdb_js "${tgt_nodes[0]}" "$PSMDB_ROOT_URI" \
    "db.getSiblingDB(\"admin\").createUser({ user: \"pcsm_target\", pwd: \"$PCSM_PASSWORD\", roles: [\"restore\", \"clusterMonitor\", \"clusterManager\", \"readWriteAnyDatabase\"] })" \
    >/dev/null || die 'Creating the PCSM target user failed.'
}

# About 100 MB, so the dashboard's copy panels have a clone to chart.
pcsm_load() {
  psmdb_js "${src_nodes[0]}" "$source_uri" 'const orders = db.getSiblingDB("pcsm_qa").orders;
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
    --env "PCSM_SOURCE_URI=$(pcsm_uri pcsm_source "$source_set" "${src_nodes[@]}")" \
    --env "PCSM_TARGET_URI=$(pcsm_uri pcsm_target rs-tgt "${tgt_nodes[@]}")" \
    --env PCSM_GROUP_NAME=pcsm-sync-1 "pmm-qa/pcsm:$version" >/dev/null
  pcsm_run "$1"
}

# Start PCSM in its running container, from the URIs in its environment.
pcsm_run() {
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

# Usage: pcsm_is_active NODE
pcsm_is_active() {
  [[ $(docker exec "$1" curl -fsS http://127.0.0.1:2242/metrics) == *$'\npercona_clustersync_mongodb_ha_active 1'* ]]
}

# Stdout: the instance that holds the HA lease
pcsm_active() {
  local node
  for node in "${pcsm_nodes[@]}"; do
    if pcsm_is_active "$node"; then
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

# Each instance's worker panels chart only while it is ACTIVE, so every
# instance holds the lease for PCSM_HANDOVER_SECONDS while the workload runs.
# PCSM counts the clone only in the process that ran it, so a fresh run then
# clones again into the ACTIVE instance, for Copy Progress.
pcsm_handover() {
  local first node
  first=$(retry 60 'an ACTIVE PCSM instance' pcsm_active)
  sleep "$PCSM_HANDOVER_SECONDS"
  # A new ACTIVE resumes from the checkpoint the old one saves every 15 s, and
  # fails for good if it still shows the clone running.
  retry 60 'a PCSM checkpoint of the finished clone' psmdb_true "${tgt_nodes[0]}" "$PSMDB_ROOT_URI" \
    'const cp = db.getSiblingDB("percona_clustersync_mongodb").checkpoints.findOne({ _id: "pcsm" }); !!(cp && cp.data.clone && cp.data.clone.finishTime)'
  for node in "${pcsm_nodes[@]}"; do
    if [[ $node != "$first" ]]; then
      pcsm_take_lease "$node" "$PCSM_HANDOVER_SECONDS"
    fi
  done
  pcsm_reclone
}

# /start refuses a run whose clone finished, so every instance stops, the run's
# lease, members and checkpoint are reset, and the clone, which skips documents
# the target already has, starts on an empty target.
pcsm_reclone() {
  local node
  for node in "${pcsm_nodes[@]}"; do
    must docker exec "$node" pkill -x pcsm
  done
  must docker exec "${pcsm_nodes[0]}" pcsm reset >/dev/null
  psmdb_js "${tgt_nodes[0]}" "$PSMDB_ROOT_URI" \
    'db.adminCommand({ listDatabases: 1, nameOnly: true }).databases.map((d) => d.name).filter((n) => !["admin", "config", "local", "percona_clustersync_mongodb"].includes(n)).forEach((n) => db.getSiblingDB(n).dropDatabase())' \
    >/dev/null || die 'Dropping the migrated databases on the target failed.'
  for node in "${pcsm_nodes[@]}"; do
    pcsm_run "$node"
  done
  pcsm_sync
}

# A STANDBY takes an expired lease, and which one is not chosen, so every other
# instance stops until NODE holds it, then restarts as a STANDBY.
# Usage: pcsm_take_lease NODE HOLD_SECONDS
pcsm_take_lease() {
  local node=$1 other
  local -a stopped=()
  for other in "${pcsm_nodes[@]}"; do
    if [[ $other != "$node" ]]; then
      must docker exec "$other" pkill -x pcsm
      stopped+=("$other")
    fi
  done
  retry 60 "$node to take the HA lease" pcsm_is_active "$node"
  sleep "$2"
  for other in "${stopped[@]}"; do
    pcsm_run "$other"
  done
}

pcsm_workload() {
  must docker exec --detach "${src_nodes[0]}" mongo --quiet "$source_uri" --eval \
    'const orders = db.getSiblingDB("pcsm_qa").orders; while (true) { orders.insertOne({ ts: new Date(), pad: "x".repeat(500) }); sleep(100); }'
}
