#!/bin/bash
# Lightweight systemctl replacement for QA containers without systemd as PID 1.
set -euo pipefail

cmd=${1:-}
unit=${2:-}

case "$cmd" in
  enable|disable|daemon-reload|is-enabled)
    exit 0
    ;;
  start|restart)
    case "$unit" in
      mysql)
        if [[ -x /etc/init.d/mysql ]]; then
          [[ $cmd == restart ]] && /etc/init.d/mysql stop || true
          exec /etc/init.d/mysql start
        fi
        if command -v service >/dev/null 2>&1; then
          exec service mysql "$cmd"
        fi
        exit 0
        ;;
      postgresql@*)
        ver=${unit#postgresql@}
        ver=${ver%-main}
        if [[ $cmd == restart ]]; then
          pg_ctlcluster "$ver" main restart
        else
          pg_ctlcluster "$ver" main start
        fi
        exit 0
        ;;
      *)
        exit 0
        ;;
    esac
    ;;
  stop)
    case "$unit" in
      mysql)
        if [[ -x /etc/init.d/mysql ]]; then
          exec /etc/init.d/mysql stop
        fi
        if command -v service >/dev/null 2>&1; then
          exec service mysql stop
        fi
        exit 0
        ;;
      postgresql@*)
        ver=${unit#postgresql@}
        ver=${ver%-main}
        exec pg_ctlcluster "$ver" main stop
        ;;
      *)
        exit 0
        ;;
    esac
    ;;
  is-active)
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
