#!/usr/bin/env bash
# shellcheck disable=SC2034  # parse_args sets these for lib/ and images/ to read; shellcheck sees one file at a time.
#
# lib/cli.sh -- command-line parsing and the --database spec grammar.
# Specs stay raw: each setup re-parses its own just before running.

declare -ag DATABASE_SPECS=()

declare -Ag DB_CONFIG=()

# Never name a global after an option key: resolve_value() would read it.
PMM_SERVER_IP_ARG=''      # --pmm-server-ip; empty means discover via Docker
PMM_SERVER_PASSWORD=''    # --pmm-server-password; ADMIN_PASSWORD env wins
GLOBAL_CLIENT_VERSION=''  # --client-version; applies to every setup
VERBOSE=false             # --verbose/--v
CLIENT_DEBUG=false        # --client-debug
PARALLEL=false            # --parallel; preflight may turn this back off
NOMAD=false               # --nomad
SETUP_RETRIES=0           # --setup-retries; extra attempts for a FAILED setup only

# Keep in sync with parse_args.
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
  --verbose, --v               Print resolved setup details, and with --parallel
                               also echo the logs of successful setups.
  --client-debug               Enable PMM Client debug mode.
  --parallel                   Run setups concurrently; dump logs only on failure.
  --nomad                      Run PS/MySQL pmm-agents in a privileged
                               nomad_agent_* companion, so Nomad can start.
  --setup-retries N            Retry each failed setup up to N more times; setups
                               that already succeeded are left alone (default: 0).
  --list-databases             Print TYPE, default version and supported versions,
                               tab-separated, one type per line. Needs no Docker.
  -h, --help                   Show this help.

Database SPEC:
  NAME[=VERSION][,OPTION=VALUE...]
  VERSION latest means the type's default version.

Examples:
  pmm-framework --database ps=8.4
  pmm-framework --database ps=8.4,SETUP_TYPE=gr --database psmdb
  pmm-framework --pmm-server-ip 10.0.0.5 --database valkey=8
EOF
}

# A value-taking flag followed by '-...' gets no value, so
# `--client-version --database ps` does not swallow the --database.
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
      --pmm-server-ip|--pmm-server-password|--client-version|--setup-retries)
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
          --setup-retries)
            if [[ $has_inline == true || -n $value ]]; then
              SETUP_RETRIES=$value
            fi
            ;;
        esac
        ;;
      --verbose|--v) VERBOSE=true ;;
      --client-debug) CLIENT_DEBUG=true ;;
      --parallel) PARALLEL=true ;;
      --nomad) NOMAD=true ;;
      -h|--help)
        print_help
        exit 0
        ;;
      --list-databases)
        list_databases
        exit 0
        ;;
      *) die "Unknown option '$1'. Run with --help for supported options." ;;
    esac
    shift "$consumed"
  done

  [[ $SETUP_RETRIES =~ ^[0-9]+$ ]] ||
    die "Invalid setup retry count '$SETUP_RETRIES'; provide a number."
  ((${#DATABASE_SPECS[@]} > 0)) ||
    die "At least one --database SPEC is required."
}

# Grammar: NAME[=VERSION][,OPTION=VALUE...], case-insensitive.
# Unknown names, versions or options are fatal: a silent default would let a
# typo test a different setup and still pass.
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
    DB_VERSION=$(canonical_version "$DB_TYPE" "${first#*=}")
    database_version_exists "$DB_TYPE" "$DB_VERSION" ||
      die "Version '$DB_VERSION' is not supported for $DB_TYPE (supported: ${DB_VERSIONS[$DB_TYPE]:-none})."
  fi

  local token key
  for token in "${tokens[@]:1}"; do
    [[ $token == *=* ]] || die "Option '$token' for $DB_TYPE must be KEY=VALUE."
    key=${token%%=*}
    key=${key^^}
    database_option_exists "$DB_TYPE" "$key" ||
      die "Option '$key' is not supported for $DB_TYPE (supported: ${DB_OPTIONS[$DB_TYPE]})."
    DB_CONFIG["$key"]=${token#*=}
  done
}
