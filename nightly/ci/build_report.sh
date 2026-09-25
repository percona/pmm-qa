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
  # Report groups: the unit the page summarises and the Investigate button covers.
  def jenkins_group:
    if   startswith("pkg amd64 / ") then "Package AMD"
    elif startswith("pkg arm64 / ") then "Package ARM"
    elif startswith("upgrade / ami ") then "Upgrade AMI"
    elif startswith("upgrade / ") then "Upgrade AMD"
    elif . == "nightly / gssapi" or . == "ha" or . == "openshift" then "HA, OpenShift & GSSAPI"
    elif startswith("nightly / ") then "Nightly"
    elif startswith("compat / ") then "Nightly Compatibility"
    elif startswith("ui / ") then "UI"
    else "Other" end;
  def github_group:
    if   startswith("E2E Tests Matrix") then "E2E Tests"
    elif startswith("Compatibility CLI") then "CLI Integration Compatibility"
    elif startswith("CLI integration") then "CLI Integration"
    elif test("^(GSSAPI Tests Matrix|pmm3-helm|PMM_PSMDB_PBM_FULL|PMM_PROXYSQL|PMM_PDPGSQL)") then "Integrations"
    else "Other" end;
  def leaf: (index(" / ")) as $cut | if $cut then .[$cut + 3:] else . end;
  ($results[0] | to_entries | map(
    .key as $lane | .value as $r |
    if ($gh[0][$lane] // []) | length > 0 then
      $gh[0][$lane]
      | map(select(.name | test("^(Resolve build under test|Compatibility matrix|GA pmm-client tags)") | not))
      | map((.name | split(" / ")) as $p | {
          source: "github",
          group: ($p[0] | github_group),
          name: (($p[1:] | map(select(. != "CLI" and . != "Integration"))) as $rest |
            if ($p[0] | startswith("Compatibility CLI")) then
              "\($p[0] | capture("\\((?<v>[^)]+)\\)").v // $p[0]) · \($rest | join(" / "))"
            elif ($p[0] | test("^(E2E Tests Matrix|CLI integration)")) and ($rest | length) > 0 then $rest | join(" / ")
            else .name end),
          result: ((.conclusion // .status) | norm),
          url: .html_url,
          duration_s: dur
        })
    else
      [{
        source: "jenkins",
        group: ($lane | jenkins_group),
        name: (if ($lane | jenkins_group) == "HA, OpenShift & GSSAPI" then $lane else ($lane | leaf) end),
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
