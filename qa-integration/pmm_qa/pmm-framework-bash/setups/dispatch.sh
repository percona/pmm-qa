#!/usr/bin/env bash

setup_requires_server() {
  case "$1" in
    DOCKERCLIENTS|BUCKET) return 1 ;;
    *) return 0 ;;
  esac
}

dispatch_setup() {
  case "$DB_TYPE" in
    PS) setup_ps ;;
    MYSQL) setup_mysql ;;
    SSL_MYSQL) setup_ssl_mysql ;;
    PXC) setup_pxc ;;
    PGSQL) setup_pgsql ;;
    PDPGSQL) setup_pdpgsql ;;
    SSL_PDPGSQL) setup_ssl_pdpgsql ;;
    PSMDB) setup_psmdb ;;
    SSL_PSMDB) setup_ssl_psmdb ;;
    MLAUNCH_PSMDB) setup_mlaunch_psmdb ;;
    MLAUNCH_MODB) setup_mlaunch_modb ;;
    SSL_MLAUNCH) setup_ssl_mlaunch ;;
    HAPROXY) setup_haproxy ;;
    EXTERNAL) setup_external ;;
    VALKEY) setup_valkey ;;
    BUCKET) setup_bucket ;;
    DOCKERCLIENTS) setup_dockerclients ;;
    PROXYSQL)
      die "PROXYSQL is a PXC option source and cannot be set up independently."
      ;;
    *) die "Database type '$DB_TYPE' is not recognized." ;;
  esac
}
