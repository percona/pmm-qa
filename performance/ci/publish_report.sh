#!/usr/bin/env bash
# Publish one performance run's report to the GitHub Pages site (gh-pages branch).
# See README.md for usage and the credentials the push needs.
set -Eeuo pipefail

RUN_JSON="${1:?usage: publish_report.sh <run.json>}"
PAGES_BRANCH="${PAGES_BRANCH:-gh-pages}"
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
[ -s "$RUN_JSON" ] || { echo "missing or empty: $RUN_JSON" >&2; exit 1; }
jq -e '.run_id and .date and (.status == "pass" or .status == "fail")' "$RUN_JSON" >/dev/null \
  || { echo "run.json needs run_id, date, and status (pass|fail)" >&2; exit 1; }
run_id="$(jq -r '.run_id' "$RUN_JSON")"
status="$(jq -r '.status' "$RUN_JSON")"
[[ "$run_id" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "bad run_id: $run_id" >&2; exit 1; }

remote="${PAGES_REMOTE:-}"
if [ -z "$remote" ] && [ -n "${GITHUB_TOKEN:-}" ] && [ -n "${GITHUB_REPOSITORY:-}" ]; then
  remote="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
fi
if [ -z "$remote" ]; then
  # Outside CI the developer's credential helper authenticates origin. In CI the
  # checkout token lives only in the workspace repo's .git/config, which a fresh
  # clone never inherits -- so require an explicit authenticated remote instead of
  # failing on the final push.
  [ -z "${GITHUB_ACTIONS:-}" ] || { echo "in CI set PAGES_REMOTE, or GITHUB_TOKEN and GITHUB_REPOSITORY" >&2; exit 1; }
  remote="$(git config --get remote.origin.url)"
fi

wt="$(mktemp -d)"
trap 'rm -rf "$wt"' EXIT
trap 'exit 143' TERM; trap 'exit 130' INT; trap 'exit 129' HUP
git clone --quiet --depth 1 --branch "$PAGES_BRANCH" "$remote" "$wt"

publish() {
  mkdir -p "$wt/reports" "$wt/data"
  cp "$RUN_JSON" "$wt/reports/${run_id}.json"
  jq -s 'sort_by(.date)' "$wt"/reports/*.json > "$wt/data/index.json"
  git -C "$wt" add "reports/${run_id}.json" data/index.json
  if git -C "$wt" diff --cached --quiet; then echo "nothing new to publish for $run_id"; return 0; fi
  git -C "$wt" \
    -c user.name="${GIT_AUTHOR_NAME:-pmm-perf-bot}" \
    -c user.email="${GIT_AUTHOR_EMAIL:-pmm-perf-bot@users.noreply.github.com}" \
    commit --quiet -m "perf: publish report ${run_id} (${status})"
  git -C "$wt" push --quiet origin "$PAGES_BRANCH"
  echo "published reports/${run_id}.json ($status) to ${PAGES_BRANCH}"
}

# Concurrent runs (a scale matrix, a manual run beside a scheduled one) race on the
# push; a non-fast-forward rejection is expected, so re-sync to the branch tip and
# rebuild the index rather than losing the run.
for attempt in 1 2 3 4 5; do
  if publish; then exit 0; fi
  echo "publish attempt $attempt failed; re-syncing ${PAGES_BRANCH} and retrying" >&2
  git -C "$wt" fetch --quiet --depth 1 origin "$PAGES_BRANCH"
  git -C "$wt" reset --quiet --hard "origin/${PAGES_BRANCH}"
done
echo "failed to publish ${run_id} after 5 attempts" >&2
exit 1
