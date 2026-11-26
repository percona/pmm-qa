#!/usr/bin/env bash
# Sets the "FB merge gate" commit status on every open pmm-qa PR into main.
# A PR waits for the product PRs of the FBs that build its branch, and for every PR its body
# names after "do not merge", "blocked-on" or "depends on" at the start of a line or sentence.
# FB PRs named there are skipped: they close without merging, and ci.yml already pairs them.
#
# Environment:
#   GH_TOKEN      required; statuses:write on QA_REPO, read on the product repos
#   QA_REPO       default percona/pmm-qa
#   FB_REPO       default Percona-Lab/pmm-submodules
#   FB_CLOSED     closed FB PRs to read, most recently updated first, default 100

set -euo pipefail

QA_REPO="${QA_REPO:-percona/pmm-qa}"
QA_REPO="${QA_REPO,,}"
FB_REPO="${FB_REPO:-Percona-Lab/pmm-submodules}"
FB_CLOSED="${FB_CLOSED:-100}"
CONTEXT="FB merge gate"

work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
git -C "${work}" init -q
git -C "${work}" remote add origin "https://github.com/${FB_REPO}.git"

# One query reads the open QA PRs with their current gate status, the most recently
# updated closed FB PRs and the first page of open ones; later pages read only the latter.
list_query='
query($qaOwner: String!, $qaName: String!, $fbOwner: String!, $fbName: String!,
      $context: String!, $closed: Int!, $first: Boolean!, $after: String) {
  qa: repository(owner: $qaOwner, name: $qaName) @include(if: $first) {
    pullRequests(states: OPEN, baseRefName: "main", first: 100) {
      nodes {
        number headRefName headRefOid body
        headRepository { nameWithOwner }
        commits(last: 1) { nodes { commit { status { context(name: $context) { state description } } } } }
      }
    }
  }
  closed: repository(owner: $fbOwner, name: $fbName) @include(if: $first) {
    pullRequests(states: [CLOSED, MERGED], first: $closed, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes { number }
    }
  }
  open: repository(owner: $fbOwner, name: $fbName) {
    pullRequests(states: OPEN, first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { number }
    }
  }
}'

