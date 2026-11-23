#!/usr/bin/env bash
#
# images/psmdb/setup.sh -- PSMDB and SSL_PSMDB, on the prebaked psmdb image.

# The containers still come from pmm_psmdb-pbm_setup's compose files, so names,
# networks, ports and volumes match what tests expect: the image is tagged
# replica_member/local, which compose then runs instead of building. What the
# stack's scripts did after `up` -- initiating, users, PBM, registration, data
# -- happens here, polling for readiness instead of sleeping 60 s per step.
#
# SETUP_TYPE pss/psa is the replica set (COMPOSE_PROFILES=extra adds a second
# one, rs201-rs203); 'shards' and 'sharding' are the sharded cluster; 'standalone_no_pbm'
# is one mongod in its own container, with no replica set and no PBM.
# QUERY_SOURCE=mongolog makes every mongod and mongos log to a file for QAN to read.
setup_psmdb() {
  local version ol client setup_type profile gssapi minio query_source external_pbm tarball='' suffix
  version=$(resolved_version PSMDB_VERSION PSMDB "$DB_VERSION")
  ol=$(resolve_value PSMDB OL_VERSION DB_CONFIG)
  client=$(resolved_client_version PSMDB DB_CONFIG)
  setup_type=$(resolve_value PSMDB SETUP_TYPE DB_CONFIG)
  setup_type=${setup_type,,}
  profile=$(resolve_value PSMDB COMPOSE_PROFILES DB_CONFIG)
  gssapi=$(resolve_value PSMDB GSSAPI DB_CONFIG)
  minio=$(bool_string "$(resolve_value PSMDB MINIO DB_CONFIG)")
  query_source=$(resolve_value PSMDB QUERY_SOURCE DB_CONFIG)
  query_source=${query_source,,}
  external_pbm=$(bool_string "$(resolve_value PSMDB EXTERNAL_PBM DB_CONFIG)")
  suffix=$RANDOM

  case $setup_type in
    pss | psa | shards | sharding | standalone_no_pbm) ;;
    *) die "Unsupported PSMDB SETUP_TYPE '$setup_type'." ;;
  esac
  case $query_source in
    profiler | mongolog | none) ;;
    *) die "Unsupported PSMDB QUERY_SOURCE '$query_source'." ;;
  esac
  if [[ $setup_type == standalone_no_pbm && ($(bool_string "$gssapi") == true || $profile == extra ||
    $(resolve_value PSMDB STORAGE_ENGINE DB_CONFIG) == [iI][nN][mM][eE][mM][oO][rR][yY]) ]]; then
    die 'PSMDB SETUP_TYPE=standalone_no_pbm does not support GSSAPI, the extra compose profile or the inMemory STORAGE_ENGINE.'
  fi
  if [[ $external_pbm == true ]]; then
    [[ $setup_type != standalone_no_pbm ]] ||
      die 'PSMDB EXTERNAL_PBM=true needs PBM, which SETUP_TYPE=standalone_no_pbm does not run.'
    [[ $minio == true ]] || die 'PSMDB EXTERNAL_PBM=true needs MINIO=true: the backups go to its storage.'
    [[ $profile != extra ]] || die 'PSMDB EXTERNAL_PBM=true does not support the extra compose profile.'
  fi
  step "Prepare image pmm-qa/psmdb:$version-ol$ol" ensure_image psmdb "$version-ol$ol"
  # The standalone runs the image by name: retagging would clobber the replica set running beside it.
  if [[ $setup_type != standalone_no_pbm ]]; then
    must docker tag "pmm-qa/psmdb:$version-ol$ol" replica_member/local
  fi
  tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."
  (
    cd "$QA_INTEGRATION_ROOT/pmm_psmdb-pbm_setup" || die 'pmm_psmdb-pbm_setup is missing.'
    export PMM_SERVER_CONTAINER_ADDRESS=$PMM_SERVER_HOST:$PMM_SERVER_PORT ADMIN_PASSWORD
    ADMIN_PASSWORD=$(admin_password)
    if [[ $setup_type == standalone_no_pbm ]]; then
      psmdb_standalone "pmm-qa/psmdb:$version-ol$ol"
    elif [[ $setup_type == ps? ]]; then
      psmdb_replica_set
    else
      psmdb_sharded
    fi
  )
}

readonly PSMDB_NETWORKS=(pmm-qa qa-integration pmm-ui-tests_pmm-network pmm2-upgrade-tests_pmm-network pmm2-ui-tests_pmm-network)
readonly PSMDB_CONTAINERS=(rs101 rs102 rs103 rs201 rs202 rs203 rscfg01 rscfg02 rscfg03 mongos chunk-churn kerberos)
readonly PSMDB_ROOT_URI=mongodb://root:root@127.0.0.1:27017/admin

