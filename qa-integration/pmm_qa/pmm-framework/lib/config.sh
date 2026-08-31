#!/usr/bin/env bash
#
# lib/config.sh -- the database catalogue and value resolution.
#
# Everything the framework knows about a product declaratively lives here: the
# versions it accepts, which spec options are valid, and the default for each.
# Nothing in this file runs a setup; it only answers questions about them.
#
# TO ADD A NEW DATABASE TYPE you normally touch three files:
#   1. this one          -- register_database ... (validation + defaults)
#   2. setups/<family>.sh -- a setup_<name> function that builds the env map
#   3. setups/dispatch.sh -- one case arm pointing DB_TYPE at that function
# See ARCHITECTURE.md for the walkthrough.
#
# Data model (four parallel associative arrays, all keyed by uppercase type):
#   DB_VERSIONS[TYPE]         space-separated list of accepted versions
#   DB_OPTIONS[TYPE]          space-separated list of accepted option keys
#   DB_DEFAULTS[TYPE:KEY]     default value for one option
#   DB_DEFAULT_VERSIONS[TYPE] version used when the spec omits one

declare -Ag DB_VERSIONS=()
declare -Ag DB_OPTIONS=()
declare -Ag DB_DEFAULTS=()
declare -Ag DB_DEFAULT_VERSIONS=()