# sha<TAB>pr<TAB>head_ref<TAB>head_repo<TAB>body_deps<TAB>current_state<TAB>current_description
# body_deps: space-separated owner/repo#number entries, or "-"; a tab-split read drops empty fields.
qa_list="${work}/qa.tsv"
# number<TAB>state of the FB PRs
fb_list="${work}/fb.tsv"
first=true
after=""
while :; do
  args=(-f query="${list_query}" -f qaOwner="${QA_REPO%%/*}" -f qaName="${QA_REPO#*/}"
    -f fbOwner="${FB_REPO%%/*}" -f fbName="${FB_REPO#*/}" -f context="${CONTEXT}"
    -F closed="${FB_CLOSED}" -F first="${first}")
  [[ -z "${after}" ]] || args+=(-f after="${after}")
  page="$(gh api graphql "${args[@]}")"
  if [[ "${first}" = true ]]; then
    jq -r '.data.qa.pullRequests.nodes[]
      | (.commits.nodes[0].commit.status.context // {}) as $s
      | ([(.body // "") | split("\n")[]
          | scan("(?:^|[·;.]\\s)\\s*(?:[-*>]\\s*)?(?:\\*\\*)?(?:do not merge|blocked[- ]on|depends on)([^·;]*)"; "i")[0]
          | scan("(?:https://github\\.com/)?([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)(?:/pull/|#)([0-9]+)")
          | "\(.[0] | ascii_downcase)#\(.[1])"
          | select(startswith("percona-lab/pmm-submodules#") | not)] | unique | join(" ")) as $deps
      | [.headRefOid, .number, .headRefName, ((.headRepository.nameWithOwner // "") | ascii_downcase),
         (if $deps == "" then "-" else $deps end),
         (($s.state // "") | ascii_downcase), ($s.description // "")] | @tsv' <<<"${page}" >"${qa_list}"
    jq -r '.data.closed.pullRequests.nodes[] | [.number, "closed"] | @tsv' <<<"${page}" >"${fb_list}"
  fi
  jq -r '.data.open.pullRequests.nodes[] | [.number, "open"] | @tsv' <<<"${page}" >>"${fb_list}"
  [[ "$(jq -r '.data.open.pullRequests.pageInfo.hasNextPage' <<<"${page}")" = true ]] || break
  after="$(jq -r '.data.open.pullRequests.pageInfo.endCursor' <<<"${page}")"
  first=false
done

refspecs=()
while IFS=$'\t' read -r number _; do
  refspecs+=("+refs/pull/${number}/head:refs/fb/${number}")
done <"${fb_list}"
timeout 300 git -C "${work}" fetch -q --depth=1 origin "${refspecs[@]}"

# owner/repo of a GitHub URL, without .git
repo_of() {
  local url="${1%.git}"
  url="${url#https://github.com/}"
  url="${url#git@github.com:}"
  echo "${url,,}"
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

# FB rows whose QA branch is exactly $1; awk would compare numeric-looking names as numbers.
pairs_for() {
  awk -F'\t' -v b="$1" '($1 "") == (b "")' "${pairs}"
}

# The PRs named in QA PR bodies, read in one query. A PR that cannot be read stays unmerged.
declare -A dep_state
deps=()
while IFS=$'\t' read -r _ _ _ _ body_deps _ _; do
  [[ "${body_deps}" = - ]] && continue
  for dep in ${body_deps}; do
    [[ -n "${dep_state[${dep}]+x}" ]] && continue
    dep_state[${dep}]=unknown
    deps+=("${dep}")
  done
done <"${qa_list}"

if (( ${#deps[@]} )); then
  vars=""
  fields=""
  args=()
  for i in "${!deps[@]}"; do
    repo="${deps[${i}]%#*}"
    vars+=" \$o${i}: String! \$n${i}: String! \$m${i}: Int!"
    fields+=" d${i}: repository(owner: \$o${i}, name: \$n${i}) { pullRequest(number: \$m${i}) { state } }"
    args+=(-f "o${i}=${repo%%/*}" -f "n${i}=${repo#*/}" -F "m${i}=${deps[${i}]##*#}")
  done
  # A missing repository or PR fails the query but still returns data for the others.
  dep_page="$(gh api graphql -f query="query(${vars}) {${fields} }" "${args[@]}" 2>/dev/null)" || true
  [[ -n "${dep_page}" ]] || dep_page='{}'
  for i in "${!deps[@]}"; do
    state="$(jq -r --arg k "d${i}" '.data[$k].pullRequest.state // empty' <<<"${dep_page}" 2>/dev/null || true)"
    [[ -n "${state}" ]] && dep_state[${deps[${i}]}]="${state,,}"
  done
fi

# The product branches of FBs that pair with an open QA PR, read in one query.
declare -A pr_state
keys=()
while IFS=$'\t' read -r _ _ head_ref head_repo _ _ _; do
  [[ "${head_repo}" = "${QA_REPO}" ]] || continue
  while IFS=$'\t' read -r _ _ _ products; do
    for product in ${products}; do
      [[ -n "${pr_state[${product}]+x}" ]] && continue
      pr_state[${product}]=closed
      keys+=("${product}")
    done
  done < <(pairs_for "${head_ref}")
done <"${qa_list}"

if (( ${#keys[@]} )); then
  vars=""
  fields=""
  args=()
  for i in "${!keys[@]}"; do
    IFS=: read -r repo owner branch base <<<"${keys[${i}]}"
    vars+=" \$o${i}: String! \$n${i}: String! \$h${i}: String! \$b${i}: String!"
    fields+=" p${i}: repository(owner: \$o${i}, name: \$n${i}) {"
    fields+=" pullRequests(headRefName: \$h${i}, baseRefName: \$b${i}, first: 20, states: [OPEN, MERGED, CLOSED])"
    fields+=" { nodes { state headRepositoryOwner { login } } } }"
    args+=(-f "o${i}=${repo%%/*}" -f "n${i}=${repo#*/}" -f "h${i}=${branch}" -f "b${i}=${base}")
  done
  # alias<TAB>state<TAB>head owner, one line per PR from a product branch
  gh api graphql -f query="query(${vars}) {${fields} }" "${args[@]}" \
    --jq '.data | to_entries[] | .key as $k | (.value.pullRequests.nodes // [])[]
      | [$k, .state, ((.headRepositoryOwner.login // "") | ascii_downcase)] | @tsv' >"${work}/products.tsv"
  # An open PR wins over an older merged one from the same branch: the newer work has not
  # landed yet.
  for i in "${!keys[@]}"; do
    owner="$(cut -d: -f2 <<<"${keys[${i}]}")"
    states="$(awk -F'\t' -v k="p${i}" -v o="${owner}" '$1 == k && $3 == o { print $2 }' "${work}/products.tsv")"
    if grep -qx OPEN <<<"${states}"; then
      pr_state[${keys[${i}]}]=open
    elif grep -qx MERGED <<<"${states}"; then
      pr_state[${keys[${i}]}]=merged
    fi
  done
fi

# Sets gate_state and gate_desc for one QA branch.
evaluate() {
  local qa_branch="$1" waiting="" fb fb_state products product all_merged all_closed first_missing repo branch
  while IFS=$'\t' read -r _ fb fb_state products; do
    all_merged=1
    all_closed=1
    first_missing=""
    for product in ${products}; do
      pstate="${pr_state[${product}]}"
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
  done < <(pairs_for "${qa_branch}")

  if [[ -n "${waiting}" ]]; then
    gate_state=pending
    gate_desc="${waiting}"
  else
    gate_state=success
    gate_desc="Not part of an open feature build"
  fi
}

# sha<TAB>state<TAB>description<TAB>pr<TAB>current_state<TAB>current_description
results="${work}/results.tsv"
: >"${results}"
while IFS=$'\t' read -r sha number head_ref head_repo body_deps cur_state cur_desc; do
  waiting_dep=""
  if [[ "${body_deps}" != - ]]; then
    for dep in ${body_deps}; do
      if [[ "${dep_state[${dep}]}" != merged ]]; then
        waiting_dep="${dep}"
        break
      fi
    done
  fi
  if [[ -n "${waiting_dep}" ]]; then
    gate_state=pending
    if [[ "${dep_state[${waiting_dep}]}" = closed ]]; then
      gate_desc="${waiting_dep} was closed without merging; update the PR body"
    else
      gate_desc="Waiting for ${waiting_dep} to merge (named in the PR body)"
    fi
  elif [[ "${head_repo}" = "${QA_REPO}" ]]; then
    evaluate "${head_ref}"
  else
    gate_state=success
    gate_desc="Not part of a feature build"
  fi
  printf '%s\t%s\t%s\t#%s\t%s\t%s\n' "${sha}" "${gate_state}" "${gate_desc:0:140}" "${number}" \
    "${cur_state:--}" "${cur_desc:--}" >>"${results}"
done <"${qa_list}"

# A commit status belongs to the commit, not the PR: when PRs share a head, the commit
# stays pending while any of them has to wait.
awk -F'\t' '
  !($1 in state) || ($2 == "pending" && state[$1] != "pending") { state[$1] = $2; desc[$1] = $3; prs[$1] = $4 }
  !($1 in cur) { cur[$1] = $5 "\t" $6 }
  END { for (s in state) printf "%s\t%s\t%s\t%s\t%s\n", s, state[s], desc[s], prs[s], cur[s] }
' "${results}" |
  while IFS=$'\t' read -r sha state description pr cur_state cur_desc; do
    if [[ "${cur_state}" = "${state}" && "${cur_desc}" = "${description}" ]]; then
      continue
    fi
    echo "${pr} (${sha:0:12}): ${state} -- ${description}"
    gh api -X POST "repos/${QA_REPO}/statuses/${sha}" \
      -f state="${state}" -f context="${CONTEXT}" -f description="${description}" \
      -f target_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-${QA_REPO}}/actions/runs/${GITHUB_RUN_ID:-0}" \
      --silent
  done
