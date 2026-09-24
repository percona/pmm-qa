#!/usr/bin/env bash
# Build one nightly run's report JSON from the workflow's `needs` context.
# Env: NEEDS_JSON (toJSON(needs)), IMAGE_TAG, RUN_URL, RUN_ID. Writes to stdout.
set -Eeuo pipefail
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
: "${NEEDS_JSON:?}" "${IMAGE_TAG:?}" "${RUN_URL:?}" "${RUN_ID:?}"

jq -n \
  --argjson needs "$NEEDS_JSON" \
  --arg run_id "gha-${RUN_ID}" \
  --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg tag "$IMAGE_TAG" \
  --arg url "$RUN_URL" '
  ($needs | to_entries | map(select(.key != "resolve" and .key != "plan" and .key != "get_compat_versions"))
    | map({name: .key, result: .value.result})) as $jobs
  | {
      run_id: $run_id,
      date: $date,
      image_tag: $tag,
      run_url: $url,
      status: (if any($jobs[]; .result == "failure" or .result == "cancelled") then "fail" else "pass" end),
      summary: ($jobs | map(select(.result != "skipped")) as $ran
        | "\($ran | map(select(.result == "success")) | length)/\($ran | length) jobs passed"),
      jobs: $jobs,
      investigations: []
    }'
