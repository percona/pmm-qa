#!/bin/bash
set -euo pipefail

# MicroVM / non-systemd entrypoint for PSMDB+PBM replica set containers.
# Starts mongod and pbm-agent as background processes instead of systemd.

export PATH="/usr/local/bin:${PATH}"
export MANAGE_THP=0

chown -R mongod:mongod /keytabs 2>/dev/null || true
mkdir -p /var/log/mongo /var/lib/mongo /var/run
chown -R mongod:mongod /var/log/mongo /var/lib/mongo

if [[ -f /etc/sysconfig/pbm-agent ]]; then
  # shellcheck disable=SC1091
  source /etc/sysconfig/pbm-agent
fi

start_mongod() {
  /usr/bin/percona-server-mongodb-helper.sh || true
  # shellcheck disable=SC1091
  source /etc/sysconfig/mongod
  export GLIBC_TUNABLES=glibc.pthread.rseq=0
  export MONGODB_CONFIG_OVERRIDE_NOFORK=1
  su -s /bin/bash mongod -c "/usr/bin/mongod ${OPTIONS}" &
  echo $! >/var/run/mongod.pid
}

start_pbm_agent() {
  if pgrep -u mongod -x pbm-agent >/dev/null 2>&1; then
    pgrep -u mongod -x pbm-agent >/var/run/pbm-agent.pid
    return 0
  fi
  nohup runuser -u mongod -- /usr/bin/pbm-agent >>/var/log/pbm-agent.log 2>&1 &
  sleep 1
  pgrep -u mongod -x pbm-agent >/var/run/pbm-agent.pid || true
}

stop_pbm_agent() {
  if [[ -f /var/run/pbm-agent.pid ]]; then
    kill "$(cat /var/run/pbm-agent.pid)" 2>/dev/null || true
    rm -f /var/run/pbm-agent.pid
  fi
  pkill -u mongod -x pbm-agent 2>/dev/null || true
}

restart_pbm_agent() {
  stop_pbm_agent
  sleep 1
  start_pbm_agent
}

start_pmm_agent() {
  if [[ -f /var/run/pmm-agent.pid ]] && kill -0 "$(cat /var/run/pmm-agent.pid)" 2>/dev/null; then
    return 0
  fi
  export KRB5_CLIENT_KTNAME=/keytabs/mongodb.keytab
  /usr/sbin/pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml >>/var/log/pmm-agent.log 2>&1 &
  echo $! >/var/run/pmm-agent.pid
}

case "${1:-run}" in
  run)
    start_mongod
    for _ in $(seq 1 90); do
      if mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
    start_pbm_agent
    wait "$(cat /var/run/mongod.pid)"
    ;;
  start-mongod) start_mongod ;;
  start-pbm-agent) start_pbm_agent ;;
  restart-pbm-agent) restart_pbm_agent ;;
  stop-pbm-agent) stop_pbm_agent ;;
  start-pmm-agent) start_pmm_agent ;;
  *)
    exec "$@"
    ;;
esac
