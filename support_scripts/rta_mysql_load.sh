#!/usr/bin/env bash
# Sample MySQL load for manually testing Real-Time Analytics (RTA) for MySQL.
# Every statement carries an "rta-load-" label, so it is easy to find with the Query text filter.
set -uo pipefail

usage() {
  cat <<'EOF'
Usage: rta_mysql_load.sh [connection] [options] [scenario ...]

Connection (pick one):
  --container NAME        Run the client inside this Docker container as root, with the root password from
                          its MYSQL_ROOT_PASSWORD or MARIADB_ROOT_PASSWORD (pmm-framework containers, mysql:*, mariadb:*).
  --host H --port P --user U --password PW
                          Use the local mysql client; the user needs CREATE, CREATE USER, GRANT OPTION and PROCESS.
                          Defaults: 127.0.0.1, 3306, root, $MYSQL_PWD.

Options:
  --duration SECONDS      How long the load runs (default 120).
  --cleanup               Kill leftover load connections, drop the rta_load_* databases and users, and exit.
  -h, --help              Show this help.

Scenarios (default: all):
  sleep      Long SELECT SLEEP statements in two databases as two users (Database/User columns and filters, sorting).
  rowlock    An idle transaction holding a row lock and a chain of three waiters (Blocked by, Root, Blocked only).
  mdl        An idle transaction, an ALTER TABLE waiting for its metadata lock and a SELECT queued behind it.
  locktime   A statement that waits 3 s for a row lock, then keeps running (Lock time ~3000 ms).
  truncated  A 2,000-byte statement (Truncated label) next to a short one.
  trx        A tight BEGIN/UPDATE/COMMIT loop (Hide transaction control); COMMITs are short, so they show intermittently.
  fullscan   A slow scan of an unindexed 131,072-row table (Full scan, Rows examined).

Start an RTA session for the service in Query Analytics > Real-time, then run this script.
Press Ctrl+C to stop early; the load connections are killed on exit.
EOF
}

CONTAINER='' HOST=127.0.0.1 PORT=3306 ADMIN_USER=root ADMIN_PASS=${MYSQL_PWD:-}
DURATION=120 CLEANUP_ONLY=false SCENARIOS=()
ALL_SCENARIOS=(sleep rowlock mdl locktime truncated trx fullscan)
LOAD_PASS='rta_Load_Pass1'

while [ $# -gt 0 ]; do
  case $1 in
    --container) CONTAINER=$2; shift 2 ;;
    --host) HOST=$2; shift 2 ;;
    --port) PORT=$2; shift 2 ;;
    --user) ADMIN_USER=$2; shift 2 ;;
    --password) ADMIN_PASS=$2; shift 2 ;;
    --duration) DURATION=$2; shift 2 ;;
    --cleanup) CLEANUP_ONLY=true; shift ;;
    -h | --help) usage; exit 0 ;;
    -*) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
    *) SCENARIOS+=("$1"); shift ;;
  esac
done

if ! [[ $DURATION =~ ^[0-9]+$ ]] || [ "$DURATION" -lt 10 ]; then
  echo "--duration must be a whole number of seconds, 10 or more" >&2
  exit 2
