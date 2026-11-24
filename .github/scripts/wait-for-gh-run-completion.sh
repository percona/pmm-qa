#!/usr/bin/env bash
# wait-for-gh-run-completion.sh
#
# Polls a specific GH Actions run until it completes, then exits 0 on success
# and non-zero on failure / cancellation / timeout. Used by Jenkins after
# wait-for-gh-run.sh has resolved the run id.
#
# Usage:
#   wait-for-gh-run-completion.sh <repo> <run_id>
#
# Environment:
#   GH_TOKEN                  required; PAT with actions:read on the target repo
#   POLL_INTERVAL_SECONDS     default 30
#   POLL_TIMEOUT_SECONDS      default 14400 (4 hours)

set -euo pipefail

if [ $# -lt 2 ]; then
    echo "Usage: $0 <repo> <run_id>" >&2
    exit 2
fi

REPO=$1
RUN_ID=$2

POLL_INTERVAL_SECONDS=${POLL_INTERVAL_SECONDS:-30}
POLL_TIMEOUT_SECONDS=${POLL_TIMEOUT_SECONDS:-14400}

if [ -z "${GH_TOKEN:-}" ]; then
    echo "GH_TOKEN environment variable is required" >&2
    exit 2
fi

URL="https://api.github.com/repos/${REPO}/actions/runs/${RUN_ID}"

# A file, not stdout: curl clears it before a retry, so a body cut off mid-transfer
# can't be left in front of the retried one.
response_file=$(mktemp)
trap 'rm -f "${response_file}"' EXIT

start_ts=$(date +%s)
while true; do
    curl -fsSL --max-time 30 --retry 10 --retry-delay 15 --retry-max-time 300 \
        -o "${response_file}" \
        -H "Authorization: token ${GH_TOKEN}" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "${URL}"
    response=$(<"${response_file}")

    status=$(echo "${response}" | jq -r '.status // empty')
    conclusion=$(echo "${response}" | jq -r '.conclusion // empty')
    html_url=$(echo "${response}" | jq -r '.html_url // empty')

    now_ts=$(date +%s)
    elapsed=$(( now_ts - start_ts ))
    echo "[${elapsed}s] run ${RUN_ID}: status=${status} conclusion=${conclusion} url=${html_url}" >&2

    if [ "${status}" = "completed" ]; then
        case "${conclusion}" in
            success)
                echo "GH Actions run ${RUN_ID} succeeded: ${html_url}" >&2
                exit 0
                ;;
            "")
                echo "GH Actions run ${RUN_ID} reported completed status with empty conclusion: ${html_url}" >&2
                exit 1
                ;;
            *)
                echo "GH Actions run ${RUN_ID} ended with conclusion=${conclusion}: ${html_url}" >&2
                exit 1
                ;;
        esac
    fi

    if [ "${elapsed}" -ge "${POLL_TIMEOUT_SECONDS}" ]; then
        echo "Timed out after ${elapsed}s waiting for run ${RUN_ID} to complete: ${html_url}" >&2
        exit 1
    fi

    sleep "${POLL_INTERVAL_SECONDS}"
done