# Usage: psmdb_start COMPOSE_FILE
psmdb_start() {
  local network
  for network in "${PSMDB_NETWORKS[@]}"; do
    docker network inspect "$network" >/dev/null 2>&1 || must docker network create "$network" >/dev/null
  done
  must docker compose -f "$1" down -v --remove-orphans
  docker rm -fv "${PSMDB_CONTAINERS[@]}" >/dev/null 2>&1 || true
  if [[ $minio == true ]]; then
    must docker compose -f "$1" up -d --no-deps minio createbucket
  fi
  must docker compose -f "$1" up -d
}

# Usage: psmdb_js NODE [URI] SCRIPT
psmdb_js() {
  local node=$1
  shift
  docker exec -i "$node" mongo --quiet "${@:1:$#-1}" --eval "${!#}"
}

# Usage: psmdb_true NODE [URI] SCRIPT  (succeeds when SCRIPT prints true)
psmdb_true() {
  [[ $(psmdb_js "$@") == true ]]
}

psmdb_wait_mongod() {
  retry 120 "mongod on $1" psmdb_js "$1" 'db.adminCommand({ ping: 1 }).ok' >/dev/null
}

# The root, pbm and pmm users; EXTERNAL=true adds the Kerberos user, which only
# the pss replica set gets.
# Usage: psmdb_users_js EXTERNAL
psmdb_users_js() {
  local roles='[{ role: "explainRole", db: "admin" }, { role: "clusterMonitor", db: "admin" }, { role: "read", db: "local" },
    { db: "admin", role: "readWrite", collection: "" }, { db: "admin", role: "backup" }, { db: "admin", role: "clusterMonitor" },
    { db: "admin", role: "restore" }, { db: "admin", role: "pbmAnyAction" }]'
  printf '%s\n' 'const admin = db.getSiblingDB("admin");' \
    'admin.createUser({ user: "root", pwd: "root", roles: ["root", "userAdminAnyDatabase", "clusterAdmin"] });' \
    'admin.auth("root", "root");' \
    'admin.createRole({ role: "pbmAnyAction", privileges: [{ resource: { anyResource: true }, actions: ["anyAction"] }], roles: [] });' \
    'admin.createRole({ role: "explainRole", privileges: [{ resource: { db: "", collection: "" },
       actions: ["listIndexes", "listCollections", "dbStats", "dbHash", "collStats", "find"] }], roles: [] });' \
    'admin.createUser({ user: "pbm", pwd: "pbmpass", roles: [{ db: "admin", role: "readWrite", collection: "" },
       { db: "admin", role: "backup" }, { db: "admin", role: "clusterMonitor" }, { db: "admin", role: "restore" },
       { db: "admin", role: "pbmAnyAction" }] });' \
    "admin.createUser({ user: \"pmm\", pwd: \"pmmpass\", roles: $roles });"
  if [[ $1 == true ]]; then
    printf '%s\n' "db.getSiblingDB(\"\$external\").createUser({ user: \"pmm@PERCONATEST.COM\", roles: $roles });"
  fi
}

# Initiate replica set NAME over MEMBERS (the first one, priority 2, becomes
# primary), create the users on it, and wait until every member is healthy.
# ARBITER names the arbiter member, or is empty.
# Usage: psmdb_replset NAME ARBITER EXTERNAL MEMBERS...
psmdb_replset() {
  local name=$1 arbiter=$2 external=$3 id=0 member members=''
  shift 3
  for member in "$@"; do
    if [[ $member == "$arbiter" ]]; then
      members+="{ _id: $id, host: \"$member:27017\", arbiterOnly: true },"
    else
      members+="{ _id: $id, host: \"$member:27017\", priority: $((id == 0 ? 2 : 1)) },"
    fi
    id=$((id + 1))
  done
  psmdb_js "$1" "rs.initiate({ _id: \"$name\", members: [${members%,}] })" >/dev/null ||
    die "Initiating replica set $name failed."
  retry 120 "$1 to become the $name primary" psmdb_true "$1" 'db.hello().isWritablePrimary'
  psmdb_js "$1" "$(psmdb_users_js "$external")" >/dev/null || die "Creating the $name users failed."
  retry 120 "every $name member to be healthy" psmdb_true "$1" "$PSMDB_ROOT_URI" \
    'rs.status().members.every(m => [1, 2, 7].includes(m.state))'
}

