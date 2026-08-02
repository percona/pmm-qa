#!/bin/bash
# systemctl stand-in when the container has no systemd PID 1.
set -euo pipefail
cmd=${1:-}; unit=${2:-}
case "$cmd" in
  enable|disable|daemon-reload|is-enabled|is-active) exit 0 ;;
  start|restart)
    case "$unit" in
      mysql)
        [[ -x /etc/init.d/mysql ]] && exec /etc/init.d/mysql "$cmd"
        exec service mysql "$cmd"
        ;;
      postgresql@*)
        ver=${unit#postgresql@}; ver=${ver%-main}
        [[ $cmd == restart ]] && exec pg_ctlcluster "$ver" main restart
        exec pg_ctlcluster "$ver" main start
        ;;
      *) exit 0 ;;
    esac
    ;;
  stop)
    case "$unit" in
      mysql)
        [[ -x /etc/init.d/mysql ]] && exec /etc/init.d/mysql stop
        exec service mysql stop
        ;;
      postgresql@*)
        ver=${unit#postgresql@}; ver=${ver%-main}
        exec pg_ctlcluster "$ver" main stop
        ;;
      *) exit 0 ;;
    esac
    ;;
  *) exit 0 ;;
esac
