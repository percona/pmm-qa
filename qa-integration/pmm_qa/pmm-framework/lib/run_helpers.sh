#!/usr/bin/env bash
#
# lib/run_helpers.sh -- run steps and docker commands for the setups: must,
# step, retry, each_node, and the container and network helpers.
# Every helper dies on its own failure with a message, not via errexit.

readonly BUSYBOX_IMAGE=busybox:1.37.0
# The Nomad agent pmm-agent runs exits unless it can write to cgroups, and a
# systemd image needs them too.
readonly -a NOMAD_CGROUPS=(--privileged --cgroupns=host --volume /sys/fs/cgroup:/sys/fs/cgroup:rw)

# Run a command, dying if it fails. Only the first words are echoed, so a
# password further along the command line stays out of the log.
must() {
  "$@" || die "Command failed: ${*:1:4}"
}

# Run a command under a timed ==>/<== banner.
step() {
  local description=$1 start=${EPOCHREALTIME/./} tenths
  shift
  log_info "==> $description"
  "$@" || die "$description failed."
  tenths=$(((${EPOCHREALTIME/./} - start) / 100000))
  log_info "<== $description ($((tenths / 10)).$((tenths % 10))s)"
}

# Rerun a command once a second, up to ATTEMPTS times, for as long as its
# output matches PATTERN (case-insensitive; '' retries any failure).
# Stdout: the output of the attempt that succeeded
# Usage:  retry_on 'not connected' 60 'registering node1' docker exec ...
retry_on() {
  local pattern=$1 attempts=$2 description=$3 attempt output=''
  shift 3
  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if output=$("$@" 2>&1); then
      printf '%s' "$output"
      return 0
    fi
    [[ ${output,,} =~ $pattern ]] || break
    sleep 1
  done
  # ${output: -400} is empty, not whole, when the output is shorter than that.
  if ((${#output} > 400)); then
    output=${output: -400}
  fi
  die "Gave up on $description after $((attempt > attempts ? attempts : attempt)) attempt(s); last output: $output"
}

# Usage: retry ATTEMPTS DESCRIPTION CMD...
retry() {
  retry_on '' "$@"
}

# Run FN NODE ARGS... for every node in the array named NODES_NAME at once.
# Usage: each_node names install_pmm_client "$client"
each_node() {
  local -n nodes_ref=$1
  local fn=$2 node pid failed=0
  local -a pids=()
  shift 2
  for node in "${nodes_ref[@]}"; do
    "$fn" "$node" "$@" &
    pids+=("$!")
  done
  for pid in "${pids[@]}"; do
    wait "$pid" || failed=$((failed + 1))
  done
  ((failed == 0)) || die "$fn failed on $failed of ${#pids[@]} node(s)."
}

# Usage: copy_out CONTAINER SRC_DIR DEST_DIR FILE...
copy_out() {
  local container=$1 src=$2 dest=$3 file
  shift 3
  must mkdir -p "$dest"
  for file; do
    must docker cp "$container:$src/$file" "$dest/$file"
  done
}

ensure_pmm_network() {
  if ! docker network inspect pmm-qa >/dev/null 2>&1; then
    must docker network create pmm-qa >/dev/null
  fi
}

fresh_containers() {
  docker rm -fv "$@" >/dev/null 2>&1 || true
}
