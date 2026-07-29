#!/usr/bin/env bash

declare -Ag DB_VERSIONS=()
declare -Ag DB_OPTIONS=()
declare -Ag DB_DEFAULTS=()
declare -Ag DB_DEFAULT_VERSIONS=()

# register_database TYPE 'versions...' 'OPTION_KEYS...' 'KEY=default'...
#
# DEFAULT_VERSION is not a user-settable option: it is pulled out of the
# defaults list into DB_DEFAULT_VERSIONS and names the version used when the
# spec omits one. Version list order carries no meaning.
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

register_database PSMDB \
  '4.4 5.0 6.0 7.0 8.0 latest' \
  'CLIENT_VERSION SETUP_TYPE COMPOSE_PROFILES TARBALL OL_VERSION GSSAPI STORAGE_ENGINE' \
  'DEFAULT_VERSION=latest' \
  'CLIENT_VERSION=3-dev-latest' 'SETUP_TYPE=pss' 'COMPOSE_PROFILES=classic' \
  'TARBALL=' 'OL_VERSION=9' 'GSSAPI=false' 'STORAGE_ENGINE=wiredTiger'

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
  'CLIENT_VERSION SETUP_TYPE COMPOSE_PROFILES TARBALL' \
  'DEFAULT_VERSION=latest' \
  'CLIENT_VERSION=3-dev-latest' 'SETUP_TYPE=pss' 'COMPOSE_PROFILES=classic' 'TARBALL='

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

register_database PROXYSQL '2' 'PACKAGE' 'DEFAULT_VERSION=2' 'PACKAGE='
register_database HAPROXY '' 'CLIENT_VERSION' 'CLIENT_VERSION=3-dev-latest'
register_database EXTERNAL '' 'CLIENT_VERSION' 'CLIENT_VERSION=3-dev-latest'
register_database DOCKERCLIENTS '' ''
register_database BUCKET '' 'BUCKET_NAMES' 'BUCKET_NAMES=bcp'

register_database VALKEY \
  '7 8' \
  'CLIENT_VERSION SETUP_TYPE TARBALL ENCRYPTED_CLIENT_CONFIG' \
  'DEFAULT_VERSION=8' \
  'CLIENT_VERSION=3-dev-latest' 'SETUP_TYPE=' 'TARBALL=' 'ENCRYPTED_CLIENT_CONFIG=false'

database_exists() {
  [[ -v "DB_OPTIONS[$1]" ]]
}

database_option_exists() {
  local type=$1 key=$2 option
  for option in ${DB_OPTIONS[$type]-}; do
    [[ $option == "$key" ]] && return 0
  done
  return 1
}

database_version_exists() {
  local type=$1 wanted=$2 version
  [[ -z ${DB_VERSIONS[$type]-} ]] && return 1
  for version in ${DB_VERSIONS[$type]}; do
    [[ $version == "$wanted" ]] && return 0
  done
  return 1
}

database_default_version() {
  printf '%s' "${DB_DEFAULT_VERSIONS[$1]-}"
}

database_default_value() {
  printf '%s' "${DB_DEFAULTS["$1:$2"]-}"
}

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