# Point pbm-agent at the pbm user and restart it.
psmdb_pbm_agent() {
  must docker exec "$1" sh -c 'echo "PBM_MONGODB_URI=mongodb://pbm:pbmpass@127.0.0.1:27017" > /etc/sysconfig/pbm-agent'
  must docker exec "$1" systemctl restart pbm-agent
}

psmdb_mask_pbm_agent() {
  must docker exec "$1" systemctl mask --now pbm-agent
}

# Usage: psmdb_pbm_uri REPLICA_SET NODE...
psmdb_pbm_uri() {
  local set=$1 hosts
  shift
  hosts=$(printf '%s:27017,' "$@")
  printf 'mongodb://pbm:pbmpass@%s/?replicaSet=%s' "${hosts%,}" "$set"
}

# PBM from the Percona repository, as the PBM documentation installs it.
psmdb_pbm_install() {
  retry_on "$PMM_REPO_ERRORS" 3 "PBM install on $1" docker exec --user root "$1" sh -ceu "
    dnf install -y https://repo.percona.com/yum/percona-release-latest.noarch.rpm
    percona-release enable pbm release
    dnf install -y percona-backup-mongodb-$PBM_VERSION.el9 cronie" >/dev/null
}

# PBM run the way a customer does who drives it from a host of their own, not through PMM Backup
# Management: an empty container on the setups' base, one pbm-agent per member reaching its mongod
# over the network, PITR on and a cron job taking a logical backup every 15 minutes.
# Usage: psmdb_external_pbm CLUSTER_URI NODE...
psmdb_external_pbm() {
  local uri=$1 name=pbm-external node
  shift
  ensure_pmm_network
  fresh_containers "$name"
  log_info '==> Start the external PBM container'
  must docker run --detach --name "$name" --hostname "$name" --label pmm-qa.engine=psmdb --network pmm-qa \
    --volume "$PWD/conf/pbm:/etc/pbm:ro" "${SYSTEMD_RUN[@]}" "$BASE_OS" /usr/sbin/init >/dev/null
  retry 30 'systemd in the external PBM container' docker exec "$name" test -d /run/systemd/system
  step 'Install PBM' psmdb_pbm_install "$name"
  # The package's unit, with an environment file per member.
  must docker exec "$name" sh -ceu "sed 's#/etc/sysconfig/pbm-agent#&-%i#' /usr/lib/systemd/system/pbm-agent.service >/etc/systemd/system/pbm-agent@.service
    systemctl daemon-reload"
  for node in "$@"; do
    must docker exec "$name" sh -c "echo 'PBM_MONGODB_URI=mongodb://pbm:pbmpass@$node:27017' >/etc/sysconfig/pbm-agent-$node"
    must docker exec "$name" systemctl enable --now "pbm-agent@$node"
  done
  retry 60 'the PBM storage configuration' docker exec -e "PBM_MONGODB_URI=$uri" "$name" pbm config --file /etc/pbm/minio.yaml >/dev/null
  must docker exec -e "PBM_MONGODB_URI=$uri" "$name" pbm config --set pitr.enabled=true --set pitr.oplogSpanMin=1 >/dev/null
  must docker exec "$name" sh -c "printf '%s\n' 'PBM_MONGODB_URI=$uri' '*/15 * * * * root /usr/bin/pbm backup --type=logical >>/var/log/pbm-external-backup.log 2>&1' >/etc/cron.d/pbm-external-backup"
  must docker exec "$name" systemctl enable --now crond
  # Until every agent passes its storage check PBM nominates no node for it, and a backup started now stalls.
  retry 60 'every pbm-agent to be OK' docker exec -e "PBM_MONGODB_URI=$uri" "$name" sh -c "[ \"\$(pbm status | grep -c 'pbm-agent.*OK')\" -eq $# ]" >/dev/null
  # The base PITR needs, and something to show before the cron job's first run.
  retry 60 'the first backup' docker exec -e "PBM_MONGODB_URI=$uri" "$name" pbm backup --type=logical --wait >/dev/null
}

