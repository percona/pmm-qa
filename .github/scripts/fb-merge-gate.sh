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
# Every open feature build is read. Of the closed ones only the FB_CLOSED most recently
# updated are: a closed build whose product PRs were all closed without merge was
# abandoned and is ignored, one with a product PR still open keeps blocking.
#
# Environment:
#   GH_TOKEN      required; statuses:write on QA_REPO, read on the product repos
#   QA_REPO       default percona/pmm-qa
#   FB_REPO       default Percona-Lab/pmm-submodules
#   FB_CLOSED     closed FB PRs to read, most recently updated first, default 100

set -euo pipefail

QA_REPO="${QA_REPO:-percona/pmm-qa}"
FB_REPO="${FB_REPO:-Percona-Lab/pmm-submodules}"
FB_CLOSED="${FB_CLOSED:-100}"
CONTEXT="FB merge gate"

work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
git -C "${work}" init -q
git -C "${work}" remote add origin "https://github.com/${FB_REPO}.git"

# number<TAB>state of every open FB PR and the most recently updated closed ones
fb_list="${work}/fb.tsv"
gh api -X GET "repos/${FB_REPO}/pulls" -f state=open -f per_page=100 --paginate \
  --jq '.[] | [.number, .state] | @tsv' >"${fb_list}"
gh api -X GET "repos/${FB_REPO}/pulls" -f state=closed -f sort=updated -f direction=desc \
  -f per_page="${FB_CLOSED}" --jq '.[] | [.number, .state] | @tsv' >>"${fb_list}"

refspecs=()
while IFS=$'\t' read -r number _; do
  refspecs+=("+refs/pull/${number}/head:refs/fb/${number}")
done <"${fb_list}"
git -C "${work}" fetch -q --depth=1 origin "${refspecs[@]}"

# owner/repo of a GitHub URL, without .git
repo_of() {
  local url="${1%.git}"
  url="${url#https://github.com/}"
  url="${url#git@github.com:}"
  echo "${url}"
}

# One line per (QA branch, FB) pair:
#   qa_branch<TAB>fb<TAB>fb_state<TAB>products
# products: space-separated repo:head_owner:branch:base entries, or empty. Git refs
# cannot hold ':', spaces or tabs, so these delimiters are safe.
pairs="${work}/pairs.tsv"
: >"${pairs}"
while IFS=$'\t' read -r number state; do
  ref="refs/fb/${number}"
  git -C "${work}" cat-file -e "${ref}:ci.yml" 2>/dev/null || continue
  git -C "${work}" show "${ref}:.gitmodules" >"${work}/gitmodules"
  # name:branch:url, url last since it holds ':' itself. A non-blank IFS keeps empty
  # fields, which a tab would collapse: most ci.yml entries have no url.
  deps="$(git -C "${work}" show "${ref}:ci.yml" |
    yq -r '.deps // [] | .[] | [.name, (.branch // ""), (.url // "")] | join(":")' 2>/dev/null)" || continue

  qa_branch=""
  products=""
  while IFS=: read -r name branch url; do
    [[ -n "${name}" && -n "${branch}" ]] || continue
    upstream="$(git config -f "${work}/gitmodules" --get "submodule.${name}.url" || true)"
    base="$(git config -f "${work}/gitmodules" --get "submodule.${name}.branch" || echo main)"
    [[ -n "${upstream}" ]] || continue
    upstream="$(repo_of "${upstream}")"
    head_repo="$(repo_of "${url:-${upstream}}")"
    if [[ "${name}" = pmm-qa ]]; then
      [[ "${head_repo}" = "${QA_REPO}" ]] && qa_branch="${branch}"
    elif [[ "${head_repo}" != "${upstream}" || "${branch}" != "${base}" ]]; then
      products+="${upstream}:${head_repo%%/*}:${branch}:${base} "
    fi
  done <<<"${deps}"

  if [[ -n "${qa_branch}" ]]; then
    printf '%s\t%s\t%s\t%s\n' "${qa_branch}" "${number}" "${state}" "${products% }" >>"${pairs}"
  fi
done <"${fb_list}"

