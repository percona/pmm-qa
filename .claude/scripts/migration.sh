#!/usr/bin/env bash
# Mechanical steps of the CodeceptJS migration, so agents spend time only on judgement.
#
#   migration.sh preflight [--allow-unpushed] [--allow-open-pr <n>]   checks, main merge, drift, next pending row
#   migration.sh mark <row> <in-progress|done> [pr-url]                 tracker status edit + commit on control
#   migration.sh env-check <service-prefix>...                          creds, services, QAN rows per prefix (now-120m)
#   migration.sh publish-branch <branch>                                worktree from origin/<branch> or origin/main, apply control's changes, npm ci
#   migration.sh selection [extra-grep]...                              per-expression --list diff, base vs publish branch
#   migration.sh revalidate <file>...                                   conventions, eslint, tsc, README check, tested-copy check
#   migration.sh publish <title> <body-file> <flag> <setup-services>    push, open or edit PR, dispatch the Playwright runner, link the job
#
# Env: PMM_UI_URL (https://127.0.0.1/), ADMIN_PASSWORD (admin-password).
set -uo pipefail

control=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
publish=$(dirname "$control")/pmm-qa-publish
base_tree=$(dirname "$control")/pmm-qa-base
tracker=.claude/skills/codeceptjs-migration/tracker.md
url=${PMM_UI_URL:-https://127.0.0.1/}
pass=${ADMIN_PASSWORD:-admin-password}
repo=percona/pmm-qa

die() { echo "STOP: $*" >&2; exit 1; }

preflight() {
  local allow_unpushed='' allow_pr=''
  while (($#)); do
    case $1 in
      --allow-unpushed) allow_unpushed=1 ;;
      --allow-open-pr) allow_pr=$2; shift ;;
    esac
    shift
  done
  cd "$control" || exit 1
  [[ -z $(git status --short) ]] || die "control worktree not clean"
  git fetch -q origin || die "fetch failed"
  grep -qE '^\| [0-9]+ +\| in-progress' "$tracker" && die "row in progress: $(grep -E '^\| [0-9]+ +\| in-progress' "$tracker" | cut -c1-120)"
  local prs
  prs=$(gh pr list --repo "$repo" --state open --json number,title --jq '[.[] | select(.title | startswith("migrate(")) | .number] | join(" ")') ||
    die "gh pr list failed"
  [[ -z $prs || $prs == "$allow_pr" ]] || die "open migration PR(s): $prs"
  local ahead
  ahead=$(git log --oneline '@{u}..HEAD')
  [[ -z $ahead || -n $allow_unpushed ]] || die "control has unpushed commits:"$'\n'"$ahead"
  node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a==22&&b>=18)?0:1)' || die "Node < 22.18"
  git merge -q --no-edit origin/main || die "merge of origin/main failed; resolve on the markers"
  git check-ignore -q "$tracker" && die "tracker is gitignored"
  local found tracked
  found=$(find codeceptjs-e2e/tests -name '*_test.js' | sort -u)
  tracked=$(grep -oE 'codeceptjs-e2e/tests/[A-Za-z0-9_/.-]+_test\.js' "$tracker" | sort -u)
  echo "drift untracked=$(comm -23 <(echo "$found") <(echo "$tracked") | grep -c .) tracked-absent=$(comm -13 <(echo "$found") <(echo "$tracked") | grep -c .)"
  local pw verified
  pw=$(grep -oE '"@playwright/test": "[^0-9]*[0-9.]+' e2e_tests/package.json | grep -oE '[0-9.]+$')
  verified=$(grep -oE 'verifiedAgainst: [0-9.]+' .claude/skills/codeceptjs-migration/playwright-practices.md | grep -oE '[0-9.]+$')
  [[ $pw == "$verified" ]] || echo "WARN: @playwright/test $pw != verifiedAgainst $verified"
  echo "next: $(grep -m1 -E '^\| [0-9]+ +\| pending' "$tracker")"
}