# Install PMM Client and run pmm-agent under systemd, logging to
# /var/log/pmm-agent.log with the Kerberos keytab.
psmdb_client() {
  install_pmm_client "$1" "$client" "$tarball"
  # The log and keytab go in a drop-in: a package upgrade replaces the unit itself.
  # shellcheck disable=SC2016 # expanded by the container's shell
  must docker exec "$1" sh -ceu '
    unit=/usr/lib/systemd/system/pmm-agent.service
    [ -f $unit ] || install -D -m 0644 "$(find /tmp/pmm-client -name pmm-agent.service -print -quit)" $unit
    mkdir -p /etc/systemd/system/pmm-agent.service.d
    printf "%s\n" "[Service]" "StandardError=file:/var/log/pmm-agent.log" \
      "Environment=\"KRB5_CLIENT_KTNAME=/keytabs/mongodb.keytab\"" >/etc/systemd/system/pmm-agent.service.d/pmm-qa.conf
    ln -sf /usr/local/percona/pmm/bin/pmm-agent /usr/sbin/pmm-agent
    ln -sf /usr/local/percona/pmm/bin/pmm-admin /usr/sbin/pmm-admin
    tr -d - </proc/sys/kernel/random/uuid >/etc/machine-id
    systemctl daemon-reload
    systemctl enable pmm-agent'
}

# Usage: psmdb_register NODE NODE_NAME SERVICE_NAME PMM_ADMIN_ADD_ARGS...
psmdb_register() {
  local node=$1 node_name=$2 service=$3
  local -a debug=() query=()
  shift 3
  if [[ $query_source != profiler ]]; then
      if [[ $query_source != profiler && ! ( $setup_type == psa && $node == rs103 ) ]]; then
        query=("--query-source=$query_source")
      fi
  fi
  if [[ $(bool_string "$CLIENT_DEBUG") == true ]]; then
    debug=(--debug)
  fi
  retry_on "$PMM_TRANSIENT_ERRORS" 10 "pmm-agent setup on $node" \
    docker exec -e "PMM_AGENT_SETUP_NODE_NAME=$node_name" "$node" pmm-agent setup \
    --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml "${debug[@]}" >/dev/null
  # Started only now: `pmm-agent setup` skips the reload of an agent not yet listening,
  # and needs --config-file when none is running.
  must docker exec "$node" systemctl restart pmm-agent
  wait_pmm_agent "$node"
  pmm_register "$node" pmm-admin add mongodb --enable-all-collectors "${query[@]}" --agent-password=mypass "$service" "$@"
}

# mongolog tails the file mongod or mongos reports as systemLog.path.
# Usage: psmdb_mongolog_config CONFIG_DIR CONFIG_FILE LOG_FILE
psmdb_mongolog_config() {
  local dir

  dir=$(mktemp -d "${TMPDIR:-/tmp}/pmm-framework-psmdb-mongolog.${1##*/}.XXXXXX") ||
    die 'Creating a private mongolog config directory failed.'

  cp -R "$1/." "$dir" || die "Copying $1 failed."

  [[ ! -L "$dir/$2" ]] || die "$dir/$2 must not be a symlink."
  sed "s#^  destination: syslog\$#  destination: file\n  path: $3\n  logAppend: true#" "$1/$2" >"$dir/$2" ||
    die "Copying $1/$2 failed."

  grep -q "^  path: $3\$" "$dir/$2" ||
    die "$1/$2 has no 'destination: syslog' line to point at a file."

  chmod 755 "$dir" || die "Making $dir accessible to MongoDB failed."

  printf '%s\n' "$dir"
}

# From 8.1 an arbiter added by hostname needs percona/pmm#6024 (PMM-15650, 3.11.0); older
# released clients use the localhost exception. Dev builds (3.10.1-v3-...) carry the fix.
psmdb_arbiter_host() {
  local node=$1 output version
  output=$(docker exec "$node" pmm-admin --version) || die "Could not read the pmm-admin version on $node."
  version=$(sed -n 's/^Version: //p' <<<"$output")
  [[ -n $version ]] || die "pmm-admin --version on $node printed no Version line."
  if [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ && $(printf '%s\n' 3.11.0 "$version" | sort -V | head -n 1) != 3.11.0 ]]; then
    printf '127.0.0.1'
  else
    printf '%s' "$node"
  fi
}

