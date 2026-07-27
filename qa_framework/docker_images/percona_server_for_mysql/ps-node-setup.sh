#!/usr/bin/env bash
#
# ps-node-setup.sh — configures this Percona Server container as a node in one of
# three topologies, based on env vars passed to `docker run -e ...`.
# Faithful to qa-integration/pmm_qa/percona_server_for_mysql.
#
# Env vars (all optional, sensible defaults):
#   SETUP_TYPE        single | replication | gr        (default: single)
#   NODE_INDEX        this node's 1-based index          (default: 1)
#   NODES_COUNT       total nodes in the topology         (default: 1)
#   SERVER_ID         mysql server_id                     (default: NODE_INDEX)
#   CONTAINER_PREFIX  hostname prefix; node host = PREFIX+INDEX   (default: ps_node_)
#   PRIMARY_HOST      primary/source host       (default: ${CONTAINER_PREFIX}1)
#   REPL_USER         replication user                    (default: repl_user)
#   REPL_PASSWORD     replication password                (default: GRgrO9301RuF)
#   ROOT_PASSWORD     mysql root password                 (default: GRgrO9301RuF)
#   MYSQL_PORT        mysql port                          (default: 3306)
#   GROUP_SEEDS_PORT  GR communication port               (default: 34061)
#   GROUP_NAME        GR group UUID           (default: aaaaaaaa-...-eeeeeeeeeeee)
#
# IMPORTANT: run each container with --name "${CONTAINER_PREFIX}${NODE_INDEX}"
# on a shared docker network so nodes can resolve each other by hostname.
set -uo pipefail

MARKER=/var/lib/mysql/.ps-node-setup-done
exec >>/var/log/ps-node-setup.log 2>&1
echo "===== ps-node-setup $(date -u) ====="

# --- Import env passed to the container. systemd (PID 1) does not forward docker
#     -e vars to services, but they are present in PID 1's environ. ---
if [ -r /proc/1/environ ]; then
  while IFS= read -r -d '' kv; do export "$kv" 2>/dev/null || true; done < /proc/1/environ
fi

SETUP_TYPE="${SETUP_TYPE:-single}"
NODE_INDEX="${NODE_INDEX:-1}"
NODES_COUNT="${NODES_COUNT:-1}"
SERVER_ID="${SERVER_ID:-$NODE_INDEX}"
CONTAINER_PREFIX="${CONTAINER_PREFIX:-ps_node_}"
PRIMARY_HOST="${PRIMARY_HOST:-${CONTAINER_PREFIX}1}"
REPL_USER="${REPL_USER:-repl_user}"
REPL_PASSWORD="${REPL_PASSWORD:-GRgrO9301RuF}"
ROOT_PASSWORD="${ROOT_PASSWORD:-GRgrO9301RuF}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
GROUP_SEEDS_PORT="${GROUP_SEEDS_PORT:-34061}"
GROUP_NAME="${GROUP_NAME:-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee}"
THIS_HOST="${CONTAINER_PREFIX}${NODE_INDEX}"
IS_PRIMARY=false; [ "$NODE_INDEX" = "1" ] && IS_PRIMARY=true

# --- Detect server version -> 80 / 84 / 57 ---
VER="$(mysqld --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
MAJMIN="$(echo "$VER" | awk -F. '{print $1$2}')"
MAJMIN="${MAJMIN:-80}"
echo "SETUP_TYPE=$SETUP_TYPE NODE=$NODE_INDEX/$NODES_COUNT server_id=$SERVER_ID host=$THIS_HOST ver=$VER($MAJMIN)"

root_sql()  { mysql -uroot -p"$ROOT_PASSWORD" -N -e "$1"; }
prim_sql()  { mysql -h "$PRIMARY_HOST" -P "$MYSQL_PORT" -uroot -p"$ROOT_PASSWORD" -N -e "$1" 2>/dev/null; }

########################################
# 1. Render /etc/mysql/my.cnf
########################################
render_single() {
  {
    echo "[mysqld]"
    # auth_native_password plugin only ships as a loadable module on 8.4+
    [ "$MAJMIN" -ge 84 ] && echo "plugin-load-add=auth_native_password.so"
    echo "userstat=1"
  } > /etc/mysql/my.cnf
}