mark() {
  local row=$1 status=$2 pr=${3:-}
  cd "$control" || exit 1
  python - "$tracker" "$row" "$status" "$pr" <<'EOF' || exit 1
import re, sys
path, row, status, pr = sys.argv[1:]
lines = open(path, 'rb').read().split(b'\n')
hits = [i for i, l in enumerate(lines) if re.match(rb'^\| %s +\|' % row.encode(), l)]
assert len(hits) == 1, f'row {row}: {len(hits)} matches'
cells = lines[hits[0]].split(b'|')
cells[2] = b' ' + status.encode().ljust(len(cells[2]) - 2) + b' '
if pr:
    cells[-2] = b' ' + b' '.join(x for x in (cells[-2].strip(), pr.encode()) if x) + b' '
lines[hits[0]] = b'|'.join(cells)
open(path, 'wb').write(b'\n'.join(lines))
EOF
  [[ $(git diff --numstat -- "$tracker" | cut -f1,2) == $'1\t1' ]] || die "tracker diff is not one line"
  git add -- "$tracker" || exit 1
  local name
  name=$(grep -E "^\| $row +\|" "$tracker" | grep -oE 'tests/[A-Za-z0-9_/.-]+_test\.js' | head -1 | xargs basename | sed 's/\.js$//')
  git commit -q -m "chore(migration): mark $name ${status/-/ }" && git log --oneline -1
}

env_check() {
  curl -sk -o /dev/null -w '%{http_code}' -u "admin:$pass" "${url}v1/users/me" | grep -q 200 || die "/v1/users/me not 200 (wrong password?)"
  local from to report services
  from=$(date -u -d '-120 min' +%FT%TZ)
  to=$(date -u +%FT%TZ)
  services=$(curl -sk -u "admin:$pass" "${url}v1/inventory/services" | python -c 'import sys,json;[print(s["service_name"]) for v in json.load(sys.stdin).values() for s in v]')
  report=$(curl -sk -u "admin:$pass" -X POST "${url}v1/qan/metrics:getReport" \
    -d "{\"period_start_from\":\"$from\",\"period_start_to\":\"$to\",\"group_by\":\"service_name\",\"limit\":200,\"columns\":[\"num_queries\"]}")
  local p rc=0 name rows
  for p in "$@"; do
    name=$(grep -m1 -E "^$p" <<<"$services")
    rows=$(python -c 'import sys,json;d=json.load(sys.stdin);print(next((r.get("num_queries",0) for r in d.get("rows",[]) if r.get("dimension")==sys.argv[1]),0))' "$name" <<<"$report")
    echo "$p -> ${name:-MISSING} qan=$rows"
    [[ -n $name && $rows != 0 ]] || rc=1
  done
  return $rc
}

