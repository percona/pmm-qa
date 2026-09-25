#!/usr/bin/env bash
# Build one nightly's report JSON from the Jenkins nightly orchestrator's results.
# Usage: build_report.sh <results.json>, where results.json is the orchestrator's
# `results` map: {"<lane>": {"job", "number", "url", "result"}}. A lane named
# "<family> / <leaf>" is grouped under <family>. A lane whose url is a GitHub Actions
# run is expanded into that run's jobs (GH_TOKEN, if set, authenticates the API calls).
# Env: BUILD_NUMBER, BUILD_URL, IMAGE_TAG, CLIENT_VERSION; optional GH_TOKEN.
# Writes to stdout.
set -Eeuo pipefail
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
RESULTS="${1:?usage: build_report.sh <results.json>}"
: "${BUILD_NUMBER:?}" "${BUILD_URL:?}" "${IMAGE_TAG:?}" "${CLIENT_VERSION:?}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
echo '{}' > "$tmp/gh.json"

# GitHub lanes: fetch every job of the run so the report shows them one by one.
while IFS=$'\t' read -r lane run_id; do
  [[ "$run_id" =~ ^[0-9]+$ ]] || continue
  page=1
  : > "$tmp/jobs.ndjson"
  while :; do
    body="$(curl -fsS --retry 3 ${GH_TOKEN:+-H "Authorization: Bearer ${GH_TOKEN}"} -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/percona/pmm-qa/actions/runs/${run_id}/jobs?per_page=100&page=${page}")" || break
    n="$(jq '.jobs | length' <<<"$body")"
    jq -c '.jobs[]' <<<"$body" >> "$tmp/jobs.ndjson"
    [ "$n" -lt 100 ] && break
    page=$((page + 1))
  done
  jq -s --arg lane "$lane" '{($lane): .}' "$tmp/jobs.ndjson" | jq -s '.[0] * .[1]' "$tmp/gh.json" - > "$tmp/gh.next"
  mv "$tmp/gh.next" "$tmp/gh.json"
done < <(jq -r 'to_entries[] | select(.value.url | test("github.com/.*/actions/runs/")) |
  [.key, (.value.url | capture("actions/runs/(?<id>[0-9]+)").id)] | @tsv' "$RESULTS")

jq -n \
  --slurpfile results "$RESULTS" \
  --slurpfile gh "$tmp/gh.json" \
  --arg run_id "jenkins-${BUILD_NUMBER}" \
  --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg tag "$IMAGE_TAG" \
  --arg client "$CLIENT_VERSION" \
  --arg url "$BUILD_URL" '
  def norm: {"SUCCESS": "success", "FAILURE": "failure", "UNSTABLE": "unstable", "ABORTED": "cancelled",
             "success": "success", "failure": "failure", "cancelled": "cancelled", "skipped": "skipped",
             "timed_out": "timed_out"}[. // ""] // "unknown";
  def dur: if .started_at and .completed_at
    then ((.completed_at | fromdateiso8601) - (.started_at | fromdateiso8601)) else null end;
  ($results[0] | to_entries | map(
    .key as $lane | .value as $r |
    if ($gh[0][$lane] // []) | length > 0 then
      $gh[0][$lane]
      | map(select(.name | test("^(Resolve build under test|Compatibility matrix|GA pmm-client tags)") | not))
      | map((.name | split(" / ")) as $p | {
          group: "GitHub: \($p[0])",
          name: (if ($p | length) > 1 then $p[1:] | join(" / ") else $p[0] end),
          result: ((.conclusion // .status) | norm),
          url: .html_url,
          duration_s: dur
        })
    else
      ($lane | index(" / ")) as $cut |
      [{
        group: (if $cut then $lane[:$cut] else $lane end),
        name: (if $cut then $lane[$cut + 3:] else $lane end),
        result: ($r.result | norm),
        url: $r.url,
        duration_s: null
      }]
    end) | add // []) as $jobs
  | ($jobs | map(select(.result != "skipped"))) as $ran
  | {
      run_id: $run_id,
      date: $date,
      image_tag: $tag,
      client_version: $client,
      run_url: $url,
      status: (if any($jobs[]; .result == "failure" or .result == "cancelled" or .result == "timed_out") then "fail"
               elif any($jobs[]; .result == "unstable") then "unstable" else "pass" end),
      summary: "\($ran | map(select(.result == "success")) | length)/\($ran | length) jobs passed",
      jobs: $jobs,
      investigations: []
    }'
