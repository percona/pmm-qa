#!/bin/bash
# systemctl stand-in for PSMDB containers (entrypoint.sh manages processes).
set -euo pipefail
export PATH="/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin"
cmd=${1:-}; unit=${2:-}
case "$cmd" in
  enable|disable|daemon-reload) exit 0 ;;
  start|restart)
    case "$unit" in
      pbm-agent) [[ $cmd == restart ]] && exec /entrypoint.sh restart-pbm-agent; exec /entrypoint.sh start-pbm-agent ;;
      pmm-agent)
        [[ $cmd == restart ]] && exec /entrypoint.sh restart-pmm-agent
        exec /entrypoint.sh start-pmm-agent
        ;;
      mongod)
        [[ $cmd == restart ]] && exec /entrypoint.sh restart-mongod
        exec /entrypoint.sh start-mongod
        ;;
      *) exit 0 ;;
    esac
    ;;
  stop)
    case "$unit" in
      mongod) exec /entrypoint.sh stop-mongod ;;
      pbm-agent) exec /entrypoint.sh stop-pbm-agent ;;
      pmm-agent) exec /entrypoint.sh stop-pmm-agent ;;
      *) exit 0 ;;
    esac
    ;;
  is-active)
    case "$unit" in
      mongod)
        mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1 && exit 0
        exit 1
        ;;
      pbm-agent) pgrep -u mongod -x pbm-agent >/dev/null 2>&1 && exit 0; exit 1 ;;
      pmm-agent)
        [[ -f /var/run/pmm-agent.pid ]] && kill -0 "$(cat /var/run/pmm-agent.pid)" 2>/dev/null && exit 0
        pgrep -x pmm-agent >/dev/null 2>&1 && exit 0
        exit 1
        ;;
      *) exit 0 ;;
    esac
    ;;
  *) exit 0 ;;
esac