fi
[ ${#SCENARIOS[@]} -gt 0 ] || SCENARIOS=("${ALL_SCENARIOS[@]}")
for s in "${SCENARIOS[@]}"; do
  [[ " ${ALL_SCENARIOS[*]} " == *" $s "* ]] || { echo "Unknown scenario: $s" >&2; exit 2; }
done

# sql USER: reads SQL from stdin. USER "admin" is the connection user; any other is a load user.
# --comments keeps the /* rta-load-... */ labels, which the client strips by default.
sql() {
  local user=$1
  if [ -n "$CONTAINER" ]; then
    if [ "$user" = admin ]; then
      docker exec -i "$CONTAINER" sh -c \
        'export MYSQL_PWD="${MYSQL_ROOT_PASSWORD:-$MARIADB_ROOT_PASSWORD}"; exec "$(command -v mysql || command -v mariadb)" --comments --batch -uroot' 2>&1
    else
      docker exec -i -e MYSQL_PWD="$LOAD_PASS" "$CONTAINER" sh -c \
        'exec "$(command -v mysql || command -v mariadb)" --comments --batch -h127.0.0.1 -u"$0"' "$user" 2>&1
    fi
  else
    local pass=$LOAD_PASS
    [ "$user" = admin ] && { user=$ADMIN_USER; pass=$ADMIN_PASS; }
    MYSQL_PWD=$pass mysql --comments --batch -h"$HOST" -P"$PORT" -u"$user" 2>&1
  fi
}

kill_load_connections() {
  local ids
  ids=$(sql admin <<'SQL' | tail -n +2
SELECT ID FROM information_schema.PROCESSLIST
 WHERE ID <> CONNECTION_ID() AND (USER IN ('rta_user_a', 'rta_user_b') OR INFO LIKE '%rta-load-%');
SQL
  )
  for id in $ids; do
    [[ $id =~ ^[0-9]+$ ]] && echo "KILL $id;" | sql admin >/dev/null
  done
}

if $CLEANUP_ONLY; then
  kill_load_connections
  out=$(sql admin <<'SQL'
DROP DATABASE IF EXISTS rta_load_a;
DROP DATABASE IF EXISTS rta_load_b;
DROP USER IF EXISTS 'rta_user_a'@'%', 'rta_user_b'@'%';
SQL
  ); rc=$?
  if [ $rc -ne 0 ]; then echo "$out" >&2; exit 1; fi
  echo "Removed the rta_load_* databases and users."
  exit 0
fi

# 5.7 has no recursive CTE, so the scan table grows by doubling: 2^17 = 131,072 rows.
setup() {
  local doubling='' i
  for i in $(seq 17); do doubling+="INSERT INTO rta_load_b.events (payload) SELECT payload FROM rta_load_b.events;"$'\n'; done
  sql admin <<SQL
CREATE DATABASE IF NOT EXISTS rta_load_a;
CREATE DATABASE IF NOT EXISTS rta_load_b;
CREATE TABLE IF NOT EXISTS rta_load_a.accounts (id INT PRIMARY KEY, balance INT NOT NULL) ENGINE=InnoDB;
INSERT IGNORE INTO rta_load_a.accounts VALUES (1, 100), (2, 200), (3, 300);
CREATE TABLE IF NOT EXISTS rta_load_a.mdl_target (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT IGNORE INTO rta_load_a.mdl_target VALUES (1);
CREATE TABLE IF NOT EXISTS rta_load_b.events (id INT AUTO_INCREMENT PRIMARY KEY, payload VARCHAR(64) NOT NULL) ENGINE=InnoDB;
CREATE USER IF NOT EXISTS 'rta_user_a'@'%' IDENTIFIED BY '$LOAD_PASS';
CREATE USER IF NOT EXISTS 'rta_user_b'@'%' IDENTIFIED BY '$LOAD_PASS';
GRANT ALL ON rta_load_a.* TO 'rta_user_a'@'%';
GRANT ALL ON rta_load_b.* TO 'rta_user_b'@'%';
GRANT ALL ON rta_load_a.* TO 'rta_user_b'@'%';
SQL
  local rows
  rows=$(echo 'SELECT COUNT(*) FROM rta_load_b.events;' | sql admin | tail -n 1)
  if [ "$rows" = 0 ]; then
    { echo "INSERT INTO rta_load_b.events (payload) VALUES ('rta-load-row');"; printf '%s' "$doubling"; } | sql admin
  fi
}

# Runs a client in the background; "hold" keeps the connection open and idle for N seconds before the rest.
bg() {
  local user=$1 sql_text=$2 hold=${3:-0} after=${4:-}
  { printf '%s\n' "$sql_text"; [ "$hold" -gt 0 ] && sleep "$hold"; [ -n "$after" ] && printf '%s\n' "$after"; } \
    | sql "$user" >/dev/null &
}

scenario_sleep() {
  bg rta_user_a "USE rta_load_a; SELECT 'rta-load-sleep-a', SLEEP($DURATION);"
  bg rta_user_b "USE rta_load_b; SELECT 'rta-load-sleep-b', SLEEP($((DURATION / 2)));"
  bg rta_user_b "USE rta_load_a; SELECT 'rta-load-sleep-b-in-a', SLEEP($((DURATION / 3)));"
  local i loop=''
  for i in $(seq $((DURATION / 4))); do loop+="SELECT 'rta-load-short', SLEEP(2); DO SLEEP(2);"$'\n'; done
  bg rta_user_a "USE rta_load_a; $loop"
}

# Root blocker idles in its transaction; waiter 2 holds row 2 and waits for row 1; waiter 3 waits for row 2.
scenario_rowlock() {
  local timeout="SET SESSION innodb_lock_wait_timeout = $((DURATION + 60));"
  bg rta_user_a "BEGIN; /* rta-load-rowlock-root */ UPDATE rta_load_a.accounts SET balance = balance + 1 WHERE id = 1;" \
    "$DURATION" "ROLLBACK;"
  sleep 1
  bg rta_user_a "$timeout /* rta-load-rowlock-waiter-1 */ UPDATE rta_load_a.accounts SET balance = balance - 1 WHERE id = 1;"
  bg rta_user_b "$timeout BEGIN; UPDATE rta_load_a.accounts SET balance = balance + 2 WHERE id = 2;
/* rta-load-rowlock-waiter-2 */ UPDATE rta_load_a.accounts SET balance = balance - 2 WHERE id = 1; ROLLBACK;"
  sleep 1
  bg rta_user_a "$timeout /* rta-load-rowlock-waiter-3 */ SELECT balance FROM rta_load_a.accounts WHERE id = 2 FOR UPDATE;"
}

# ENGINE=InnoDB rebuilds the table without changing it, so the scenario can run again.
scenario_mdl() {
  local timeout="SET SESSION lock_wait_timeout = $((DURATION + 60));"
  bg rta_user_a "BEGIN; /* rta-load-mdl-holder */ SELECT id FROM rta_load_a.mdl_target;" "$DURATION" "COMMIT;"
  sleep 1
  bg rta_user_a "$timeout /* rta-load-mdl-ddl */ ALTER TABLE rta_load_a.mdl_target ENGINE=InnoDB;"
  sleep 1
  bg rta_user_b "$timeout /* rta-load-mdl-queued */ SELECT id FROM rta_load_a.mdl_target;"
}

# MySQL 8.0.28+ counts the row-lock wait in LOCK_TIME; the value appears once the lock is granted.
scenario_locktime() {
  bg rta_user_b "BEGIN; SELECT id FROM rta_load_a.accounts WHERE id = 3 FOR UPDATE;" 3 "COMMIT;"
  sleep 1
  bg rta_user_a "SELECT 'rta-load-lock-time', SLEEP($DURATION) FROM rta_load_a.accounts WHERE id = 3 FOR UPDATE;"
}

scenario_truncated() {
  local padding
  padding=$(printf 'x%.0s' $(seq 1900))
  bg rta_user_a "SELECT 'rta-load-truncated', SLEEP($DURATION), '$padding', 'rta-load-end-marker';"
  bg rta_user_a "SELECT 'rta-load-not-truncated', SLEEP($DURATION);"
}

scenario_trx() {
  {
    local end=$((SECONDS + DURATION)) i
    while [ $SECONDS -lt $end ]; do
      for i in $(seq 100); do printf 'BEGIN; UPDATE rta_load_b.events SET payload = payload WHERE id = %d; COMMIT;\n' "$i"; done
    done
  } | sql rta_user_b >/dev/null &
}

scenario_fullscan() {
  bg rta_user_b "/* rta-load-fullscan */ SELECT SUM(SLEEP($DURATION / 131072)) FROM rta_load_b.events WHERE payload <> 'zz';"
}

cleanup() {
  trap - EXIT INT TERM
  echo "Stopping the load..."
  kill_load_connections
  jobs -p | xargs -r kill 2>/dev/null
  wait 2>/dev/null
  echo "Done. The rta_load_* databases and users stay; remove them with --cleanup."
}

out=$(echo 'SELECT VERSION();' | sql admin); rc=$?
[ $rc -eq 0 ] || { echo "Cannot connect: $out" >&2; exit 1; }
echo "Connected to $(echo "$out" | tail -n 1)${CONTAINER:+ in container $CONTAINER}."

out=$(setup); rc=$?
[ $rc -eq 0 ] || { echo "Setup failed: $out" >&2; exit 1; }

trap cleanup EXIT
trap 'exit 130' INT TERM

for s in "${SCENARIOS[@]}"; do
  echo "Starting $s"
  "scenario_$s"
done

echo "Load runs for $DURATION s. Filter the Real-time view by 'rta-load-' to see it."
sleep "$DURATION"
