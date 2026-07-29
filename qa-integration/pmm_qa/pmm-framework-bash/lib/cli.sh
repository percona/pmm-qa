#!/usr/bin/env bash

declare -ag DATABASE_SPECS=()
declare -Ag DB_CONFIG=()

PMM_SERVER_IP_ARG=''
PMM_SERVER_PASSWORD=''
GLOBAL_CLIENT_VERSION=''
VERBOSE=false
VERBOSITY_LEVEL=1
CLIENT_DEBUG=false
PARALLEL=false

print_help() {
  cat <<'EOF'
PMM Framework (Bash)

Usage:
  pmm-framework [options] --database SPEC [--database SPEC ...]

Options:
  --database SPEC              Database setup, repeatable.
                               Example: ps=8.4,SETUP_TYPE=gr
  --pmm-server-ip VALUE        PMM Server address (otherwise Docker discovery).
  --pmm-server-password VALUE  PMM Server admin password (default: admin).
  --client-version VALUE       Global PMM Client version/tarball override.
  --verbose, --v               Print resolved setup details.
  --verbosity-level N          Ansible verbosity level (numeric, default: 1).
  --client-debug               Enable PMM Client debug mode.
  --parallel                   Run setups concurrently; dump logs only on failure.
  -h, --help                   Show this help.

Database SPEC:
  NAME[=VERSION][,OPTION=VALUE...]

Examples:
  pmm-framework --database ps=8.4
  pmm-framework --database ps=8.4,SETUP_TYPE=gr --database psmdb
  pmm-framework --pmm-server-ip 10.0.0.5 --database valkey=8
EOF
}

parse_args() {
  DATABASE_SPECS=()
  while (($#)); do
    local arg=$1 inline='' consumed=1 has_inline=false
    if [[ $arg == --*=* ]]; then
      inline=${arg#*=}
      arg=${arg%%=*}
      has_inline=true
    fi
    case "$arg" in
      --database)
        if [[ $has_inline == true ]]; then
          DATABASE_SPECS+=("$inline")
        else
          (($# >= 2)) || die "--database requires a value."
          DATABASE_SPECS+=("$2")
          consumed=2
        fi
        ;;
      --pmm-server-ip|--pmm-server-password|--client-version|--verbosity-level)
        local value
        if [[ $has_inline == true ]]; then
          value=$inline
        elif (($# >= 2)) && [[ ${2:0:1} != '-' ]]; then
          value=$2
          consumed=2
        else
          value=''
        fi
        case "$arg" in
          --pmm-server-ip) PMM_SERVER_IP_ARG=$value ;;
          --pmm-server-password) PMM_SERVER_PASSWORD=$value ;;
          --client-version) GLOBAL_CLIENT_VERSION=$value ;;
          --verbosity-level)
            if [[ $has_inline == true || -n $value ]]; then
              VERBOSITY_LEVEL=$value
            fi
            ;;
        esac
        ;;
      --verbose|--v) VERBOSE=true ;;
      --client-debug) CLIENT_DEBUG=true ;;
      --parallel) PARALLEL=true ;;
      -h|--help)
        print_help
        exit 0
        ;;
      *) die "Unknown option '$1'. Run with --help for supported options." ;;
    esac
    shift "$consumed"
  done

  [[ $VERBOSITY_LEVEL =~ ^[0-9]+$ ]] ||
    die "Invalid verbosity level '$VERBOSITY_LEVEL'; provide a number."
  ((${#DATABASE_SPECS[@]} > 0)) ||
    die "At least one --database SPEC is required."
}

parse_database_spec() {
  local spec=$1
  DB_TYPE=''
  DB_VERSION=''
  DB_CONFIG=()

  local -a tokens=()
  IFS=',' read -r -a tokens <<< "$spec"
  ((${#tokens[@]} > 0)) || die "Empty --database specification."

  local first=${tokens[0]}
  local type_token=${first%%=*}
  DB_TYPE=${type_token^^}
  database_exists "$DB_TYPE" ||
    die "Database type '$type_token' is not recognized."

  if [[ $first == *=* ]]; then
    local candidate=${first#*=}
    if database_version_exists "$DB_TYPE" "$candidate"; then
      DB_VERSION=$candidate
    else
      log_verbose "Value '$candidate' is not recognized for $DB_TYPE; using its default version."
    fi
  fi

  local token key value
  for token in "${tokens[@]:1}"; do
    if [[ $token != *=* ]]; then
      log_verbose "Option '$token' is not recognized for $DB_TYPE; using defaults."
      continue
    fi
    key=${token%%=*}
    key=${key^^}
    value=${token#*=}
    if database_option_exists "$DB_TYPE" "$key"; then
      DB_CONFIG["$key"]=$value
    else
      log_verbose "Option '$key' is not recognized for $DB_TYPE; using defaults."
    fi
  done
}
