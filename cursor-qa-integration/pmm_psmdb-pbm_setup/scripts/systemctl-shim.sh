#!/bin/bash
# Minimal systemctl replacement for configure-*.sh scripts in no-systemd mode.
set -euo pipefail

cmd=${1:-}
unit=${2:-}

case "$cmd" in
  enable|disable|daemon-reload)
    exit 0
    ;;
  restart)
    case "$unit" in
      pbm-agent) exec /entrypoint-no-systemd.sh restart-pbm-agent ;;
      pmm-agent) exec /entrypoint-no-systemd.sh start-pmm-agent ;;
      mongod) exec /entrypoint-no-systemd.sh start-mongod ;;
      *) exit 0 ;;
    esac
    ;;
  start)
    case "$unit" in
      pbm-agent) exec /entrypoint-no-systemd.sh start-pbm-agent ;;
      pmm-agent) exec /entrypoint-no-systemd.sh start-pmm-agent ;;
      mongod) exec /entrypoint-no-systemd.sh start-mongod ;;
      *) exit 0 ;;
    esac
    ;;
  stop)
    case "$unit" in
      pbm-agent) exec /entrypoint-no-systemd.sh stop-pbm-agent ;;
      pmm-agent)
        if [[ -f /var/run/pmm-agent.pid ]]; then
          kill "$(cat /var/run/pmm-agent.pid)" 2>/dev/null || true
          rm -f /var/run/pmm-agent.pid
        fi
        pkill -x pmm-agent 2>/dev/null || true
        ;;
      *) exit 0 ;;
    esac
    ;;
  is-active)
    case "$unit" in
      mongod)
        mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1 && exit 0
        exit 3
        ;;
      *) exit 0 ;;
    esac
    ;;
  *)
    exit 0
    ;;
esac