psmdb_replica_set() {
  local arbiter='' external=false node config_dir=./conf/mongod-rs
  local -a nodes=(rs101 rs102 rs103) credentials=(--username=pmm --password=pmmpass)
  local name_part=''
  if [[ $profile == extra ]]; then
    nodes+=(rs201 rs202 rs203)
  fi
  if [[ $setup_type == pss ]]; then
    external=true
  fi
  if [[ $gssapi == true ]]; then
    credentials=(--username=pmm@PERCONATEST.COM --password=password1 --authentication-mechanism=GSSAPI
      "--authentication-database=\$external")
    name_part=_gssapi
  fi
  export COMPOSE_PROJECT_NAME=psmdb_pss COMPOSE_PROFILES=$profile
  if [[ $(resolve_value PSMDB STORAGE_ENGINE DB_CONFIG) == [iI][nN][mM][eE][mM][oO][rR][yY] ]]; then
    config_dir=./conf/mongod-rs-inmemory
  fi
  if [[ $query_source == mongolog ]]; then
    config_dir=$(psmdb_mongolog_config "$config_dir" mongod.conf /var/log/mongo/mongod.log)
  fi
  if [[ $config_dir != ./conf/mongod-rs ]]; then
    export MONGOD_RS_CONFIG_DIR=$config_dir
  fi

  step 'Prepare image pmm-qa/kerberos:latest' ensure_image kerberos latest
  must docker tag pmm-qa/kerberos:latest kerberos/local
  step 'Start replica set containers' psmdb_start docker-compose-rs.yaml
  step 'Wait for mongod' each_node nodes psmdb_wait_mongod
  if [[ $setup_type == psa ]]; then
    arbiter=rs103
  fi
  step 'Initiate replica set rs' psmdb_replset rs "$arbiter" "$external" rs101 rs102 rs103
  if [[ $profile == extra ]]; then
    step 'Initiate the extra replica set' psmdb_replset rs "${arbiter/103/203}" "$external" rs201 rs202 rs203
  fi
  step 'Wait for PMM Server' wait_pmm_server_ready
  step 'Install PMM Client' each_node nodes psmdb_client
  if [[ $external_pbm == true ]]; then
    local -a members=(rs101 rs102 rs103)
    if [[ -n $arbiter ]]; then
      members=(rs101 rs102)
    fi
    step 'Disable the members pbm-agent' each_node nodes psmdb_mask_pbm_agent
    psmdb_external_pbm "$(psmdb_pbm_uri rs "${members[@]}")" "${members[@]}"
  else
    step 'Configure PBM' each_node nodes psmdb_pbm_agent
    must docker exec rs101 pbm config --file /etc/pbm/minio.yaml >/dev/null
    if [[ -n $arbiter ]]; then
      must docker exec rs103 systemctl stop pbm-agent
      if [[ $profile == extra ]]; then
        must docker exec rs203 systemctl stop pbm-agent
      fi
    fi
  fi

  log_info '==> Register with PMM'
  for node in "${nodes[@]}"; do
    # The extra set gets no environment, and a replication set only on its arbiter.
    local -a labels=(--environment=psmdb-dev --cluster=replicaset --replication-set=rs)
    if [[ $node == rs20? ]]; then
      labels=(--cluster=replicaset)
      if [[ $node == "${arbiter/103/203}" ]]; then
        labels+=(--replication-set=rs1)
      fi
    fi
    if [[ $node == "$arbiter" || $node == "${arbiter/103/203}" ]]; then
      # An arbiter holds no users. Added by hostname like the other members where the
      # client allows it, so the inventory addresses match.
      local arbiter_host
      arbiter_host=$(psmdb_arbiter_host "$node") || die "Could not pick the address to add arbiter $node by."
      psmdb_register "$node" "$node._$suffix" "$node${name_part}_$suffix" "${labels[@]}" \
        "--host=$arbiter_host" --port=27017
    else
      psmdb_register "$node" "$node._$suffix" "$node${name_part}_$suffix" "${labels[@]}" "${credentials[@]}" \
        "--host=$node" --port=27017
    fi
  done
  step 'Wait for exporters' each_node nodes wait_exporters /var/log/pmm-agent.log mongodb_exporter

  step 'Load data' psmdb_rs_data
  report_agent_status "${nodes[@]}"
}

psmdb_rs_data() {
  # shellcheck disable=SC2016 # $match is MongoDB's
  psmdb_js rs101 'mongodb://pmm:pmmpass@127.0.0.1:27017/?replicaSet=rs' '
    db.getSiblingDB("students").students.insertMany([
      { sID: 22001, name: "Alex", year: 1, score: 4.0 }, { sID: 21001, name: "bernie", year: 2, score: 3.7 },
      { sID: 20010, name: "Chris", year: 3, score: 2.5 }, { sID: 22021, name: "Drew", year: 1, score: 3.2 }]);
    db.getSiblingDB("students").createView("firstYears", "students", [{ $match: { year: 1 } }]);' >/dev/null ||
    die 'Loading the students data failed.'
  must docker exec rs101 mgodatagen -f /etc/datagen/replicaset.json \
    '--uri=mongodb://pmm:pmmpass@127.0.0.1:27017/?replicaSet=rs' >/dev/null
}

psmdb_add_shard() {
  psmdb_js mongos "$PSMDB_ROOT_URI" "sh.addShard(\"$1\")" >/dev/null || die "Adding shard $1 failed."
}