render_async() {
  {
    echo "[mysqld]"
    echo "server_id=${SERVER_ID}"
    echo "bind-address=0.0.0.0"
    echo "port=${MYSQL_PORT}"
    echo "userstat=1"
    echo "caching_sha2_password_auto_generate_rsa_keys=ON"
    echo "caching_sha2_password_private_key_path=private_key.pem"
    echo "caching_sha2_password_public_key_path=public_key.pem"
    echo "gtid_mode=ON"
    echo "enforce_gtid_consistency=ON"
    echo "log_bin=binlog"
    echo "log_replica_updates=ON"
    echo "sync_binlog=1"
    echo "binlog_checksum=NONE"
    echo 'disabled_storage_engines="MyISAM,BLACKHOLE,FEDERATED,ARCHIVE,MEMORY"'
    echo "lower_case_table_names=2"
    echo "report_host=${THIS_HOST}"
    if ! $IS_PRIMARY; then
      echo "replica_parallel_workers=4"
      echo "replica_parallel_type=LOGICAL_CLOCK"
      echo "replica_preserve_commit_order=1"
    fi
    echo "relay-log=${THIS_HOST}-relay-bin"
    echo "relay_log_recovery=ON"
    echo "relay_log_purge=ON"
    echo "max_connections=1000"
    echo "innodb_buffer_pool_size=256M"
  } > /etc/mysql/my.cnf
}

render_gr() {
  local seeds=""
  local i
  for i in $(seq 1 "$NODES_COUNT"); do
    seeds="${seeds}${CONTAINER_PREFIX}${i}:${GROUP_SEEDS_PORT}"
    [ "$i" -lt "$NODES_COUNT" ] && seeds="${seeds},"
  done
  {
    echo "[mysqld]"
    echo "server_id=${SERVER_ID}"
    echo "bind-address=0.0.0.0"
    echo "port=${MYSQL_PORT}"
    echo "userstat=1"
    echo "gtid_mode=ON"
    echo "enforce_gtid_consistency=ON"
    echo "binlog_checksum=NONE"
    echo "log_bin=binlog"
    echo "log_replica_updates=ON"
    echo 'disabled_storage_engines="MyISAM,BLACKHOLE,FEDERATED,ARCHIVE,MEMORY"'
    echo "lower_case_table_names=2"
    echo "report_host=${THIS_HOST}"
    echo "plugin_load_add='group_replication.so'"
    echo "loose-group_replication_group_name='${GROUP_NAME}'"
    echo "loose-group_replication_local_address='${THIS_HOST}:${GROUP_SEEDS_PORT}'"
    echo "loose-group_replication_group_seeds='${seeds}'"
    echo "loose-group_replication_communication_stack=XCOM"
    echo "loose-group_replication_start_on_boot=OFF"
    echo "loose-group_replication_bootstrap_group=OFF"
    echo "loose-group_replication_single_primary_mode=ON"
    echo "loose-group_replication_enforce_update_everywhere_checks=OFF"
    echo "loose-group_replication_recovery_get_public_key=ON"
    echo "loose-group_replication_recovery_retry_count=10"
    echo "loose-group_replication_recovery_reconnect_interval=60"
    echo "relay-log=${THIS_HOST}-relay-bin"
    echo "relay_log_recovery=ON"
    echo "relay_log_purge=ON"
    echo "max_connections=1000"
    echo "innodb_buffer_pool_size=256M"
  } > /etc/mysql/my.cnf
}

case "$SETUP_TYPE" in
  replication) render_async ;;
  gr)          render_gr ;;
  *)           render_single ;;
esac
echo "--- rendered /etc/mysql/my.cnf ---"; cat /etc/mysql/my.cnf

