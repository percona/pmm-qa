#!/usr/bin/env bash
#
# setups/dispatch.sh -- the map from a database type to its setup function.
#
# Deliberately tiny: it is the one place to look to answer "what actually runs
# for --database X", and the one place to edit when adding a type.
#
# TO ADD A DATABASE TYPE, after registering it in lib/config.sh and writing its
# setup_<name> function in the matching setups/ file, add one case arm here.
# Also check setup_requires_server() below, and setup_uses_ansible() in
# lib/execution.sh, if the new type is unusual in either respect.

# Does this type need a PMM Server to report to?
#
# Almost everything does. BUCKET only creates MinIO storage and DOCKERCLIENTS
# only builds images, so neither needs a server -- and preflight skips server
# discovery entirely when those are the only setups requested, which means
# `--database bucket` works with no PMM Server running at all.
#
# Returns: 0 when a server is required, 1 when not
setup_requires_server() {
  case "$1" in
    DOCKERCLIENTS|BUCKET) return 1 ;;
    *) return 0 ;;
  esac
}

# Call the setup function for the parsed database type.
#
# Reads the DB_TYPE global rather than taking an argument, because it always
# runs directly after parse_database_spec() has populated DB_TYPE, DB_VERSION
# and DB_CONFIG together -- the setup functions read all three.
#
# Reads: DB_TYPE (and, through the setup functions, DB_VERSION and DB_CONFIG)
# Exits: via die() for PROXYSQL or an unmapped type
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
    # Registered so PXC can read its defaults, but never runnable on its own.
    PROXYSQL)
      die "PROXYSQL is a PXC option source and cannot be set up independently."
      ;;
    # Reached only when a type is registered in lib/config.sh but has no arm
    # here -- parse_database_spec would have rejected a genuinely unknown name.
    *) die "Database type '$DB_TYPE' is not recognized." ;;
  esac
}
