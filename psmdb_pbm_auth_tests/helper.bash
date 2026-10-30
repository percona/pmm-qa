# Shared by pbm.bats and diffauth.bats. They run on the host that runs the PSMDB
# containers and the PMM Server (published on 443, as PMM_PSMDB_PBM_FULL.yml starts it).

PMM_SERVER_URL=${PMM_SERVER_URL:-https://127.0.0.1:443}

fail() {
  printf '%s\n' "$*" >&2
  return 1
}

# Usage: pmm_api METHOD PATH [JSON] -- prints the response body
pmm_api() {
  local body=${3:-'{}'}
  curl -sSk -X "$1" -u "admin:${ADMIN_PASSWORD:-password}" -H 'Content-Type: application/json' \
    -d "$body" "$PMM_SERVER_URL$2"
}

# Test state lives in files, since each @test runs in its own process.
save() { printf '%s' "$2" >"$BATS_FILE_TMPDIR/$1"; }
load_state() { cat "$BATS_FILE_TMPDIR/$1"; }
need() {
  local key
  for key; do
    [[ -s $BATS_FILE_TMPDIR/$key ]] || skip "prerequisite failed: no $key"
  done
}

# Usage: check_metrics NODE [GSSAPI] -- every name in expected_metrics.txt must appear
# in the first mongodb_exporter's /metrics. A GSSAPI service's exporter takes its
# agent_id as the password; every other one was added with --agent-password=mypass.
check_metrics() {
  local node=$1 list agent agent_id port password=mypass metrics metric
  list=$(timeout 30 docker exec "$node" pmm-admin list --json) || fail "pmm-admin list failed on $node" || return
  agent=$(jq -r 'first(.agent[]? | select(.agent_type == "AGENT_TYPE_MONGODB_EXPORTER")) | "\(.agent_id) \(.port)"' <<<"$list")
  [[ -n $agent ]] || fail "No mongodb_exporter agent on $node" || return
  read -r agent_id port <<<"$agent"
  [[ -z ${2:-} ]] || password=$agent_id
  metrics=$(timeout 30 docker exec "$node" curl -s "http://pmm:$password@127.0.0.1:$port/metrics") ||
    fail "Fail to get metrics from exporter" || return
  while IFS= read -r metric || [[ -n $metric ]]; do
    metric=${metric//[[:space:]]/}
    [[ -z $metric || $metrics == *"$metric"* ]] || fail "Metric '$metric' is missing from the exporter output" || return
  done <"$BATS_TEST_DIRNAME/expected_metrics.txt"
}
