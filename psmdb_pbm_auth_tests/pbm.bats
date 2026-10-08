#!/usr/bin/env bats
#
# PMM backup and restore of a PSMDB replica set or sharded cluster, checked
# through the PMM API and pbm on rs101. The tests run in order and hand their
# ids to the next one; a test whose input is missing skips.

load helper

pbm_json() {
  docker exec rs101 pbm "$@" --out json
}

@test "test_pmm_services" {
  local services service_id
  services=$(pmm_api GET /v1/inventory/services | jq -c '.mongodb // []')
  [[ $(jq length <<<"$services") -gt 0 ]] || fail "No mongodb services in PMM"
  jq -e '.[0] | has("service_id")' <<<"$services" >/dev/null
  jq -e 'all(.[]; .service_name | contains("rs") or contains("mongos"))' <<<"$services" >/dev/null ||
    fail "Unexpected mongodb service names: $(jq -c '[.[].service_name]' <<<"$services")"
  service_id=$(jq -r '[.[] | select(.service_name | contains("mongos") | not)] | last | .service_id // empty' <<<"$services")
  [[ -n $service_id ]] ||
    fail "no replica-set member among $(jq -c '[.[].service_name]' <<<"$services"); the later restore tests need one"
  save service_id "$service_id"
}

@test "test_pmm_add_location" {
  local resp
  resp=$(pmm_api POST /v1/backups/locations '{"name": "test", "description": "test",
    "s3_config": {"endpoint": "http://minio:9000", "access_key": "minio1234", "secret_key": "minio1234", "bucket_name": "bcp"}}')
  jq -e 'has("location_id")' <<<"$resp" >/dev/null || fail "No location_id: $resp"
  save location_id "$(jq -r .location_id <<<"$resp")"
}

@test "test_pmm_logical_backup" {
  need service_id location_id
  local resp
  resp=$(pmm_api POST /v1/backups:start "$(jq -n --arg s "$(load_state service_id)" --arg l "$(load_state location_id)" \
    '{service_id: $s, location_id: $l, name: "test", description: "test", retries: 0, data_model: "DATA_MODEL_LOGICAL"}')")
  jq -e 'has("artifact_id")' <<<"$resp" >/dev/null || fail "No artifact_id: $resp"
  save artifact_id "$(jq -r .artifact_id <<<"$resp")"
}

@test "test_pmm_artifact" {
  need artifact_id
  local artifacts artifact _
  for _ in $(seq 1 600); do
    artifacts=$(pmm_api GET /v1/backups/artifacts | jq -c '.artifacts // []')
    [[ $(jq length <<<"$artifacts") -gt 0 ]] || fail "No backup artifacts in PMM"
    artifact=$(jq -c --arg id "$(load_state artifact_id)" \
      'first(.[] | select(.artifact_id == $id and .status == "BACKUP_STATUS_SUCCESS")) // empty' <<<"$artifacts")
    if [[ -n $artifact ]]; then
      save pbm_meta "$(jq -r '.metadata_list[0].pbm_metadata.name' <<<"$artifact")"
      save is_sharded "$(jq -r '.is_sharded_cluster // false' <<<"$artifact")"
      return
    fi
    sleep 1
  done
  fail "Backup $(load_state artifact_id) did not succeed within 600 polls"
}

@test "test_pbm_artifact" {
  need pbm_meta
  local status
  status=$(pbm_json status)
  [[ $(jq -r '.backups.snapshot[0].name' <<<"$status") == "$(load_state pbm_meta)" ]] ||
    fail "pbm's newest snapshot is not $(load_state pbm_meta): $status"
  [[ $(jq -r '.backups.snapshot[0].status' <<<"$status") == "done" ]] || fail "pbm snapshot is not done: $status"
  save pbm_backup "$(jq -r '.backups.snapshot[0].name' <<<"$status")"
}

@test "test_pmm_start_restore" {
  need is_sharded
  [[ $(load_state is_sharded) != true ]] || skip "Unsupported setup for restore from UI"
  need service_id artifact_id
  local resp
  resp=$(pmm_api POST /v1/backups/restores:start "$(jq -n --arg s "$(load_state service_id)" --arg a "$(load_state artifact_id)" \
    '{service_id: $s, artifact_id: $a}')")
  jq -e 'has("restore_id")' <<<"$resp" >/dev/null || fail "No restore_id: $resp"
  save restore_id "$(jq -r .restore_id <<<"$resp")"
}

@test "test_pmm_restore" {
  need is_sharded
  [[ $(load_state is_sharded) != true ]] || skip "Unsupported setup for restore from UI"
  need restore_id
  local items _
  for _ in $(seq 1 600); do
    items=$(pmm_api GET /v1/backups/restores | jq -c '.items // []')
    [[ $(jq length <<<"$items") -gt 0 ]] || fail "No restores in PMM"
    jq -e --arg id "$(load_state restore_id)" \
      'any(.[]; .restore_id == $id and .status == "RESTORE_STATUS_SUCCESS")' <<<"$items" >/dev/null && return
    sleep 1
  done
  fail "Restore $(load_state restore_id) did not succeed within 600 polls"
}

@test "test_pbm_restore" {
  need is_sharded
  [[ $(load_state is_sharded) != true ]] || skip "Unsupported setup for restore from UI"
  need pbm_backup
  local restores
  restores=$(pbm_json list --restore)
  jq -e --arg b "$(load_state pbm_backup)" \
    '[.[] | select(.snapshot == $b)] | length > 0 and all(.status == "done")' <<<"$restores" >/dev/null ||
    fail "No done pbm restore of $(load_state pbm_backup): $restores"
}

@test "test_metrics" {
  check_metrics rs101
}