psmdb_sharded_data() {
  must docker exec mongos mgodatagen -f /etc/datagen/sharded.json --uri=mongodb://root:root@127.0.0.1:27017 >/dev/null
}

# Usage: psmdb_shard_set LEADER  (rs101, rs201 or rscfg01)
psmdb_shard_set() {
  local name=${1%01}
  psmdb_replset "$name" '' false "${name}01" "${name}02" "${name}03"
}

psmdb_sharded() {
  local node
  # shellcheck disable=SC2034  # each_node reads leaders by name
  local -a nodes=(rs101 rs102 rs103 rs201 rs202 rs203 rscfg01 rscfg02 rscfg03) leaders=(rs101 rs201 rscfg01)
  local -a clients=("${nodes[@]}" mongos)
  export COMPOSE_PROJECT_NAME=psmdb_sharded
  if [[ $query_source == mongolog ]]; then
    MONGOD_RS1_CONFIG_DIR=$(psmdb_mongolog_config ./conf/mongod-rs1 mongod.conf /var/log/mongo/mongod.log)
    MONGOD_RS2_CONFIG_DIR=$(psmdb_mongolog_config ./conf/mongod-rs2 mongod.conf /var/log/mongo/mongod.log)
    MONGOD_CFG_CONFIG_DIR=$(psmdb_mongolog_config ./conf/mongod-cfg mongod.conf /var/log/mongo/mongod.log)
    MONGOS_CONFIG_DIR=$(psmdb_mongolog_config ./conf/mongos mongos.conf /var/log/mongo/mongos.log)
    export MONGOD_RS1_CONFIG_DIR MONGOD_RS2_CONFIG_DIR MONGOD_CFG_CONFIG_DIR MONGOS_CONFIG_DIR
  fi

  step 'Start sharded cluster containers' psmdb_start docker-compose-sharded.yaml
  step 'Wait for mongod' each_node nodes psmdb_wait_mongod
  step 'Initiate rs1, rs2 and rscfg' each_node leaders psmdb_shard_set
  step 'Wait for mongos' psmdb_wait_mongod mongos
  local shard
  for shard in 'rs1/rs101:27017,rs102:27017,rs103:27017' 'rs2/rs201:27017,rs202:27017,rs203:27017'; do
    step "Add shard ${shard%%/*}" psmdb_add_shard "$shard"
  done
  step 'Wait for PMM Server' wait_pmm_server_ready
  step 'Install PMM Client' each_node clients psmdb_client
  if [[ $external_pbm == true ]]; then
    step 'Disable the members pbm-agent' each_node nodes psmdb_mask_pbm_agent
    psmdb_external_pbm "$(psmdb_pbm_uri rscfg rscfg01 rscfg02 rscfg03)" "${nodes[@]}"
  else
    step 'Configure PBM' each_node nodes psmdb_pbm_agent
    # Storage for the PBM a person drives by hand; PMM's own backups set theirs.
    if [[ $minio == true ]]; then
      must docker exec rscfg01 pbm config --file /etc/pbm/minio.yaml >/dev/null
    fi
  fi

  log_info '==> Register with PMM'
  for node in "${nodes[@]}"; do
    psmdb_register "$node" "$node._$suffix" "${node}_$suffix" --environment=mongo-sharded-dev --cluster=sharded \
      "--replication-set=${node%0*}" --username=pmm --password=pmmpass "--host=$node" --port=27017
  done
  # FTDC is off on a mongos until it has a directory, and PMM reads the
  # router's serverStatus metrics out of it. A mongos that logs to a file
  # already writes it next to the log, and its directory can be set only once.
  if [[ $query_source != mongolog ]]; then
    must docker exec mongos sh -c 'mkdir -p /var/lib/mongo/mongos.diagnostic.data && chown -R mongod:mongod /var/lib/mongo/mongos.diagnostic.data'
    psmdb_js mongos "$PSMDB_ROOT_URI" 'db.adminCommand({ setParameter: 1, diagnosticDataCollectionDirectoryPath: "/var/lib/mongo/mongos.diagnostic.data" });
    db.adminCommand({ setParameter: 1, diagnosticDataCollectionEnabled: true });' >/dev/null || die 'Enabling FTDC on mongos failed.'
  fi
  # indexstats is off on the router: $indexStats there returns one row per
  # shard, which the exporter reports as duplicate series.
  psmdb_register mongos "mongos_$suffix" "mongos_$suffix" --disable-collectors=indexstats --environment=mongo-sharded-dev \
    --cluster=sharded --username=pmm --password=pmmpass 127.0.0.1:27017
  step 'Wait for exporters' each_node clients wait_exporters /var/log/pmm-agent.log mongodb_exporter

  step 'Load data' psmdb_sharded_data
  # Chunk moves and splits come from the compose file's chunk-churn service.
  step 'Start the workload' psmdb_traffic
  report_agent_status "${clients[@]}"
}

