#!/usr/bin/env bash
#
# lib/config.sh -- the database catalogue and value resolution.
# To add a database type, register it here and write setup_<name> in
# images/<database>/setup.sh (ARCHITECTURE.md §5).

declare -Ag DB_VERSIONS=()
declare -Ag DB_OPTIONS=()
declare -Ag DB_DEFAULTS=()
declare -Ag DB_DEFAULT_VERSIONS=()

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

# Stdout: the first word given twice, if any
first_duplicate() {
  printf '%s\n' "$@" | sort | uniq -d | head -n1
}

# Usage: register_database TYPE 'versions...' 'OPTION_KEYS...' 'KEY=default'...
# Every option needs a default, even an empty one (SETUP_TYPE=). A versioned
# TYPE also needs DEFAULT_VERSION=x, the version used when a spec omits one or
# asks for latest. Any slip dies at source time, not mid-setup.
register_database() {
  local type=$1 versions=$2 options=$3
  shift 3
  local pair key dup
  [[ ! -v "DB_OPTIONS[$type]" ]] || die "register_database $type: registered twice."
  # shellcheck disable=SC2086 # word lists
  {
    dup=$(first_duplicate $versions)
    [[ -z $dup ]] || die "register_database $type: version '$dup' listed twice."
    dup=$(first_duplicate $options)
    [[ -z $dup ]] || die "register_database $type: option '$dup' listed twice."
  }
  dup=$(first_duplicate "${@%%=*}")
  [[ -z $dup ]] || die "register_database $type: default '$dup' given twice."
  DB_VERSIONS["$type"]=$versions
  DB_OPTIONS["$type"]=$options
  for pair in "$@"; do
    key=${pair%%=*}
    if [[ $key == DEFAULT_VERSION ]]; then
      DB_DEFAULT_VERSIONS["$type"]=${pair#*=}
    else
      database_option_exists "$type" "$key" || die "register_database $type: default for unknown option '$key'."
      DB_DEFAULTS["$type:$key"]=${pair#*=}
    fi
  done
  for key in $options; do
    [[ -v "DB_DEFAULTS[$type:$key]" ]] || die "register_database $type: option '$key' has no default."
  done
  if [[ -n $versions ]]; then
    database_version_exists "$type" "${DB_DEFAULT_VERSIONS[$type]-}" ||
      die "register_database $type: DEFAULT_VERSION must be one of: $versions"
  elif [[ -v "DB_DEFAULT_VERSIONS[$type]" ]]; then
    die "register_database $type: a versionless type takes no DEFAULT_VERSION."
  fi
}

# Usage: list_databases -- TYPE<TAB>DEFAULT<TAB>VERSIONS per line, sorted; '-'
# for a versionless type
list_databases() {
  local type
  for type in "${!DB_OPTIONS[@]}"; do
    printf '%s\t%s\t%s\n' "$type" "${DB_DEFAULT_VERSIONS[$type]:--}" "${DB_VERSIONS[$type]:--}"
  done | sort
}

register_database PSMDB \
  '6.0 7.0 8.0 8.3' \
  'CLIENT_VERSION SETUP_TYPE COMPOSE_PROFILES OL_VERSION GSSAPI STORAGE_ENGINE MINIO QUERY_SOURCE' \
  'DEFAULT_VERSION=8.0' \
  'CLIENT_VERSION=latest-tarball' 'SETUP_TYPE=pss' 'COMPOSE_PROFILES=classic' \
  'OL_VERSION=9' 'GSSAPI=false' 'STORAGE_ENGINE=wiredTiger' 'MINIO=true' 'QUERY_SOURCE=profiler'

# Runs on the psmdb image, so it offers the same versions.
register_database SSL_PSMDB \
  "${DB_VERSIONS[PSMDB]}" \
  'CLIENT_VERSION MINIO' \
  'DEFAULT_VERSION=8.0' \
  'CLIENT_VERSION=latest-tarball' 'MINIO=false'

register_database MYSQL \
  '5.7 8.0 8.4 9.7' \
  'QUERY_SOURCE SETUP_TYPE CLIENT_VERSION ENCRYPTED_CLIENT_CONFIG' \
  'DEFAULT_VERSION=8.4' \
  'QUERY_SOURCE=perfschema' 'SETUP_TYPE=' 'CLIENT_VERSION=latest-tarball' \
  'ENCRYPTED_CLIENT_CONFIG=false'

register_database PS \
  '5.7 8.0 8.4 9.7' \
  'QUERY_SOURCE SETUP_TYPE CLIENT_VERSION NODES_COUNT MY_ROCKS ENCRYPTED_CLIENT_CONFIG BACKUP' \
  'DEFAULT_VERSION=8.4' \
  'QUERY_SOURCE=perfschema' 'SETUP_TYPE=' 'CLIENT_VERSION=latest-tarball' \
  'NODES_COUNT=1' 'MY_ROCKS=false' 'ENCRYPTED_CLIENT_CONFIG=false' 'BACKUP=false'

# Runs on the ps image, so it offers the same versions.
register_database SSL_MYSQL \
  "${DB_VERSIONS[PS]}" \
  'CLIENT_VERSION' \
  'DEFAULT_VERSION=8.4' \
  'CLIENT_VERSION=latest-tarball'

register_database PGSQL \
  '14 15 16 17 18' \
  'CLIENT_VERSION SETUP_TYPE ENCRYPTED_CLIENT_CONFIG' \
  'DEFAULT_VERSION=17' \
  'CLIENT_VERSION=latest-tarball' 'SETUP_TYPE=' 'ENCRYPTED_CLIENT_CONFIG=false'

register_database PDPGSQL \
  '14 15 16 17 18' \
  'CLIENT_VERSION SETUP_TYPE PGSM_BRANCH ENCRYPTED_CLIENT_CONFIG' \
  'DEFAULT_VERSION=17' \
  'CLIENT_VERSION=latest-tarball' 'SETUP_TYPE=' 'PGSM_BRANCH=' \
  'ENCRYPTED_CLIENT_CONFIG=false'

register_database SSL_PDPGSQL \
  '14 15 16 17 18' \
  'CLIENT_VERSION' \
  'DEFAULT_VERSION=17' \
  'CLIENT_VERSION=latest-tarball'

register_database PXC \
  '5.7 8.0 8.4 9.7' \
  'CLIENT_VERSION QUERY_SOURCE TARBALL' \
  'DEFAULT_VERSION=8.4' \
  'CLIENT_VERSION=latest-tarball' 'QUERY_SOURCE=perfschema' 'TARBALL='

# '' = versionless: `--database haproxy=1` is refused.
register_database HAPROXY '' 'CLIENT_VERSION' 'CLIENT_VERSION=latest-tarball'
register_database EXTERNAL '' 'CLIENT_VERSION' 'CLIENT_VERSION=latest-tarball'

register_database VALKEY \
  '7 8' \
  'CLIENT_VERSION SETUP_TYPE ENCRYPTED_CLIENT_CONFIG' \
  'DEFAULT_VERSION=8' \
  'CLIENT_VERSION=latest-tarball' 'SETUP_TYPE=' 'ENCRYPTED_CLIENT_CONFIG=false'

database_default_version() {
  printf '%s' "${DB_DEFAULT_VERSIONS[$1]-}"
}

database_default_value() {
  printf '%s' "${DB_DEFAULTS["$1:$2"]-}"
}

# Usage: canonical_version TYPE VERSION -- latest becomes TYPE's default; a
# versionless TYPE has none, so its latest stays and is refused.
canonical_version() {
  if [[ $2 == latest && -n ${DB_VERSIONS[$1]-} ]]; then
    database_default_version "$1"
  else
    printf '%s' "$2"
  fi
}

# Usage: resolve_value TYPE KEY CONFIG_ARRAY_NAME
# Precedence: --client-version (CLIENT_VERSION only) > shell variable KEY >
# spec option > registered default. An exported but empty KEY still wins, and
# `-v` sees plain shell variables too, so never name a global after an option.
resolve_value() {
  local type=$1 key=$2 config_name=$3
  local -n config_ref=$config_name
  if [[ $key == CLIENT_VERSION && -n ${GLOBAL_CLIENT_VERSION:-} ]]; then
    printf '%s' "$GLOBAL_CLIENT_VERSION"
  elif [[ -v $key ]]; then
    printf '%s' "${!key}"
  elif [[ -v "config_ref[$key]" ]]; then
    printf '%s' "${config_ref[$key]}"
  else
    database_default_value "$type" "$key"
  fi
}

admin_password() {
  printf '%s' "${ADMIN_PASSWORD:-${PMM_SERVER_PASSWORD:-admin}}"
}

# Usage: resolved_version PS_VERSION PS "$DB_VERSION"
# Precedence: $PS_VERSION > spec version > DEFAULT_VERSION; an empty env var
# is skipped, unlike resolve_value(). latest in $PS_VERSION means the default,
# as it does in a spec (parse_database_spec).
resolved_version() {
  local env_name=$1 type=$2 requested=$3 version
  if [[ -n ${!env_name:-} ]]; then
    version=$(canonical_version "$type" "${!env_name}")
    database_version_exists "$type" "$version" ||
      die "$env_name='${!env_name}' is not supported for $type (supported: ${DB_VERSIONS[$type]})."
    printf '%s' "$version"
  elif [[ -n $requested ]]; then
    printf '%s' "$requested"
  else
    database_default_version "$type"
  fi
}

# PMM Clients before 3.7 cannot encrypt their config.
resolved_encrypted() {
  local minor=${2#3.}
  if [[ $2 == 3.*.* ]] && ((${minor%%.*} < 7)); then
    printf false
  else
    bool_string "$(resolve_value "$1" ENCRYPTED_CLIENT_CONFIG DB_CONFIG)"
  fi
}

resolved_client_version() {
  local type=$1 config_name=$2
  normalize_client_version "$(resolve_value "$type" CLIENT_VERSION "$config_name")"
}
