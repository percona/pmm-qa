#!/usr/bin/env bash
# shellcheck disable=SC2034  # env_map is passed to run_playbook by name, so shellcheck cannot see the read.
#
# setups/mongodb.sh -- MongoDB-family setups.
#
# PSMDB and SSL_PSMDB run on the prebaked pmm-qa/psmdb image (lib/prebaked.sh);
# MLAUNCH_* and SSL_MLAUNCH hand an env map to their Ansible playbooks, as the
# setups in setups/mysql.sh used to.

# Percona Server for MongoDB as a replica set or a sharded cluster, on the
# prebaked pmm-qa/psmdb image (images/psmdb).
#
# The containers still come from pmm_psmdb-pbm_setup's compose files, so names,
# networks, ports and volumes match what tests expect: the image is tagged
# replica_member/local, which compose then runs instead of building. What the
# stack's scripts did after `up` -- initiating, users, PBM, registration, data
# -- happens here, polling for readiness instead of sleeping 60 s per step.
#
# SETUP_TYPE pss/psa is the replica set (COMPOSE_PROFILES=extra adds a second
# one, rs201-rs203); 'shards' and 'sharding' are the sharded cluster.
setup_psmdb() {
  local version ol client setup_type profile gssapi minio tarball='' suffix
  version=${PSMDB_VERSION:-${DB_VERSION:-latest}}
  if [[ $version == latest ]]; then
    version=8.0
  fi
  ol=$(resolve_value PSMDB OL_VERSION DB_CONFIG)
  client=$(resolved_client_version PSMDB DB_CONFIG)
  setup_type=$(resolve_value PSMDB SETUP_TYPE DB_CONFIG)
  setup_type=${setup_type,,}
  profile=$(resolve_value PSMDB COMPOSE_PROFILES DB_CONFIG)
  gssapi=$(resolve_value PSMDB GSSAPI DB_CONFIG)
  minio=$(bool_string "$(resolve_value PSMDB MINIO DB_CONFIG)")
  suffix=$RANDOM

  case $setup_type in
    pss | psa | shards | sharding) ;;
    *) die "Unsupported PSMDB SETUP_TYPE '$setup_type'." ;;
  esac
  step "Prepare image pmm-qa/psmdb:$version-ol$ol" ensure_image psmdb "$version-ol$ol"
  must docker tag "pmm-qa/psmdb:$version-ol$ol" replica_member/local
  if [[ $client == http* ]]; then
    tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."
  fi
  (
    cd "$QA_INTEGRATION_ROOT/pmm_psmdb-pbm_setup" || die 'pmm_psmdb-pbm_setup is missing.'
    export PMM_SERVER_CONTAINER_ADDRESS=$PMM_SERVER_HOST:$PMM_SERVER_PORT ADMIN_PASSWORD
    ADMIN_PASSWORD=$(admin_password)
    if [[ $setup_type == ps? ]]; then
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

# The users configure-replset.sh and start-sharded.sh create; EXTERNAL=true
# adds the Kerberos user, which only the pss replica set gets.
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

# Point pbm-agent at the pbm user and restart it, as configure-agents.sh does.
psmdb_pbm_agent() {
  must docker exec "$1" sh -c 'echo "PBM_MONGODB_URI=mongodb://pbm:pbmpass@127.0.0.1:27017" > /etc/sysconfig/pbm-agent'
  must docker exec "$1" systemctl restart pbm-agent
}

# Install PMM Client and run pmm-agent under systemd, with the log path and
# Kerberos keytab the stack's Dockerfile gave the unit.
psmdb_client() {
  install_pmm_client "$1" "$client" "$tarball"
  # shellcheck disable=SC2016 # expanded by the container's shell
  must docker exec "$1" sh -ceu '
    unit=/usr/lib/systemd/system/pmm-agent.service
    [ -f $unit ] || install -D -m 0644 "$(find /tmp/pmm-client -name pmm-agent.service -print -quit)" $unit
    sed -i -e "/ExecStart/a StandardError=file:/var/log/pmm-agent.log" \
      -e "/\[Service\]/a Environment=\"KRB5_CLIENT_KTNAME=/keytabs/mongodb.keytab\"" $unit
    ln -sf /usr/local/percona/pmm/bin/pmm-agent /usr/sbin/pmm-agent
    ln -sf /usr/local/percona/pmm/bin/pmm-admin /usr/sbin/pmm-admin
    tr -d - </proc/sys/kernel/random/uuid >/etc/machine-id
    systemctl daemon-reload
    systemctl enable pmm-agent
    systemctl restart pmm-agent'
}

# Usage: psmdb_register NODE NODE_NAME SERVICE_NAME PMM_ADMIN_ADD_ARGS...
psmdb_register() {
  local node=$1 node_name=$2 service=$3
  local -a debug=()
  shift 3
  if [[ $(bool_string "$CLIENT_DEBUG") == true ]]; then
    debug=(--debug)
  fi
  retry_on "$PMM_TRANSIENT_ERRORS" 10 "pmm-agent setup on $node" \
    docker exec -e "PMM_AGENT_SETUP_NODE_NAME=$node_name" "$node" pmm-agent setup "${debug[@]}" >/dev/null
  wait_pmm_agent "$node"
  retry_on 'pmm-agent is not connected|context deadline exceeded' 60 "registering $service" \
    docker exec "$node" pmm-admin add mongodb --enable-all-collectors --agent-password=mypass "$service" "$@" >/dev/null
}

psmdb_exporters() {
  wait_exporter "$1" mongodb_exporter
  wait_node_exporter "$1" /var/log/pmm-agent.log
}

psmdb_replica_set() {
  local arbiter='' external=false node
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
    export MONGOD_RS_CONFIG_DIR=./conf/mongod-rs-inmemory
  fi

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
  step 'Configure PBM' each_node nodes psmdb_pbm_agent
  must docker exec rs101 pbm config --file /etc/pbm/minio.yaml >/dev/null
  if [[ -n $arbiter ]]; then
    must docker exec rs103 systemctl stop pbm-agent
    if [[ $profile == extra ]]; then
      must docker exec rs203 systemctl stop pbm-agent
    fi
  fi

  log_info '==> Register with PMM'
  for node in "${nodes[@]}"; do
    # The extra set is registered as configure-extra-agents.sh does: no
    # environment, and a replication set only on its arbiter.
    local -a labels=(--environment=psmdb-dev --cluster=replicaset --replication-set=rs)
    if [[ $node == rs20? ]]; then
      labels=(--cluster=replicaset)
      if [[ $node == "${arbiter/103/203}" ]]; then
        labels+=(--replication-set=rs1)
      fi
    fi
    if [[ $node == "$arbiter" || $node == "${arbiter/103/203}" ]]; then
      psmdb_register "$node" "$node._$suffix" "$node${name_part}_$suffix" "${labels[@]}" "--host=$node" --port=27017
    else
      psmdb_register "$node" "$node._$suffix" "$node${name_part}_$suffix" "${labels[@]}" "${credentials[@]}" \
        "--host=$node" --port=27017
    fi
  done
  step 'Wait for exporters' each_node nodes psmdb_exporters

  step 'Load data' psmdb_rs_data
  for node in "${nodes[@]}"; do
    report_agent_status "$node"
  done
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
  local -a nodes=(rs101 rs102 rs103 rs201 rs202 rs203 rscfg01 rscfg02 rscfg03) leaders=(rs101 rs201 rscfg01)
  local -a clients=("${nodes[@]}" mongos)
  export COMPOSE_PROJECT_NAME=psmdb_sharded

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
  step 'Configure PBM' each_node nodes psmdb_pbm_agent

  log_info '==> Register with PMM'
  for node in "${nodes[@]}"; do
    psmdb_register "$node" "$node._$suffix" "${node}_$suffix" --environment=mongo-sharded-dev --cluster=sharded \
      "--replication-set=${node%0*}" --username=pmm --password=pmmpass "--host=$node" --port=27017
  done
  # FTDC is off on a mongos until it has a directory, and PMM reads the
  # router's serverStatus metrics out of it (see start-sharded.sh).
  must docker exec mongos sh -c 'mkdir -p /var/lib/mongo/mongos.diagnostic.data && chown -R mongod:mongod /var/lib/mongo/mongos.diagnostic.data'
  psmdb_js mongos "$PSMDB_ROOT_URI" 'db.adminCommand({ setParameter: 1, diagnosticDataCollectionDirectoryPath: "/var/lib/mongo/mongos.diagnostic.data" });
    db.adminCommand({ setParameter: 1, diagnosticDataCollectionEnabled: true });' >/dev/null || die 'Enabling FTDC on mongos failed.'
  # indexstats is off on the router: $indexStats there returns one row per
  # shard, which the exporter reports as duplicate series.
  psmdb_register mongos "mongos_$suffix" "mongos_$suffix" --disable-collectors=indexstats --environment=mongo-sharded-dev \
    --cluster=sharded --username=pmm --password=pmmpass 127.0.0.1:27017
  step 'Wait for exporters' each_node clients psmdb_exporters

  step 'Load data' psmdb_sharded_data
  step 'Start the workloads' psmdb_sharded_workload
  for node in "${clients[@]}"; do
    report_agent_status "$node"
  done
}

# The two loops start-sharded.sh leaves running: chunk moves and splits every
# 240 s, and generate_opcountersrepl_traffic.sh's insert/update/delete load.
psmdb_sharded_workload() {
  must docker exec -i mongos tee /tmp/keep_chunks_moving.js >/dev/null <<'EOF'
var shards = db.getSiblingDB("config").shards.find().toArray().map(function (s) { return s._id; });
var ins = db.getSiblingDB("test").test.insertOne({ ts: new Date() });
shards.forEach(function (target) {
    try {
        sh.moveChunk("test.test", { _id: ins.insertedId }, target);
    } catch (e) {
        print("moveChunk to " + target + " failed, skipping: " + e);
    }
});
try {
    sh.splitFind("test.test", { _id: ins.insertedId });
} catch (e) {
    print("splitFind failed, skipping: " + e);
}
EOF
  must docker exec --detach mongos bash -c 'while true; do
    mongo "mongodb://root:root@localhost" --quiet /tmp/keep_chunks_moving.js > /tmp/keep_chunks_moving.log 2>&1
    sleep 240
  done'
  psmdb_traffic
}

psmdb_traffic() {
  COMPOSE_FILE=docker-compose-sharded.yaml must bash ./generate_opcountersrepl_traffic.sh >/dev/null
}

# PSMDB launched with mlaunch instead of docker-compose.
#
# Playbook-backed, so unlike setup_psmdb it takes a plain major version and
# uses the usual PMM_SERVER_IP / CLIENT_VERSION key names.
setup_mlaunch_psmdb() {
  local version client
  version=$(resolved_version PSMDB_VERSION MLAUNCH_PSMDB "$DB_VERSION")
  client=$(resolved_client_version MLAUNCH_PSMDB DB_CONFIG)
  declare -A env_map=(
    [PSMDB_VERSION]="$version"
    [PMM_SERVER_IP]="$PMM_SERVER_HOST"
    [PSMDB_CONTAINER]="psmdb_pmm_$version"
    [PSMDB_SETUP]="$(resolve_value MLAUNCH_PSMDB SETUP_TYPE DB_CONFIG)"
    [CLIENT_VERSION]="$client"
    [ADMIN_PASSWORD]="$(admin_password)"
    [PMM_QA_GIT_BRANCH]="$(git_branch)"
  )
  run_playbook 'mlaunch_psmdb_setup.yml' env_map
}

# Upstream MongoDB launched with mlaunch.
#
# Same as setup_mlaunch_psmdb but for MongoDB Community; note the MODB_* key
# names its playbook expects.
setup_mlaunch_modb() {
  local version client
  version=$(resolved_version MODB_VERSION MLAUNCH_MODB "$DB_VERSION")
  client=$(resolved_client_version MLAUNCH_MODB DB_CONFIG)
  declare -A env_map=(
    [MODB_VERSION]="$version"
    [PMM_SERVER_IP]="$PMM_SERVER_HOST"
    [MODB_CONTAINER]="modb_pmm_$version"
    [MODB_SETUP]="$(resolve_value MLAUNCH_MODB SETUP_TYPE DB_CONFIG)"
    [CLIENT_VERSION]="$client"
    [ADMIN_PASSWORD]="$(admin_password)"
    [PMM_QA_GIT_BRANCH]="$(git_branch)"
  )
  run_playbook 'mlaunch_modb_setup.yml' env_map
}

# mlaunch-based MongoDB with TLS.
setup_ssl_mlaunch() {
  local version client
  version=$(resolved_version PSMDB_VERSION SSL_MLAUNCH "$DB_VERSION")
  client=$(resolved_client_version SSL_MLAUNCH DB_CONFIG)
  declare -A env_map=(
    [MONGODB_VERSION]="$version"
    [PMM_SERVER_IP]="$PMM_SERVER_HOST"
    [MONGODB_SSL_CONTAINER]="psmdb_ssl_pmm_$version"
    [CLIENT_VERSION]="$client"
    [ADMIN_PASSWORD]="$(admin_password)"
    [PMM_QA_GIT_BRANCH]="$(git_branch)"
  )
  run_playbook 'tls-ssl-setup/mlaunch_tls_setup.yml' env_map
}

# PSMDB with TLS and LDAP from pmm_psmdb_diffauth_setup's compose stack, on the
# prebaked pmm-qa/psmdb image, doing what that stack's test-auth.sh did after
# `up`.
#
# A throwaway compose override disables the stack's own pmm-server, kerberos
# and test services (the framework supplies the server, and the test image is
# only used by test-auth.sh's own tests), resets psmdb-server's depends_on, and
# joins the external pmm-qa network. It references ${ADMIN_PASSWORD} and
# ${PMM_SERVER_CONTAINER_ADDRESS} as literals -- escaped in the heredoc -- so
# compose expands them at run time and no secret is written to disk.
setup_ssl_psmdb() {
  local version client minio tarball='' temp_dir
  version=${PSMDB_VERSION:-${DB_VERSION:-latest}}
  if [[ $version == latest ]]; then
    version=8.0
  fi
  client=$(resolved_client_version SSL_PSMDB DB_CONFIG)
  minio=$(bool_string "$(resolve_value SSL_PSMDB MINIO DB_CONFIG)")

  step "Prepare image pmm-qa/psmdb:$version-ol9" ensure_image psmdb "$version-ol9"
  must docker tag "pmm-qa/psmdb:$version-ol9" replica_member/local
  if [[ $client == http* ]]; then
    tarball=$(fetch_client_tarball "$client") || die "Could not fetch $client."
  fi
  temp_dir=$(mktemp -d "${TMPDIR:-/tmp}/pmm-framework-ssl-psmdb.XXXXXX")
  cat >"$temp_dir/compose.yml" <<EOF
services:
  pmm-server:
    profiles: [framework-disabled]
  kerberos:
    profiles: [framework-disabled]
  test:
    profiles: [framework-disabled]
  psmdb-server:
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
  local -a compose=(docker compose -f docker-compose-pmm-psmdb.yml -f "$1")
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
    "--server-password=$ADMIN_PASSWORD" --server-insecure-tls >/dev/null
  wait_pmm_agent psmdb-server
  # shellcheck disable=SC2086 # $tls is two flags
  retry_on 'pmm-agent is not connected|context deadline exceeded' 60 "registering psmdb-server_$suffix" \
    docker exec psmdb-server pmm-admin add mongodb "psmdb-server_$suffix" --agent-password=mypass --username=pmm_mongodb \
    '--password=5M](Q%q/U+YQ<^m' --host psmdb-server --port 27017 --tls $tls --cluster=mycluster >/dev/null
  step 'Wait for exporters' psmdb_exporters psmdb-server
  step 'Load data' ssl_psmdb_data
  report_agent_status psmdb-server
}

ssl_psmdb_certs() {
  must bash -e ./generate-certs.sh >/dev/null
}

ssl_psmdb_start() {
  must "${compose[@]}" down -v --remove-orphans
  if [[ $minio == true ]]; then
    must "${compose[@]}" up -d --no-deps minio createbucket
  fi
  must "${compose[@]}" up -d
}

ssl_psmdb_data() {
  must docker exec psmdb-server mgodatagen -f /etc/datagen/replicaset.json --username=pmm_mongodb \
    '--password=5M](Q%q/U+YQ<^m' --host psmdb-server --port 27017 \
    --tlsCertificateKeyFile=/mongodb_certs/client.pem --tlsCAFile=/mongodb_certs/ca-certs.pem >/dev/null
}

ssl_psmdb_users() {
  psmdb_js psmdb-server \
    'db.getSiblingDB("admin").createUser({ user: "root", pwd: "root", roles: ["root", "userAdminAnyDatabase", "clusterAdmin"] })' >/dev/null ||
    die 'Creating the root user failed.'
  docker exec -i psmdb-server mongo --quiet 'mongodb://root:root@localhost/?replicaSet=rs0' <init/setup_psmdb.js >/dev/null ||
    die 'init/setup_psmdb.js failed.'
}