psmdb_traffic() {
  COMPOSE_FILE=docker-compose-sharded.yaml must bash ./generate_opcountersrepl_traffic.sh >/dev/null
}

# One mongod with authentication and no replica set. Its pbm-agent is masked, so
# the exporter sees a server PBM does not manage. No host port is published.
# Usage: psmdb_standalone IMAGE
psmdb_standalone() {
  local image=$1 name=psmdb-standalone config_dir=$PWD/conf/mongod-standalone
  local -x PMM_AGENT_SERVER_PASSWORD=$ADMIN_PASSWORD
  if [[ $query_source == mongolog ]]; then
    config_dir=$(psmdb_mongolog_config "$config_dir" mongod.conf /var/log/mongo/mongod.log)
  fi
  ensure_pmm_network
  fresh_containers "$name"
  log_info '==> Start the standalone container'
  must docker run --detach --name "$name" --hostname "$name" --label pmm-qa.engine=psmdb --network pmm-qa \
    -e "PMM_AGENT_SERVER_ADDRESS=$PMM_SERVER_CONTAINER_ADDRESS" -e PMM_AGENT_SERVER_USERNAME=admin \
    -e PMM_AGENT_SERVER_PASSWORD -e PMM_AGENT_SERVER_INSECURE_TLS=1 \
    --volume "$config_dir:/etc/mongod" --volume "$PWD/conf/datagen:/etc/datagen:ro" \
    "${SYSTEMD_RUN[@]}" "$image" >/dev/null
  step 'Wait for mongod' psmdb_wait_mongod "$name"
  step 'Disable pbm-agent' docker exec "$name" systemctl mask --now pbm-agent
  step 'Create users' psmdb_standalone_users "$name"
  step 'Wait for PMM Server' wait_pmm_server_ready
  step 'Install PMM Client' psmdb_client "$name"

  log_info '==> Register with PMM'
  psmdb_register "$name" "$name._$suffix" "${name}_$suffix" --environment=psmdb-dev --cluster=standalone \
    --username=pmm --password=pmmpass "--host=$name" --port=27017
  step 'Wait for exporters' wait_exporters "$name" /var/log/pmm-agent.log mongodb_exporter
  step 'Load data' psmdb_standalone_data "$name"
  report_agent_status "$name"
}

# The localhost exception sometimes refuses the first user just after mongod starts,
# and creates nothing, so retrying that refusal is safe.
psmdb_standalone_users() {
  retry_on 'requires authentication' 30 "creating the users on $1" psmdb_js "$1" "$(psmdb_users_js false)" >/dev/null
}

psmdb_standalone_data() {
  must docker exec "$1" mgodatagen -f /etc/datagen/replicaset.json --uri=mongodb://pmm:pmmpass@127.0.0.1:27017 >/dev/null
}

# TLS and LDAP from pmm_psmdb_diffauth_setup's compose stack. A throwaway compose override disables the stack's own pmm-server and kerberos
# services (the framework supplies the server), resets psmdb-server's
# depends_on, and joins the external pmm-qa network. It references ${ADMIN_PASSWORD} and
# ${PMM_SERVER_CONTAINER_ADDRESS} as literals -- escaped in the heredoc -- so
# compose expands them at run time and no secret is written to disk.
setup_ssl_psmdb() {
  local version client minio tarball='' temp_dir
  version=$(resolved_version PSMDB_VERSION SSL_PSMDB "$DB_VERSION")
  client=$(resolved_client_version SSL_PSMDB DB_CONFIG)
  minio=$(bool_string "$(resolve_value SSL_PSMDB MINIO DB_CONFIG)")

  step "Prepare image pmm-qa/psmdb:$version-ol9" ensure_image psmdb "$version-ol9"
  tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."
  temp_dir=$(mktemp -d "${TMPDIR:-/tmp}/pmm-framework-ssl-psmdb.XXXXXX")
  # The image is set here, not retagged replica_member/local: a PSMDB setup
  # running alongside tags that name with its own version.
  cat >"$temp_dir/compose.yml" <<EOF
services:
  pmm-server:
    profiles: [framework-disabled]
  kerberos:
    profiles: [framework-disabled]
  psmdb-server:
    image: pmm-qa/psmdb:$version-ol9
    depends_on: !reset {}
    environment:
      PMM_AGENT_SERVER_PASSWORD: "\${ADMIN_PASSWORD}"
      PMM_AGENT_SERVER_ADDRESS: "\${PMM_SERVER_CONTAINER_ADDRESS}"
    networks:
      - default
      - pmm-qa
networks:
  pmm-qa:
    external: true
    name: pmm-qa
EOF
  local status=0
  (
    cd "$QA_INTEGRATION_ROOT/pmm_psmdb_diffauth_setup" || die 'pmm_psmdb_diffauth_setup is missing.'
    export PMM_SERVER_CONTAINER_ADDRESS=$PMM_SERVER_HOST:$PMM_SERVER_PORT ADMIN_PASSWORD
    ADMIN_PASSWORD=$(admin_password)
    ssl_psmdb_run "$temp_dir/compose.yml"
  ) || status=$?
  rm -rf "$temp_dir"
  return "$status"
}