########################################
# 2. Initialize datadir (once) — fresh init gives each node a unique server UUID
########################################
FIRST_RUN=false
if [ ! -f "$MARKER" ]; then
  FIRST_RUN=true
  systemctl stop mysql 2>/dev/null || true
  rm -rf /var/lib/mysql/* 2>/dev/null || true
  mysqld --initialize-insecure --user=mysql
fi

systemctl start mysql
for _ in $(seq 1 60); do mysqladmin ping --silent 2>/dev/null && break; sleep 1; done

########################################
# 3. Root password (first run only)
########################################
if $FIRST_RUN; then
  if [ "$MAJMIN" -lt 80 ]; then AUTH="mysql_native_password"; else AUTH="caching_sha2_password"; fi
  mysql -uroot -e "
    ALTER USER 'root'@'localhost' IDENTIFIED WITH ${AUTH} BY '${ROOT_PASSWORD}';
    CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED WITH ${AUTH} BY '${ROOT_PASSWORD}';
    ALTER USER 'root'@'%' IDENTIFIED WITH ${AUTH} BY '${ROOT_PASSWORD}';
    GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
    FLUSH PRIVILEGES;"
fi

########################################
# 4. Topology wiring (first run only)
########################################
wait_for_host_mysql() {  # $1 host
  local h="$1" _
  for _ in $(seq 1 120); do
    mysqladmin -h "$h" -P "$MYSQL_PORT" -uroot -p"$ROOT_PASSWORD" ping --silent 2>/dev/null && return 0
    sleep 2
  done
  return 1
}

if $FIRST_RUN; then
case "$SETUP_TYPE" in
  replication)
    if [ "$MAJMIN" -ge 80 ]; then
      root_sql "RESET BINARY LOGS AND GTIDS;" 2>/dev/null || root_sql "RESET MASTER;" 2>/dev/null || true
      root_sql "RESET REPLICA ALL;" 2>/dev/null || true
    else
      root_sql "RESET MASTER;" 2>/dev/null || true
      root_sql "RESET SLAVE ALL;" 2>/dev/null || true
    fi
    if $IS_PRIMARY; then
      root_sql "CREATE USER IF NOT EXISTS '${REPL_USER}'@'%' IDENTIFIED BY '${REPL_PASSWORD}';
                GRANT REPLICATION SLAVE ON *.* TO '${REPL_USER}'@'%'; FLUSH PRIVILEGES;"
    else
      echo "waiting for primary $PRIMARY_HOST ..."
      wait_for_host_mysql "$PRIMARY_HOST" || echo "WARN: primary not reachable"
      if [ "$MAJMIN" -ge 80 ]; then
        root_sql "CHANGE REPLICATION SOURCE TO
            SOURCE_HOST='${PRIMARY_HOST}', SOURCE_PORT=${MYSQL_PORT},
            SOURCE_USER='${REPL_USER}', SOURCE_PASSWORD='${REPL_PASSWORD}',
            SOURCE_AUTO_POSITION=1, GET_SOURCE_PUBLIC_KEY=1;
          START REPLICA;"
      else
        root_sql "CHANGE MASTER TO
            MASTER_HOST='${PRIMARY_HOST}', MASTER_PORT=${MYSQL_PORT},
            MASTER_USER='${REPL_USER}', MASTER_PASSWORD='${REPL_PASSWORD}',
            MASTER_AUTO_POSITION=1;
          START SLAVE;"
      fi
    fi
    ;;

  gr)
    if [ "$MAJMIN" -ge 84 ]; then
      root_sql "RESET BINARY LOGS AND GTIDS; RESET REPLICA ALL; SET GLOBAL gtid_purged='';" 2>/dev/null || true
    else
      root_sql "RESET MASTER; RESET SLAVE ALL;" 2>/dev/null || true
    fi
    # Create the recovery user + channel on every node (no binlog)
    mysql -uroot -p"$ROOT_PASSWORD" <<SQL
SET SQL_LOG_BIN=0;
CREATE USER IF NOT EXISTS '${REPL_USER}'@'%' IDENTIFIED BY '${REPL_PASSWORD}';
GRANT REPLICATION SLAVE ON *.* TO '${REPL_USER}'@'%';
GRANT CONNECTION_ADMIN, BACKUP_ADMIN, GROUP_REPLICATION_STREAM, SERVICE_CONNECTION_ADMIN, SYSTEM_VARIABLES_ADMIN ON *.* TO '${REPL_USER}'@'%';
FLUSH PRIVILEGES;
CHANGE REPLICATION SOURCE TO SOURCE_USER='${REPL_USER}', SOURCE_PASSWORD='${REPL_PASSWORD}' FOR CHANNEL 'group_replication_recovery';
SET SQL_LOG_BIN=1;
SQL
    if $IS_PRIMARY; then
      root_sql "SET GLOBAL group_replication_bootstrap_group=ON; START GROUP_REPLICATION; SET GLOBAL group_replication_bootstrap_group=OFF;"
    else
      echo "waiting for primary $PRIMARY_HOST to bootstrap the group ..."
      wait_for_host_mysql "$PRIMARY_HOST" || echo "WARN: primary not reachable"
      ok=false
      for _ in $(seq 1 60); do
        n="$(prim_sql "SELECT COUNT(*) FROM performance_schema.replication_group_members WHERE MEMBER_STATE='ONLINE';")"
        if [ "${n:-0}" -ge 1 ]; then ok=true; break; fi
        sleep 5
      done
      $ok || echo "WARN: primary group not online yet, attempting join anyway"
      root_sql "START GROUP_REPLICATION;"
    fi
    ;;

  *) : ;;  # single: nothing to wire
esac
fi

touch "$MARKER"
echo "===== ps-node-setup done ($SETUP_TYPE, node $NODE_INDEX) ====="
