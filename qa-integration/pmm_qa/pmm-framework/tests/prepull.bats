#!/usr/bin/env bats
# shellcheck disable=SC2329,SC2317  # the docker stubs below are called indirectly.

load helpers/test_helper

setup() {
  reset_framework_state
  WARNINGS=''
  log_warn() { WARNINGS+="$*"$'\n'; }
  sleep() { :; }
}

@test "a pre-pull that never succeeds still lets the run continue" {
  docker() { return 1; }

  prepull_base_images
  local status=$?

  [ "$status" -eq 0 ]
  [[ $WARNINGS == *"Could not pre-pull"* ]]
}

@test "an image already present is not pulled" {
  PULLED=0
  docker() {
    case $1 in
      image) return 0 ;;
      pull) PULLED=$((PULLED + 1)); return 0 ;;
    esac
  }

  prepull_base_images

  [ "$PULLED" -eq 0 ]
  [ -z "$WARNINGS" ]
}

@test "every missing image is pulled once when the registry answers" {
  PULLED=0
  docker() {
    case $1 in
      image) return 1 ;;
      pull) PULLED=$((PULLED + 1)); return 0 ;;
    esac
  }

  prepull_base_images

  [ "$PULLED" -eq "${#BASE_IMAGES[@]}" ]
  [ -z "$WARNINGS" ]
}

@test "a pull that fails once is retried rather than abandoned" {
  ATTEMPTS=0
  docker() {
    case $1 in
      image) return 1 ;;
      pull)
        ATTEMPTS=$((ATTEMPTS + 1))
        (( ATTEMPTS % 2 == 0 )) && return 0
        return 1
        ;;
    esac
  }

  prepull_base_images

  [ "$ATTEMPTS" -eq $(( ${#BASE_IMAGES[@]} * 2 )) ]
  [ -z "$WARNINGS" ]
}

@test "no docker on the host is not an error" {
  command() { return 1; }

  prepull_base_images

  [ -z "$WARNINGS" ]
}