publish_branch() {
  local branch=$1 base=origin/main
  cd "$control" || exit 1
  git fetch -q origin
  git ls-remote --exit-code --heads origin "$branch" >/dev/null && base=origin/$branch
  local paths patch
  mapfile -t paths < <(git status --porcelain | cut -c4- | grep -v '^\.claude/')
  ((${#paths[@]})) || die "no migration changes in control"
  patch=$(mktemp)
  git add -N -- "${paths[@]}" && git diff HEAD --binary -M --output="$patch" -- "${paths[@]}" || exit 1
  git worktree add -q -B "$branch" "$publish" "$base" || exit 1
  git -C "$publish" apply --3way "$patch" || die "patch does not apply: cross-migration dependency"
  git -C "$publish" grep -qn '^<<<<<<< ' && die "conflict markers in $publish"
  (cd "$publish/e2e_tests" && npm ci --prefer-offline --no-audit --no-fund >/dev/null) || die "npm ci failed"
  echo "worktree $publish on $branch from $base; applied: ${paths[*]}"
}

selection() {
  [[ -d $publish ]] || die "no publish worktree"
  local base
  base=$(git -C "$publish" merge-base HEAD origin/main)
  [[ $(git -C "$publish" rev-parse --abbrev-ref '@{u}' 2>/dev/null) ]] && base=$(git -C "$publish" rev-parse '@{u}')
  rm -rf "$base_tree"; git -C "$control" worktree prune
  git -C "$control" worktree add -q --detach "$base_tree" "$base" || exit 1
  (cd "$base_tree/e2e_tests" && npm ci --prefer-offline --no-audit --no-fund >/dev/null) || die "npm ci failed in base tree"
  local out=$base_tree/sel
  mkdir -p "$out"
  { grep -rhoE "(tags_for_tests|pmm_test_flag): *['\"][^'\"]+['\"]" "$publish"/.github/workflows/*.yml |
      sed -E "s/^[^:]+: *['\"]//; s/['\"]$//"; printf '%s\n' '@gssapi-nightly' '@grafana-pr' "$@"; } | sort -u >"$out/exprs"
  list() {
    (cd "$1/e2e_tests" && PMM_MIGRATION=1 npx playwright test --list --grep "$2" 2>/dev/null) |
      grep '›' | sed -E 's/:[0-9]+:[0-9]+ / /' | sort
  }
  local i=0 expr
  while IFS= read -r expr; do
    i=$((i + 1))
    list "$base_tree" "$expr" >"$out/$i.before" &
    list "$publish" "$expr" >"$out/$i.after" &
    (( i % 3 )) || wait
  done <"$out/exprs"
  wait
  i=0
  while IFS= read -r expr; do
    i=$((i + 1))
    printf '%s\tbefore=%s after=%s added=%s removed=%s\n' "$expr" "$(grep -c . <"$out/$i.before")" "$(grep -c . <"$out/$i.after")" \
      "$(comm -13 "$out/$i.before" "$out/$i.after" | grep -c .)" "$(comm -23 "$out/$i.before" "$out/$i.after" | grep -c .)"
    comm -13 "$out/$i.before" "$out/$i.after" | sed 's/^/  + /'
    comm -23 "$out/$i.before" "$out/$i.after" | sed 's/^/  - /'
  done <"$out/exprs"
  local wf=$publish/.github/workflows/nightly-e2e-tests-matrix.yml
  echo "nightly shards: setup=$(grep -c 'shard_name:' "$wf") tagged=$(grep -cE "tags_for_tests: '[^']+'" "$wf") (lists in $out)"
}

revalidate() {
  cd "$publish" || exit 1
  local rc=0 f ts=()
  bash "$control/.claude/scripts/check-migration-conventions.sh" "$@" || rc=1
  for f in "$@"; do [[ $f == e2e_tests/*.ts ]] && ts+=("${f#e2e_tests/}"); done
  if ((${#ts[@]})); then
    (cd e2e_tests && npx eslint "${ts[@]}") || rc=1
  fi
  (cd e2e_tests && npx tsc --noEmit -p .) || rc=1
  python support_scripts/generate_readme.py --check || rc=1
  for f in "$@"; do
    [[ -f $control/$f ]] && cmp -s "$f" "$control/$f" && echo "tested copy: $f identical to control" || echo "tested copy: $f DIFFERS from control (rerun it)"
  done
  echo "revalidate rc=$rc"
  return $rc
}

publish_pr() {
  local title=$1 body=$2 flag=$3 setup=$4
  cd "$publish" || exit 1
  local branch pr run job
  branch=$(git branch --show-current)
  (($(wc -m <"$body") <= 1500 && $(wc -l <"$body") <= 25)) || die "PR body over 25 lines or 1500 chars"
  git push -q -u origin HEAD || die "push failed"
  pr=$(gh pr view "$branch" --repo "$repo" --json number -q .number 2>/dev/null)
  if [[ -n $pr ]]; then
    gh pr edit "$pr" --repo "$repo" --title "$title" --body-file "$body" >/dev/null || exit 1
  else
    gh pr create --repo "$repo" --base main --head "$branch" --title "$title" --body-file "$body" >/dev/null || exit 1
    pr=$(gh pr view "$branch" --repo "$repo" --json number -q .number)
  fi
  local since
  since=$(date -u +%FT%TZ)
  gh workflow run runner-e2e-tests-playwright.yml --repo "$repo" --ref "$branch" -f pmm_qa_branch="$branch" -f pmm_test_flag="$flag" \
    -f setup_services="$setup" -f pmm_server_version='perconalab/pmm-server:3-dev-latest' -f pmm_client_version='latest-tarball' || die "dispatch failed"
  for _ in $(seq 30); do
    run=$(gh run list --repo "$repo" --workflow runner-e2e-tests-playwright.yml --branch "$branch" --event workflow_dispatch --limit 1 \
      --json databaseId,createdAt -q ".[] | select(.createdAt >= \"$since\") | .databaseId")
    [[ -n $run ]] && job=$(gh run view "$run" --repo "$repo" --json jobs -q '.jobs[0].url') && [[ -n $job ]] && break
    sleep 10
  done
  [[ -n ${job:-} ]] || die "no job found for the dispatched run"
  sed -i -E "s#^\*\*Run:\*\*.*#**Run:** $job#" "$body"
  gh pr edit "$pr" --repo "$repo" --body-file "$body" >/dev/null
  gh pr comment "$pr" --repo "$repo" --body "GitHub Actions: $job" >/dev/null
  echo "PR https://github.com/$repo/pull/$pr"
  echo "job $job"
}

cmd=${1:-}
shift || true
case $cmd in
  preflight) preflight "$@" ;;
  mark) mark "$@" ;;
  env-check) env_check "$@" ;;
  publish-branch) publish_branch "$@" ;;
  selection) selection "$@" ;;
  revalidate) revalidate "$@" ;;
  publish) publish_pr "$@" ;;
  *) sed -n '2,12p' "$0"; exit 2 ;;
esac
