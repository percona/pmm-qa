#!/usr/bin/env bash
# wait-for-gh-run.sh
#
# Polls GitHub for the most-recently-created workflow_dispatch run of a given
# workflow file on a given ref, and prints the run id once it appears. Used by
# Jenkins right after a workflow_dispatch POST to get a handle on the new run.
#
# Usage:
#   wait-for-gh-run.sh <repo> <workflow_file> <ref> <dispatched_at_iso8601> [marker]
#
# Arguments:
#   <repo>                    e.g. percona/pmm-qa
#   <workflow_file>           e.g. nightly-e2e-tests-matrix.yml
#   <ref>                     branch/tag the workflow was dispatched on
#   <dispatched_at_iso8601>   timestamp captured BEFORE the dispatch POST. We
#                             only consider runs whose created_at is >= this
#                             timestamp so we don't latch onto a previous run.
#   [marker]                  optional value unique to this caller -- the PMM
#                             server address -- which the workflow puts at the
#                             end of its run-name as "pmm@<marker>". Without it
#                             the timestamp alone decides, and concurrent
#                             callers dispatching the same file on the same ref
#                             within the same second all pick whichever run is
#                             newest: three nightly lanes once polled, and
#                             failed on, a single run that belonged to one of
#                             them while their own went unchecked.
#
# Environment:
#   GH_TOKEN                  required; fine-grained or classic PAT with
#                             actions:read on the target repo. The Jenkins
#                             pipeline already binds GITHUB_API_TOKEN to GH_TOKEN.
#   POLL_INTERVAL_SECONDS     default 5
#   POLL_TIMEOUT_SECONDS      default 600 (10 minutes — workflow_dispatch
#                             usually shows up within ~15s but we give it
#                             plenty of room).

set -euo pipefail

if [ $# -lt 4 ]; then
    echo "Usage: $0 <repo> <workflow_file> <ref> <dispatched_at_iso8601>" >&2
    exit 2
fi

REPO=$1
WORKFLOW_FILE=$2
REF=$3
DISPATCHED_AT=$4
MARKER=${5:-}

POLL_INTERVAL_SECONDS=${POLL_INTERVAL_SECONDS:-5}
POLL_TIMEOUT_SECONDS=${POLL_TIMEOUT_SECONDS:-600}

if [ -z "${GH_TOKEN:-}" ]; then
    echo "GH_TOKEN environment variable is required" >&2
    exit 2
fi

# Ten lanes dispatch this workflow at once, so a page of 10 can push a caller's
# own run off the end before it ever sees it.
URL="https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&branch=${REF}&per_page=50"

start_ts=$(date +%s)
while true; do
    response=$(curl -fsSL \
        -H "Authorization: token ${GH_TOKEN}" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "${URL}")

    # Candidates are the runs created at or after our dispatch. With a marker we
    # take only the one whose run-name ends in "pmm@<marker>"; without one, or
    # against a ref whose workflow predates run-name and so marks nothing, we
    # fall back to the newest candidate and say so.
    run_id=$(echo "${response}" | jq -r \
        --arg since "${DISPATCHED_AT}" \
        --arg suffix "pmm@${MARKER}" \
        --arg marked "${MARKER:+yes}" '
        [.workflow_runs[] | select(.created_at >= $since)] as $candidates
        | if $marked == "" or ([$candidates[] | select((.display_title // "") | contains("pmm@"))] | length) == 0
          then $candidates
          else [$candidates[] | select((.display_title // "") | endswith($suffix))]
          end
        | sort_by(.created_at) | reverse
        | (.[0].id // empty)
    ')

    if [ -n "${run_id}" ]; then
        if [ -n "${MARKER}" ] && ! echo "${response}" | jq -e --arg suffix "pmm@${MARKER}" \
                '[.workflow_runs[] | select((.display_title // "") | endswith($suffix))] | length > 0' >/dev/null; then
            echo "WARNING: no run named 'pmm@${MARKER}' -- this workflow ref does not set run-name, so run ${run_id} was chosen by timestamp alone and may belong to another concurrent caller" >&2
        fi
        echo "${run_id}"
        exit 0
    fi

    now_ts=$(date +%s)
    elapsed=$(( now_ts - start_ts ))
    if [ "${elapsed}" -ge "${POLL_TIMEOUT_SECONDS}" ]; then
        echo "Timed out after ${elapsed}s waiting for a workflow_dispatch run of ${WORKFLOW_FILE} on ${REF} >= ${DISPATCHED_AT}${MARKER:+ named pmm@${MARKER}}" >&2
        exit 1
    fi
    echo "No matching run yet (elapsed=${elapsed}s); sleeping ${POLL_INTERVAL_SECONDS}s" >&2
    sleep "${POLL_INTERVAL_SECONDS}"
done
