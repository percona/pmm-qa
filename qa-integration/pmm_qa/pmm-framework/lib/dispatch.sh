#!/usr/bin/env bash
#
# lib/dispatch.sh -- run the setup function for a database type.

# Run setup_<type> for the DB_TYPE that parse_database_spec just set; the setup
# functions read DB_TYPE, DB_VERSION and DB_CONFIG.
dispatch_setup() {
  local fn=setup_${DB_TYPE,,}
  declare -F "$fn" >/dev/null || die "Database type '$DB_TYPE' has no $fn."
  "$fn"
}
