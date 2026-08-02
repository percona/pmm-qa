#!/bin/bash
# systemctl stand-in when the container has no systemd PID 1.
set -euo pipefail
cmd=${1:-}; unit=${2:-}
kill_mysql() {
  /etc/init.d/mysql stop 2>/dev/null || service mysql stop 2>/dev/null || true
  pkill -9 -x mysqld 2>/dev/null || true
  pkill -9 -x mysqld_safe 2>/dev/null || true
  rm -f /var/run/mysqld/mysqld.pid /var/run/mysqld/*.sock /var/run/mysqld/*.lock
}
pg_stop() {
  if [[ "$unit" == postgresql ]]; then
    pg_lsclusters -h 2>/dev/null | while read -r ver name _; do
      pg_ctlcluster "$ver" "$name" stop || true
    done
  else
    ver=${unit#postgresql@}; ver=${ver%-main}
    pg_ctlcluster "$ver" main stop || true
  fi
  pkill -9 postgres 2>/dev/null || true
}
pg_start() {
  ver=${unit#postgresql@}; ver=${ver%-main}
  [[ $cmd == restart ]] && pg_ctlcluster "$ver" main restart && return
  pg_ctlcluster "$ver" main start
}
case "$cmd" in
  enable|disable|daemon-reload|is-enabled|is-active) exit 0 ;;
  start|restart)
    case "$unit" in
      mysql)
        [[ $cmd == restart ]] && kill_mysql
        mkdir -p /var/run/mysqld && chown mysql:mysql /var/run/mysqld 2>/dev/null || true
        [[ -x /etc/init.d/mysql ]] && exec /etc/init.d/mysql start
        exec service mysql start
        ;;
      postgresql@*) pg_start ;;
      *) exit 0 ;;
    esac
    ;;
  stop)
    case "$unit" in
      mysql) kill_mysql ;;
      postgresql*) pg_stop ;;
      *) exit 0 ;;
    esac
    ;;
  *) exit 0 ;;
esac