# Declare one database type.
#
# Usage: register_database TYPE 'versions...' 'OPTION_KEYS...' 'KEY=default'...
#
#   TYPE          uppercase identifier, matched case-insensitively on the CLI
#   versions      accepted versions, space separated; '' for versionless types
#   OPTION_KEYS   accepted `KEY=value` option names inside a --database spec
#   KEY=default   one pair per option; unlisted options resolve to ''
#
# DEFAULT_VERSION is not a user-settable option. It is pulled out of the
# defaults list into DB_DEFAULT_VERSIONS and names the version used when the
# spec omits one, so the *order* of the version list carries no meaning. The
# guard at the bottom of this file rejects a versioned type that forgets it.
#
# Writes: DB_VERSIONS, DB_OPTIONS, DB_DEFAULTS, DB_DEFAULT_VERSIONS
register_database() {
  local type=$1 versions=$2 options=$3
  shift 3
  DB_VERSIONS["$type"]=$versions
  DB_OPTIONS["$type"]=$options
  local pair key
  for pair in "$@"; do
    key=${pair%%=*}
    if [[ $key == DEFAULT_VERSION ]]; then
      DB_DEFAULT_VERSIONS["$type"]=${pair#*=}
    else
      DB_DEFAULTS["$type:$key"]=${pair#*=}
    fi
  done
}

# --------------------------------------------------------------------------
# The catalogue. Keep each entry's option list and defaults in sync: an option
# without a default silently resolves to the empty string.
# --------------------------------------------------------------------------

register_database PSMDB \
  '4.4 5.0 6.0 7.0 8.0 latest' \
  'CLIENT_VERSION SETUP_TYPE COMPOSE_PROFILES TARBALL OL_VERSION GSSAPI STORAGE_ENGINE MINIO' \
  'DEFAULT_VERSION=latest' \
  'CLIENT_VERSION=3-dev-latest' 'SETUP_TYPE=pss' 'COMPOSE_PROFILES=classic' \
  'TARBALL=' 'OL_VERSION=9' 'GSSAPI=false' 'STORAGE_ENGINE=wiredTiger' 'MINIO=true'

register_database MLAUNCH_PSMDB \
  '4.4 5.0 6.0 7.0 8.0' \
  'CLIENT_VERSION SETUP_TYPE TARBALL' \
  'DEFAULT_VERSION=8.0' \
  'CLIENT_VERSION=3-dev-latest' 'SETUP_TYPE=pss' 'TARBALL='

register_database MLAUNCH_MODB \
  '4.4 5.0 6.0 7.0 8.0' \
  'CLIENT_VERSION SETUP_TYPE TARBALL' \
  'DEFAULT_VERSION=8.0' \
  'CLIENT_VERSION=3-dev-latest' 'SETUP_TYPE=pss' 'TARBALL='

register_database SSL_MLAUNCH \
  '4.4 5.0 6.0 7.0 8.0' \
  'CLIENT_VERSION SETUP_TYPE COMPOSE_PROFILES TARBALL' \
  'DEFAULT_VERSION=8.0' \
  'CLIENT_VERSION=3-dev-latest' 'SETUP_TYPE=pss' 'COMPOSE_PROFILES=classic' 'TARBALL='

register_database SSL_PSMDB \
  '4.4 5.0 6.0 7.0 8.0 latest' \
  'CLIENT_VERSION SETUP_TYPE COMPOSE_PROFILES TARBALL MINIO' \
  'DEFAULT_VERSION=latest' \
  'CLIENT_VERSION=3-dev-latest' 'SETUP_TYPE=pss' 'COMPOSE_PROFILES=classic' 'TARBALL=' 'MINIO=false'

register_database MYSQL \
  '5.7 8.0 8.4 9.7' \
  'QUERY_SOURCE SETUP_TYPE CLIENT_VERSION TARBALL ENCRYPTED_CLIENT_CONFIG' \
  'DEFAULT_VERSION=9.7' \
  'QUERY_SOURCE=perfschema' 'SETUP_TYPE=' 'CLIENT_VERSION=3-dev-latest' \
  'TARBALL=' 'ENCRYPTED_CLIENT_CONFIG=false'

register_database PS \
  '5.7 8.0 8.4' \
  'QUERY_SOURCE SETUP_TYPE CLIENT_VERSION TARBALL NODES_COUNT MY_ROCKS ENCRYPTED_CLIENT_CONFIG BACKUP' \
  'DEFAULT_VERSION=8.0' \
  'QUERY_SOURCE=perfschema' 'SETUP_TYPE=' 'CLIENT_VERSION=3-dev-latest' \
  'TARBALL=' 'NODES_COUNT=1' 'MY_ROCKS=false' 'ENCRYPTED_CLIENT_CONFIG=false' 'BACKUP=false'

register_database SSL_MYSQL \
  '5.7 8.0 8.4' \
  'QUERY_SOURCE SETUP_TYPE CLIENT_VERSION TARBALL' \
  'DEFAULT_VERSION=8.0' \
  'QUERY_SOURCE=perfschema' 'SETUP_TYPE=' 'CLIENT_VERSION=3-dev-latest' 'TARBALL='

register_database PGSQL \
  '11 12 13 14 15 16 17 18' \
  'QUERY_SOURCE CLIENT_VERSION USE_SOCKET SETUP_TYPE ENCRYPTED_CLIENT_CONFIG' \
  'DEFAULT_VERSION=17' \
  'QUERY_SOURCE=pgstatements' 'CLIENT_VERSION=3-dev-latest' 'USE_SOCKET=' \
  'SETUP_TYPE=' 'ENCRYPTED_CLIENT_CONFIG=false'

register_database PDPGSQL \
  '11 12 13 14 15 16 17 18' \
  'CLIENT_VERSION USE_SOCKET SETUP_TYPE PGSM_BRANCH ENCRYPTED_CLIENT_CONFIG' \
  'DEFAULT_VERSION=17' \
  'CLIENT_VERSION=3-dev-latest' 'USE_SOCKET=' 'SETUP_TYPE=' 'PGSM_BRANCH=' \
  'ENCRYPTED_CLIENT_CONFIG=false'

register_database SSL_PDPGSQL \
  '11 12 13 14 15 16 17' \
  'CLIENT_VERSION USE_SOCKET' \
  'DEFAULT_VERSION=17' \
  'CLIENT_VERSION=3-dev-latest' 'USE_SOCKET='

register_database PXC \
  '5.7 8.0' \
  'CLIENT_VERSION QUERY_SOURCE TARBALL' \
  'DEFAULT_VERSION=8.0' \
  'CLIENT_VERSION=3-dev-latest' 'QUERY_SOURCE=perfschema' 'TARBALL='

# PROXYSQL is not independently setup-able: it only supplies defaults that the
# PXC setup reads (see setups/mysql.sh). dispatch_setup rejects it explicitly.
register_database PROXYSQL '2' 'PACKAGE' 'DEFAULT_VERSION=2' 'PACKAGE='

# Versionless types: '' means "no version accepted", so `--database haproxy=1`
# logs a note under --verbose and falls back to the (empty) default.
register_database HAPROXY '' 'CLIENT_VERSION' 'CLIENT_VERSION=3-dev-latest'
register_database EXTERNAL '' 'CLIENT_VERSION' 'CLIENT_VERSION=3-dev-latest'
register_database DOCKERCLIENTS '' ''
register_database BUCKET '' 'BUCKET_NAMES' 'BUCKET_NAMES=bcp'

register_database VALKEY \
  '7 8' \
  'CLIENT_VERSION SETUP_TYPE TARBALL ENCRYPTED_CLIENT_CONFIG' \
  'DEFAULT_VERSION=8' \
  'CLIENT_VERSION=3-dev-latest' 'SETUP_TYPE=' 'TARBALL=' 'ENCRYPTED_CLIENT_CONFIG=false'

# --------------------------------------------------------------------------
# Catalogue queries. All take an already-uppercased TYPE.
# --------------------------------------------------------------------------

# Is TYPE a registered database?
# Returns: 0 if registered, 1 otherwise
database_exists() {
  [[ -v "DB_OPTIONS[$1]" ]]
}

# Does TYPE accept the spec option KEY?
# Usage:   database_option_exists PS SETUP_TYPE
# Returns: 0 if accepted, 1 otherwise
database_option_exists() {
  local type=$1 key=$2 option
  for option in ${DB_OPTIONS[$type]-}; do
    [[ $option == "$key" ]] && return 0
  done
  return 1
}

# Does TYPE offer the given version?
# Usage:   database_version_exists PGSQL 17
# Returns: 0 if offered, 1 otherwise (including versionless types)
database_version_exists() {
  local type=$1 wanted=$2 version
  [[ -z ${DB_VERSIONS[$type]-} ]] && return 1
  for version in ${DB_VERSIONS[$type]}; do
    [[ $version == "$wanted" ]] && return 0
  done
  return 1
}

# The version used when a spec omits one.
# Stdout: the registered DEFAULT_VERSION, or '' for versionless types
database_default_version() {
  printf '%s' "${DB_DEFAULT_VERSIONS[$1]-}"
}

# The registered default for one option.
# Usage:  database_default_value PS QUERY_SOURCE   # -> perfschema
# Stdout: the default, or '' when the option has none
database_default_value() {
  printf '%s' "${DB_DEFAULTS["$1:$2"]-}"
}

# Resolve one option value using the framework's precedence rules.
#
# Usage: resolve_value TYPE KEY CONFIG_ARRAY_NAME
#   e.g. setup_type=$(resolve_value PS SETUP_TYPE DB_CONFIG)
#
# Precedence, highest first:
#   1. an existing shell/environment variable named KEY
#   2. the global --client-version, for KEY == CLIENT_VERSION only
#   3. the per-database option parsed from the --database spec
#   4. the default registered above
#
# Step 1 mirrors the Python framework's `os.environ.get(KEY)`, so an exported
# but *empty* variable deliberately wins and yields ''. Contrast with
# resolved_version() in lib/runners.sh, which mirrors `os.getenv(...) or ...`
# and therefore skips empty values -- the two rules are intentionally
# different. Because `-v` also sees non-exported shell variables, avoid naming
# any global in lib/cli.sh after a registered option key.
#
# Reads:  the named config array (normally DB_CONFIG), GLOBAL_CLIENT_VERSION
# Stdout: the resolved value (possibly empty)
resolve_value() {
  local type=$1 key=$2 config_name=$3
  local -n config_ref=$config_name
  if [[ -v $key ]]; then
    printf '%s' "${!key}"
  elif [[ $key == CLIENT_VERSION && -n ${GLOBAL_CLIENT_VERSION:-} ]]; then
    printf '%s' "$GLOBAL_CLIENT_VERSION"
  elif [[ -v "config_ref[$key]" ]]; then
    printf '%s' "${config_ref[$key]}"
  else
    database_default_value "$type" "$key"
  fi
}

# Catch a registration that adds versions but forgets DEFAULT_VERSION, or names
# one that is not offered, at source time rather than mid-setup.
for _db_type in "${!DB_VERSIONS[@]}"; do
  [[ -n ${DB_VERSIONS[$_db_type]} ]] || continue
  database_version_exists "$_db_type" "${DB_DEFAULT_VERSIONS[$_db_type]-}" ||
    die "register_database $_db_type: DEFAULT_VERSION must be one of:" \
      "${DB_VERSIONS[$_db_type]}"
done
unset _db_type
