#!/usr/bin/env bash
# Build one nightly run's report JSON from the workflow's `needs` context.
# Env: NEEDS_JSON (toJSON(needs)), IMAGE_TAG, RUN_URL, RUN_ID, and optionally
# JOBS_JSON: a file with the run's jobs from the GitHub API (one array). Writes to stdout.
set -Eeuo pipefail
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
: "${NEEDS_JSON:?}" "${IMAGE_TAG:?}" "${RUN_URL:?}" "${RUN_ID:?}"
jobs_file="${JOBS_JSON:-}"
[ -n "$jobs_file" ] && [ -s "$jobs_file" ] || { jobs_file="$(mktemp)"; echo "[]" > "$jobs_file"; }

jq -n \
  --argjson needs "$NEEDS_JSON" \
  --arg run_id "gha-${RUN_ID}" \
  --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg tag "$IMAGE_TAG" \
  --arg url "$RUN_URL" \
  --slurpfile api "$jobs_file" '
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
      job_details: ($api[0]
        | map(select(.name | test("^(Resolve build under test|Compatibility matrix|GA pmm-client tags|Publish nightly report)") | not))
        | map((.name | split(" / ")) as $parts | {
            group: $parts[0],
            name: (if ($parts | length) > 1 then $parts[1:] | join(" / ") else $parts[0] end),
            result: (.conclusion // .status),
            url: .html_url,
            duration_s: (if .started_at and .completed_at
              then ((.completed_at | fromdateiso8601) - (.started_at | fromdateiso8601)) else null end)
          })),
      investigations: []
    }'
