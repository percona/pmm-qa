#!/usr/bin/env bash
# fb-merge-gate.sh
#
# Sets the "FB merge gate" commit status on every open pmm-qa PR into main.
#
# A pmm-qa branch that a feature build lists in its ci.yml (Percona-Lab/pmm-submodules)
# tests behaviour of that build's product PRs (pmm, grafana, exporters...). Merged before
# them, it turns main red against 3-dev-latest. So such a PR stays `pending` until every
# product PR of at least one of its feature builds has merged into the branch the
# submodule tracks; any other PR gets `success` at once. With the status required on
# main and auto-merge on the PR, the QA PR lands minutes after the product.
#
# A closed feature build whose product PRs were all closed without merge was abandoned
# and is ignored. One with a product PR still open keeps blocking: that PR can still land.
#
# Environment:
#   GH_TOKEN      required; statuses:write on QA_REPO, read on the product repos
#   QA_REPO       default percona/pmm-qa
#   FB_REPO       default Percona-Lab/pmm-submodules
#   FB_PAGES      pages of 100 most recently updated FB PRs to read, default 2

set -euo pipefail

QA_REPO="${QA_REPO:-percona/pmm-qa}"
FB_REPO="${FB_REPO:-Percona-Lab/pmm-submodules}"
FB_PAGES="${FB_PAGES:-2}"
CONTEXT="FB merge gate"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
git -C "$work" init -q
git -C "$work" remote add origin "https://github.com/${FB_REPO}.git"

# number<TAB>state of the most recently updated FB PRs
fb_list="$work/fb.tsv"
: >"$fb_list"
for page in $(seq "$FB_PAGES"); do
  gh api "repos/${FB_REPO}/pulls?state=all&sort=updated&direction=desc&per_page=100&page=${page}" \
    --jq '.[] | [.number, .state] | @tsv' >>"$fb_list"
done

refspecs=()
while IFS=$'\t' read -r number _; do
  refspecs+=("+refs/pull/${number}/head:refs/fb/${number}")
done <"$fb_list"
git -C "$work" fetch -q --depth=1 origin "${refspecs[@]}"

# owner/repo of a GitHub URL, without .git
repo_of() {
  local url="${1%.git}"
  url="${url#https://github.com/}"
  url="${url#git@github.com:}"
  echo "$url"
}

# One line per (QA branch, FB) pair:
#   qa_branch<TAB>fb<TAB>fb_state<TAB>products
# products: space-separated repo|head_owner|branch|base entries, or empty
pairs="$work/pairs.tsv"
: >"$pairs"
while IFS=$'\t' read -r number state; do
  ref="refs/fb/${number}"
  git -C "$work" cat-file -e "${ref}:ci.yml" 2>/dev/null || continue
  git -C "$work" show "${ref}:.gitmodules" >"$work/gitmodules"
  deps="$(git -C "$work" show "${ref}:ci.yml" |
    yq -r '.deps // [] | .[] | [.name, (.url // ""), (.branch // "")] | @tsv' 2>/dev/null)" || continue

  qa_branch=""
  products=""
  while IFS=$'\t' read -r name url branch; do
    [ -n "$name" ] && [ -n "$branch" ] || continue
    upstream="$(git config -f "$work/gitmodules" --get "submodule.${name}.url" || true)"
    base="$(git config -f "$work/gitmodules" --get "submodule.${name}.branch" || echo main)"
    [ -n "$upstream" ] || continue
    upstream="$(repo_of "$upstream")"
    head_repo="$(repo_of "${url:-$upstream}")"
    if [ "$name" = pmm-qa ]; then
      [ "$head_repo" = "$QA_REPO" ] && qa_branch="$branch"
    elif [ "$branch" != "$base" ]; then
      products+="${upstream}|${head_repo%%/*}|${branch}|${base} "
    fi
  done <<<"$deps"

  [ -n "$qa_branch" ] && printf '%s\t%s\t%s\t%s\n' "$qa_branch" "$number" "$state" "${products% }" >>"$pairs"
done <"$fb_list"

# merged | open | closed, per product PR, cached for the run
declare -A pr_state
product_state() {
  local key="$1" repo owner branch base
  if [ -z "${pr_state[$key]+x}" ]; then
    IFS='|' read -r repo owner branch base <<<"$key"
    pr_state[$key]="$(gh api "repos/${repo}/pulls?state=all&base=${base}&head=${owner}:${branch}" \
      --jq 'if any(.[]; .merged_at != null) then "merged"
            elif any(.[]; .state == "open") then "open"
            else "closed" end')"
  fi
  echo "${pr_state[$key]}"
}

# Prints "state<TAB>description" for one QA branch.
evaluate() {
  local qa_branch="$1" waiting="" fb fb_state products product s all_merged all_closed first_missing repo branch
  while IFS=$'\t' read -r _ fb fb_state products; do
    all_merged=1
    all_closed=1
    first_missing=""
    for product in $products; do
      s="$(product_state "$product")"
      [ "$s" = closed ] || all_closed=0
      if [ "$s" != merged ]; then
        all_merged=0
        [ -n "$first_missing" ] || first_missing="$product"
      fi
    done
    if [ "$all_merged" = 1 ]; then
      printf 'success\tProduct PRs of %s#%s are merged\n' "$FB_REPO" "$fb"
      return
    fi
    if [ "$fb_state" = closed ] && [ "$all_closed" = 1 ]; then
      continue
    fi
    if [ -z "$waiting" ]; then
      IFS='|' read -r repo _ branch _ <<<"$first_missing"
      waiting="Waiting for ${repo} ${branch} to merge (${FB_REPO}#${fb})"
    fi
  done < <(awk -F'\t' -v b="$qa_branch" '$1 == b' "$pairs")

  if [ -n "$waiting" ]; then
    printf 'pending\t%s\n' "$waiting"
  else
    printf 'success\tNot part of an open feature build\n'
  fi
}

gh api "repos/${QA_REPO}/pulls?state=open&base=main&per_page=100" --paginate \
  --jq '.[] | [.number, .head.ref, .head.sha, .head.repo.full_name] | @tsv' |
  while IFS=$'\t' read -r number head_ref sha head_repo; do
    if [ "$head_repo" = "$QA_REPO" ]; then
      IFS=$'\t' read -r state description < <(evaluate "$head_ref")
    else
      state=success
      description="Not part of a feature build"
    fi
    description="${description:0:140}"

    current="$(gh api "repos/${QA_REPO}/commits/${sha}/statuses?per_page=100" \
      --jq "[.[] | select(.context == \"${CONTEXT}\")][0] | \"\(.state)\t\(.description)\"")"
    if [ "$current" = "${state}"$'\t'"${description}" ]; then
      continue
    fi
    echo "#${number} (${head_ref}): ${state} -- ${description}"
    gh api -X POST "repos/${QA_REPO}/statuses/${sha}" \
      -f state="$state" -f context="$CONTEXT" -f description="$description" \
      -f target_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-$QA_REPO}/actions/runs/${GITHUB_RUN_ID:-0}" \
      --silent
  done
