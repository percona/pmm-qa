#!/bin/bash
# PSMDB container entrypoint without systemd (works on MicroVM and CI).
set -euo pipefail
export PATH="/usr/local/bin:${PATH}" MANAGE_THP=0
chown -R mongod:mongod /keytabs 2>/dev/null || true
mkdir -p /var/log/mongo /var/lib/mongo /var/run
chown -R mongod:mongod /var/log/mongo /var/lib/mongo
[[ -f /etc/sysconfig/pbm-agent ]] && . /etc/sysconfig/pbm-agent

start_mongod() {
  /usr/bin/percona-server-mongodb-helper.sh || true
  . /etc/sysconfig/mongod
  export GLIBC_TUNABLES=glibc.pthread.rseq=0 MONGODB_CONFIG_OVERRIDE_NOFORK=1
  su -s /bin/bash mongod -c "/usr/bin/mongod ${OPTIONS}" &
  echo $! >/var/run/mongod.pid
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
start_pmm() {
  [[ -f /var/run/pmm-agent.pid ]] && kill -0 "$(cat /var/run/pmm-agent.pid)" 2>/dev/null && return 0
  export KRB5_CLIENT_KTNAME=/keytabs/mongodb.keytab
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
    wait "$(cat /var/run/mongod.pid)"
    ;;
  start-mongod) start_mongod ;;
  start-pbm-agent) start_pbm ;;
  restart-pbm-agent) stop_pbm; sleep 1; start_pbm ;;
  stop-pbm-agent) stop_pbm ;;
  start-pmm-agent) start_pmm ;;
  *) exec "$@" ;;
esac