# open | merged | closed per product branch, cached for the run. An open PR wins over an
# older merged one from the same branch: the newer work has not landed yet.
declare -A pr_state
product_state() {
  local key="$1" repo owner branch base
  if [[ -z "${pr_state[${key}]+x}" ]]; then
    IFS=: read -r repo owner branch base <<<"${key}"
    pr_state[${key}]="$(gh api -X GET "repos/${repo}/pulls" -f state=all -f base="${base}" -f head="${owner}:${branch}" \
      --jq 'if any(.[]; .state == "open") then "open"
            elif any(.[]; .merged_at != null) then "merged"
            else "closed" end')"
  fi
  pstate="${pr_state[${key}]}"
}

# Sets gate_state and gate_desc for one QA branch. Runs in this shell, so the cache above
# lasts the whole run.
evaluate() {
  local qa_branch="$1" waiting="" fb fb_state products product all_merged all_closed first_missing repo branch
  while IFS=$'\t' read -r _ fb fb_state products; do
    all_merged=1
    all_closed=1
    first_missing=""
    for product in ${products}; do
      product_state "${product}"
      [[ "${pstate}" = closed ]] || all_closed=0
      if [[ "${pstate}" != merged ]]; then
        all_merged=0
        [[ -n "${first_missing}" ]] || first_missing="${product}"
      fi
    done
    if [[ "${all_merged}" = 1 ]]; then
      gate_state=success
      gate_desc="Product PRs of ${FB_REPO}#${fb} are merged"
      return
    fi
    if [[ "${fb_state}" = closed && "${all_closed}" = 1 ]]; then
      continue
    fi
    if [[ -z "${waiting}" ]]; then
      IFS=: read -r repo _ branch _ <<<"${first_missing}"
      waiting="Waiting for ${repo} ${branch} to merge (${FB_REPO}#${fb})"
    fi
  done < <(awk -F'\t' -v b="${qa_branch}" '$1 == b' "${pairs}")

  if [[ -n "${waiting}" ]]; then
    gate_state=pending
    gate_desc="${waiting}"
  else
    gate_state=success
    gate_desc="Not part of an open feature build"
  fi
}

qa_list="${work}/qa.tsv"
gh api -X GET "repos/${QA_REPO}/pulls" -f state=open -f base=main -f per_page=100 --paginate \
  --jq '.[] | [.head.sha, .number, .head.ref, .head.repo.full_name] | @tsv' >"${qa_list}"

# sha<TAB>state<TAB>description<TAB>pr
results="${work}/results.tsv"
: >"${results}"
while IFS=$'\t' read -r sha number head_ref head_repo; do
  if [[ "${head_repo}" = "${QA_REPO}" ]]; then
    evaluate "${head_ref}"
  else
    gate_state=success
    gate_desc="Not part of a feature build"
  fi
  printf '%s\t%s\t%s\t#%s\n' "${sha}" "${gate_state}" "${gate_desc:0:140}" "${number}" >>"${results}"
done <"${qa_list}"

# A commit status belongs to the commit, not the PR: when PRs share a head, the commit
# stays pending while any of them has to wait.
awk -F'\t' '
  !($1 in state) || ($2 == "pending" && state[$1] != "pending") { state[$1] = $2; desc[$1] = $3; prs[$1] = $4 }
  END { for (s in state) printf "%s\t%s\t%s\t%s\n", s, state[s], desc[s], prs[s] }
' "${results}" |
  while IFS=$'\t' read -r sha state description pr; do
    current="$(gh api "repos/${QA_REPO}/commits/${sha}/statuses?per_page=100" \
      --jq "[.[] | select(.context == \"${CONTEXT}\")][0] | \"\(.state)\t\(.description)\"")"
    if [[ "${current}" = "${state}"$'\t'"${description}" ]]; then
      continue
    fi
    echo "${pr} (${sha:0:12}): ${state} -- ${description}"
    gh api -X POST "repos/${QA_REPO}/statuses/${sha}" \
      -f state="${state}" -f context="${CONTEXT}" -f description="${description}" \
      -f target_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-${QA_REPO}}/actions/runs/${GITHUB_RUN_ID:-0}" \
      --silent
  done