ssl_psmdb_run() {
  local -a compose=(docker compose -f docker-compose-pmm-psmdb.yaml -f "$1")
  local suffix=$RANDOM tls='--tls-certificate-key-file=/mongodb_certs/client.pem --tls-ca-file=/mongodb_certs/ca-certs.pem'
  step 'Generate certificates' ssl_psmdb_certs
  ensure_pmm_network
  step 'Start psmdb-server' ssl_psmdb_start
  # psmdb-server's healthcheck is what runs rs.initiate().
  retry 270 'the psmdb-server primary' psmdb_true psmdb-server 'try { db.isMaster().ismaster } catch (e) { false }'
  step 'Create users' ssl_psmdb_users
  step 'Configure PBM' psmdb_pbm_agent psmdb-server
  step 'Wait for PMM Server' wait_pmm_server_ready
  step 'Install PMM Client' psmdb_client psmdb-server
  retry_on "$PMM_TRANSIENT_ERRORS" 10 'pmm-agent setup on psmdb-server' \
    docker exec psmdb-server pmm-agent setup --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml \
    "--server-address=$PMM_SERVER_CONTAINER_ADDRESS" --metrics-mode=auto --server-username=admin \
    "--server-password=$ADMIN_PASSWORD" --server-insecure-tls --force >/dev/null
  must docker exec psmdb-server systemctl restart pmm-agent
  wait_pmm_agent psmdb-server
  # shellcheck disable=SC2086 # $tls is two flags
  pmm_register psmdb-server pmm-admin add mongodb "psmdb-server_$suffix" --agent-password=mypass --username=pmm_mongodb \
    '--password=5M](Q%q/U+YQ<^m' --host psmdb-server --port 27017 --tls $tls --cluster=mycluster
  step 'Wait for exporters' wait_exporters psmdb-server /var/log/pmm-agent.log mongodb_exporter
  step 'Load data' ssl_psmdb_data
  report_agent_status psmdb-server
}

ssl_psmdb_certs() {
  must bash -e ./generate_certs.sh >/dev/null
}

ssl_psmdb_start() {
  must "${compose[@]}" down -v --remove-orphans
  if [[ $minio == true ]]; then
    must "${compose[@]}" up -d --no-deps minio createbucket
  fi
  # Pulls bitnamilegacy/openldap from Docker Hub, whose CDN sometimes resets.
  retry_on "$PMM_TRANSIENT_ERRORS" 5 'Start psmdb-server and ldap-server' "${compose[@]}" up -d
}

ssl_psmdb_data() {
  must docker exec psmdb-server mgodatagen -f /etc/datagen/replicaset.json --username=pmm_mongodb \
    '--password=5M](Q%q/U+YQ<^m' --host psmdb-server --port 27017 \
    --tlsCertificateKeyFile=/mongodb_certs/client.pem --tlsCAFile=/mongodb_certs/ca-certs.pem >/dev/null
}

ssl_psmdb_users() {
  # The localhost exception sometimes refuses the first user just after the
  # primary comes up; nothing is created on that attempt, so rerunning is safe.
  retry_on 'requires authentication' 30 'creating the root user' psmdb_js psmdb-server \
    'db.getSiblingDB("admin").createUser({ user: "root", pwd: "root", roles: ["root", "userAdminAnyDatabase", "clusterAdmin"] })' >/dev/null
  docker exec -i psmdb-server mongo --quiet 'mongodb://root:root@localhost/?replicaSet=rs0' <init/setup_psmdb.js >/dev/null ||
    die 'init/setup_psmdb.js failed.'
}
