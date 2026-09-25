#!/usr/bin/env bash
# Publish or update one nightly run's report on the GitHub Pages site (gh-pages
# branch, under nightly/). Re-publishing an existing run_id merges into it and
# appends its investigations, so the investigator can add findings after the run.
set -Eeuo pipefail

RUN_JSON="${1:?usage: publish_report.sh <run.json>}"
PAGES_BRANCH="${PAGES_BRANCH:-gh-pages}"
PAGE_SRC="$(cd "$(dirname "$0")/../pages" && pwd)"
LANDING_SRC="$(cd "$(dirname "$0")/../.." && pwd)/pages/index.html"
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
[ -s "$RUN_JSON" ] || { echo "missing or empty: $RUN_JSON" >&2; exit 1; }
jq -e '.run_id' "$RUN_JSON" >/dev/null || { echo "run.json needs run_id" >&2; exit 1; }
run_id="$(jq -r '.run_id' "$RUN_JSON")"
[[ "$run_id" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "bad run_id: $run_id" >&2; exit 1; }

remote="${PAGES_REMOTE:-}"
if [ -z "$remote" ] && [ -n "${GITHUB_TOKEN:-}" ] && [ -n "${GITHUB_REPOSITORY:-}" ]; then
  remote="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
fi
if [ -z "$remote" ]; then
  [ -z "${GITHUB_ACTIONS:-}" ] || { echo "in CI set PAGES_REMOTE, or GITHUB_TOKEN and GITHUB_REPOSITORY" >&2; exit 1; }
  remote="$(git config --get remote.origin.url)"
fi

wt="$(mktemp -d)"
trap 'rm -rf "$wt"' EXIT
trap 'exit 143' TERM; trap 'exit 130' INT; trap 'exit 129' HUP
git clone --quiet --depth 1 --branch "$PAGES_BRANCH" "$remote" "$wt"

# Called from `if`, so set -e is off inside: every step returns its own failure.
publish() {
  local dir="$wt/nightly" out
  mkdir -p "$dir/reports" "$dir/data"
  out="$dir/reports/${run_id}.json"
  if [ -f "$out" ]; then
    # Investigations append. A claim ("<by> is investigating <suites>") is replaced by the
    # same author's newer claim, and dropped once that author publishes a finding for it.
    jq -s '
      .[0] as $old | .[1] as $new |
      (($old.investigations // []) + ($new.investigations // []) | unique) as $inv |
      (($old.claims // []) + ($new.claims // [])
        | group_by([.by, (.suites | sort)]) | map(max_by(.at))
        | map(. as $c | select(any($inv[]; .by == $c.by and ((.suites // []) - ($c.suites // []) | length) < (.suites // [] | length)) | not))
      ) as $claims |
      ($old * $new) + {investigations: $inv, claims: $claims}' \
      "$out" "$RUN_JSON" > "$out.new" || return 1
    mv "$out.new" "$out" || return 1
  else
    cp "$RUN_JSON" "$out" || return 1
  fi
  jq -s 'sort_by(.date)' "$dir"/reports/*.json > "$dir/data/index.json" || return 1
  cp -R "$PAGE_SRC"/. "$dir/" || return 1
  # The site landing page replaces the root only once performance lives under
  # performance/; until then the root is still the performance dashboard.
  if [ -d "$wt/performance" ] && [ -f "$LANDING_SRC" ]; then
    cp "$LANDING_SRC" "$wt/index.html"
    git -C "$wt" add index.html
  fi
  git -C "$wt" add nightly
  if git -C "$wt" diff --cached --quiet; then echo "nothing new to publish for $run_id"; return 0; fi
  git -C "$wt" \
    -c user.name="${GIT_AUTHOR_NAME:-pmm-nightly-bot}" \
    -c user.email="${GIT_AUTHOR_EMAIL:-pmm-nightly-bot@users.noreply.github.com}" \
    commit --quiet -m "nightly: publish report ${run_id}" || return 1
  git -C "$wt" push --quiet origin "$PAGES_BRANCH" || return 1
  echo "published nightly/reports/${run_id}.json to ${PAGES_BRANCH}"
}

for attempt in 1 2 3 4 5; do
  if publish; then exit 0; fi
  echo "publish attempt $attempt failed; re-syncing ${PAGES_BRANCH} and retrying" >&2
  git -C "$wt" fetch --quiet --depth 1 origin "$PAGES_BRANCH"
  git -C "$wt" reset --quiet --hard "origin/${PAGES_BRANCH}"
done
echo "failed to publish ${run_id} after 5 attempts" >&2
exit 1
