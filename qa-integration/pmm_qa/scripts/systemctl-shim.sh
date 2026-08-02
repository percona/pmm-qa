#!/bin/bash
# systemctl stand-in when the container has no systemd PID 1.
set -euo pipefail
cmd=${1:-}; unit=${2:-}
kill_mysql() {
  /etc/init.d/mysql stop 2>/dev/null || service mysql stop 2>/dev/null || true
  pkill -9 -x mysqld 2>/dev/null || true
  pkill -9 -x mysqld_safe 2>/dev/null || true
}
case "$cmd" in
  enable|disable|daemon-reload|is-enabled|is-active) exit 0 ;;
  start|restart)
    case "$unit" in
      mysql)
        [[ $cmd == restart ]] && kill_mysql
        [[ -x /etc/init.d/mysql ]] && exec /etc/init.d/mysql start
        exec service mysql start
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
      mysql) kill_mysql; exit 0 ;;
      postgresql@*)
        ver=${unit#postgresql@}; ver=${ver%-main}
        exec pg_ctlcluster "$ver" main stop
        ;;
      *) exit 0 ;;
    esac
    ;;
  *) exit 0 ;;
esac
