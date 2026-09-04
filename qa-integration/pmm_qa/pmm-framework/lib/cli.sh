#!/usr/bin/env bash
# shellcheck disable=SC2034  # parse_args sets these for lib/ and setups/ to read; shellcheck sees one file at a time.
#
# lib/cli.sh -- command-line parsing and the --database spec grammar.
#
# Turns argv into two things the rest of the framework reads:
#   * global switches (PMM Server address, verbosity, --parallel, ...)
#   * DATABASE_SPECS -- the raw spec strings, still unparsed
#
# Specs stay raw on purpose. preflight_database_setups() parses each one to
# inspect the run, then each setup parses it again just before running, so a
# spec is always expanded against freshly reset state. See lib/execution.sh.
#
# TO ADD A GLOBAL FLAG:
#   1. give it a default in the block below
#   2. add a case arm in parse_args (value-taking flags join the shared arm)
#   3. document it in print_help
#   4. read it wherever it applies -- most flags end up in a setup's env map

# Raw `--database` values, in the order given on the command line.
declare -ag DATABASE_SPECS=()

# Options parsed from the spec currently being expanded, e.g. DB_CONFIG[SETUP_TYPE].
# parse_database_spec() clears and repopulates this for every spec.
declare -Ag DB_CONFIG=()

# --- global switch defaults -------------------------------------------------
# Do not name any of these after a registered option key: resolve_value() looks
# up shell variables by name and would pick one of these up by accident.
PMM_SERVER_IP_ARG=''      # --pmm-server-ip; empty means discover via Docker
PMM_SERVER_PASSWORD=''    # --pmm-server-password; ADMIN_PASSWORD env wins
GLOBAL_CLIENT_VERSION=''  # --client-version; applies to every setup
VERBOSE=false             # --verbose/--v
VERBOSITY_LEVEL=1         # --verbosity-level; becomes that many -v for ansible
CLIENT_DEBUG=false        # --client-debug
PARALLEL=false            # --parallel; preflight may turn this back off

# Print the user-facing help text. Keep in sync with parse_args.
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

# Parse argv into the global switches and DATABASE_SPECS.
#
# Both `--flag value` and `--flag=value` spellings are accepted. Value-taking
# flags treat a following argument that starts with '-' as "no value given"
# rather than swallowing the next flag, which keeps `--client-version
# --database ps` from silently eating the --database.
#
# Writes:  DATABASE_SPECS and every global switch above
# Exits:   0 via --help; via die() on an unknown flag, a non-numeric
#          --verbosity-level, or when no --database was supplied
parse_args() {
  DATABASE_SPECS=()
  while (($#)); do
    local arg=$1 inline='' consumed=1 has_inline=false
    # Split the --flag=value spelling before matching.
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
      # Flags that take a value. Collected here so the "next arg looks like a
      # flag" rule lives in exactly one place, then dispatched below.
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
            # A bare --verbosity-level keeps the default rather than blanking it.
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

# Expand one spec string into DB_TYPE, DB_VERSION and DB_CONFIG.
#
# Grammar: NAME[=VERSION][,OPTION=VALUE...]
#   ps=8.4,SETUP_TYPE=gr,QUERY_SOURCE=slowlog
#
# Names and option keys are case-insensitive and upper-cased here, so the
# catalogue in lib/config.sh only ever deals in uppercase.
#
# Unknown *versions* and unknown *options* are not fatal: they are noted under
# --verbose and the registered default is used instead. This matches the Python
# framework, where a typo degrades to a default rather than failing a long CI
# job. An unknown database *name* is fatal, since there is nothing to fall back
# to.
#
# Writes:  DB_TYPE, DB_VERSION, DB_CONFIG (all reset on entry)
# Exits:   via die() on an empty spec or unknown database name
parse_database_spec() {
  local spec=$1
  DB_TYPE=''
  DB_VERSION=''
  DB_CONFIG=()

  local -a tokens=()
  IFS=',' read -r -a tokens <<< "$spec"
  ((${#tokens[@]} > 0)) || die "Empty --database specification."

  # First token is NAME or NAME=VERSION.
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

  # Remaining tokens are OPTION=VALUE pairs.
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
