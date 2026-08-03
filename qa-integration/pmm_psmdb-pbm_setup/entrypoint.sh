#!/bin/bash
# PSMDB container entrypoint without systemd (works on MicroVM and CI).
set -euo pipefail
export PATH="/usr/local/bin:${PATH}" MANAGE_THP=0
chown -R mongod:mongod /keytabs 2>/dev/null || true
mkdir -p /var/log/mongo /var/lib/mongo /var/run /tmp
chown -R mongod:mongod /var/log/mongo /var/lib/mongo
chown mongod:mongod /tmp 2>/dev/null || chmod 1777 /tmp
[[ -f /etc/sysconfig/pbm-agent ]] && . /etc/sysconfig/pbm-agent

mongod_running() {
  mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1
}

record_mongod_pid() {
  local pid
  pid=$(pgrep -u mongod -f '/usr/bin/mongod -f' | head -1)
  if [[ -n "$pid" ]]; then
    echo "$pid" >/var/run/mongod.pid
  else
    rm -f /var/run/mongod.pid
  fi
}

start_mongod() {
  mongod_running && record_mongod_pid && return 0
  rm -f /var/run/mongod-stopped
  /usr/bin/percona-server-mongodb-helper.sh || true
  . /etc/sysconfig/mongod
  if [[ ! -f ${KRB5_KTNAME:-/nonexistent} ]]; then
    unset KRB5_KTNAME
  fi
  export GLIBC_TUNABLES=glibc.pthread.rseq=0 MONGODB_CONFIG_OVERRIDE_NOFORK=1
  [[ -v KRB5_KTNAME ]] && export KRB5_KTNAME
  runuser -u mongod -- /usr/bin/mongod ${OPTIONS} >>/var/log/mongo/mongod.log 2>&1 &
  for _ in $(seq 1 120); do
    if mongod_running; then
      mongosh --quiet --eval 'try { const s = rs.status(); if (s.ok) { quit(0) } } catch (e) {} quit(1)' >/dev/null 2>&1 && record_mongod_pid && return 0
      mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1 && record_mongod_pid && return 0
    fi
    sleep 1
  done
  return 1
}
stop_mongod() {
  touch /var/run/mongod-stopped
  if mongod_running; then
    mongosh --quiet --eval 'try { db.adminCommand({shutdown: 1}) } catch (e) {}' >/dev/null 2>&1 || true
    for _ in $(seq 1 30); do
      mongod_running || break
      sleep 1
    done
  fi
  pkill -9 -u mongod -f '/usr/bin/mongod -f' 2>/dev/null || true
  pkill -9 -u mongod -f 'runuser.*mongod' 2>/dev/null || true
  rm -f /var/run/mongod.pid
}
start_pbm() {
  pgrep -u mongod -x pbm-agent >/dev/null 2>&1 && return 0
  nohup runuser -u mongod -- /usr/bin/pbm-agent >>/var/log/pbm-agent.log 2>&1 &
  sleep 1
  pgrep -u mongod -x pbm-agent >/var/run/pbm-agent.pid || true
}
stop_pbm() {
  [[ -f /var/run/pbm-agent.pid ]] && kill "$(cat /var/run/pbm-agent.pid)" 2>/dev/null || true
  rm -f /var/run/pbm-agent.pid
  pkill -u mongod -x pbm-agent 2>/dev/null || true
}
stop_pmm() {
  [[ -f /var/run/pmm-agent.pid ]] && kill "$(cat /var/run/pmm-agent.pid)" 2>/dev/null || true
  rm -f /var/run/pmm-agent.pid
  pkill -x pmm-agent 2>/dev/null || true
}
start_pmm() {
  pgrep -x pmm-agent >/dev/null 2>&1 && return 0
  if [[ -f /keytabs/mongodb.keytab ]]; then
    export KRB5_CLIENT_KTNAME=/keytabs/mongodb.keytab
  else
    unset KRB5_CLIENT_KTNAME
  fi
  /usr/sbin/pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml >>/var/log/pmm-agent.log 2>&1 &
  echo $! >/var/run/pmm-agent.pid
}

case "${1:-run}" in
  run)
    start_mongod
    for _ in $(seq 1 90); do
      mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1 && break
      sleep 1
    done
    start_pbm
    start_pmm
    while true; do
      if [[ -f /var/run/mongod-stopped ]]; then
        sleep 2
        continue
      fi
      pid=$(cat /var/run/mongod.pid 2>/dev/null || true)
      if [[ -n "$pid" ]]; then
        wait "$pid" 2>/dev/null || true
      fi
      if [[ ! -f /var/run/mongod-stopped ]] && ! mongod_running; then
        start_mongod || sleep 5
      fi
    done
    ;;
  start-mongod) start_mongod ;;
  stop-mongod) stop_mongod ;;
  restart-mongod) stop_mongod; sleep 1; start_mongod ;;
  start-pbm-agent) start_pbm ;;
  restart-pbm-agent) stop_pbm; sleep 1; start_pbm ;;
  stop-pbm-agent) stop_pbm ;;
  start-pmm-agent) start_pmm ;;
  restart-pmm-agent) stop_pmm; sleep 1; start_pmm ;;
  stop-pmm-agent) stop_pmm ;;
  *) exec "$@" ;;
esac
