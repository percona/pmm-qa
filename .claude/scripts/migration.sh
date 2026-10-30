#!/usr/bin/env bash
# Mechanical steps of the CodeceptJS migration, so agents spend time only on judgement.
#
#   migration.sh preflight [--allow-unpushed] [--allow-open-pr <n>]   checks, main merge, drift, next pending row
#   migration.sh mark <row> <in-progress|done|retired> [pr-url]         tracker status, PR and Opened + dashboard data, one commit on control
#   migration.sh merged                                                 fill Merged for rows whose source left origin/main, one commit
#   migration.sh dashboard                                              rebuild migration/dashboard/migration.json, uncommitted
#   migration.sh set-setup <row> <setup-args>                           tracker Setup cell edit, uncommitted (mark commits it)
#   migration.sh setup <source-test>                                    Playwright job and databases per source scenario
#   migration.sh env-check <service-prefix>...                          creds, services, QAN rows per prefix (now-120m)
#   migration.sh publish-branch <branch>                                worktree from origin/<branch> or origin/main, apply control's changes, npm ci
#   migration.sh selection [extra-grep]...                              per-expression --list diff, base vs publish branch
#   migration.sh revalidate <file>...                                   conventions, eslint, tsc, README check, tested-copy check
#   migration.sh publish <title> <body-file> <flag> <setup-services>    push, open or edit PR, dispatch the Playwright runner, link the job
#
# Env: PMM_UI_URL, ADMIN_PASSWORD: the row's CHAOS VM, from `eval "$(chaos-pmm.sh env <run_id>)"`.
set -uo pipefail

control=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
publish=$(dirname "$control")/pmm-qa-publish
base_tree=$(dirname "$control")/pmm-qa-base
tracker=migration/tracker.md
dashboard_json=migration/dashboard/migration.json
url=${PMM_UI_URL:+${PMM_UI_URL%/}/}
pass=${ADMIN_PASSWORD:-}
repo=percona/pmm-qa

die() { echo "STOP: $*" >&2; exit 1; }

# One line per test job: grep expression, setup_services, file:job[:shard], framework (playwright|codeceptjs).
# The framework comes from the runner workflow a job calls, or a matrix entry's tests_framework.
ci_jobs() {
  python3 - "$1"/.github/workflows/*.yml <<'EOF'
import os, sys, yaml
for path in sys.argv[1:]:
    for name, job in ((yaml.safe_load(open(path, encoding='utf-8')) or {}).get('jobs') or {}).items():
        w = job.get('with') or {}
        where = f'{os.path.basename(path)}:{name}'
        uses = str(job.get('uses', ''))
        for fw in ('playwright', 'codeceptjs'):
            if f'runner-e2e-tests-{fw}' in uses:
                for k in ('pmm_test_flag', 'tags_for_tests'):
                    if w.get(k) and '${{' not in str(w[k]):
                        print(f"{w[k]}\t{w.get('setup_services', '-h')}\t{where}\t{fw}")
        matrix = (job.get('strategy') or {}).get('matrix')
        for e in (matrix.get('include') or []) if isinstance(matrix, dict) else []:
            if isinstance(e, dict) and e.get('tests_framework') in ('playwright', 'codeceptjs') and e.get('tags_for_tests'):
                print(f"{e['tags_for_tests']}\t{e.get('setup_services')}\t{where}:{e.get('shard_name')}\t{e['tests_framework']}")
EOF
}

# Setup from CI: each source scenario's tags pick the Playwright job that runs it, and that job's
# setup_services become the CHAOS VM's --database list. A job with its own setup is copied whole; on the shared
# nightly server only the shard argument for each engine the scenario names is taken (shortest variant).
# --args prints only the list, for `chaos-pmm.sh up <run_id> $(migration.sh setup --args <source>)`.
setup() {
  local only_args=''
  [[ ${1:-} == --args ]] && { only_args=1; shift; }
  local src=${1:-}
  [[ -f $control/$src ]] || die "no source $src"
  local jobs
  jobs=$(mktemp)
  ci_jobs "$control" >"$jobs" || exit 1
  python3 - "$control/$src" "$jobs" "$control/.github/workflows/nightly-e2e-tests-matrix.yml" "$only_args" <<'EOF'
import re, sys, yaml
src, jobs_file, nightly_file, only_args = sys.argv[1:]
code = '\n'.join(l for l in open(src, encoding='utf-8').read().splitlines() if not l.lstrip().startswith('//'))
jobs = [l.rstrip('\n').split('\t') for l in open(jobs_file, encoding='utf-8') if l.strip()]
split = lambda setup: [a.strip() for a in str(setup or '').split('--database')[1:] if a.strip()]
nightly = yaml.safe_load(open(nightly_file, encoding='utf-8'))
shard_args = sorted({a for j in nightly['jobs'].values()
                     for e in ((j.get('strategy') or {}).get('matrix') or {}).get('include', []) if isinstance(e, dict)
                     for a in split(e.get('setup_services'))}, key=len)
engines = {  # how a source names a service -> the pmm-framework database that creates it
    'pxc': r'pxc', 'psmdb': r'psmdb|mongo|\brs[12]0\d', 'pdpgsql': r'pdpgsql', 'pgsql': r'(?<!pd)pgsql',
    'mysql': r'mysql_pmm|mysql-dev', 'ps': r'ps_pmm|name=ps\b|ps-dev', 'valkey': r'valkey|redis',
    'haproxy': r'haproxy', 'external': r'external',
}
engine = lambda arg: re.split('[,=]', arg, maxsplit=1)[0]
# A PS/MySQL environment or cluster label pins the topology: ps-dev/ps-single-dev-cluster is SETUP_TYPE unset, ps-gr-dev is gr.
topology = lambda arg: (re.search(r'SETUP_TYPE=(\w+)', arg) or [None, ''])[1]
labels = {e: {t or '' for t in re.findall(rf'\b{e}-(?:(gr|replication)-)?(?:single-)?dev\b', code)} for e in ('ps', 'mysql')}
starts = [m.start() for m in re.finditer(r'Scenario(?:\.skip)?\(', code)]
hooks = code[:starts[0]] if starts else code
dedicated, nightly_engines, notes = [], [], []
for i, at in enumerate(starts):
    body = hooks + code[at:starts[i + 1] if i + 1 < len(starts) else len(code)]
    m = re.match(r"Scenario(?:\.skip)?\(\s*(['\"`])(.+?)\1", code[at:], re.S)
    title = m.group(2) if m else '?'
    match = lambda fw, t: [j for j in jobs if j[3] == fw and re.search(j[0], t)]
    hits, via = match('playwright', title), ''
    if not hits and '@fb-' in title:
        hits, via = match('playwright', title.replace('@fb-', '@')), ' (after retag @fb- -> @)'
    if not hits:
        hits, via = match('codeceptjs', title), ' (CodeceptJS job today; the Playwright side needs this tag)'
    named = [e for e, rx in engines.items() if re.search(rx, body)]
    notes.append(f'{title}\n  services named: {" ".join(named) or "none"}')
    if not hits:
        notes.append('  NO job selects it (Jenkins or no consumer): set up from the services named')
        nightly_engines += named
    # Several jobs selecting one scenario are variants of one environment (OS, GSSAPI): provision one,
    # a dedicated job before the shared nightly server, the smallest setup first.
    hits.sort(key=lambda j: (j[2].startswith('nightly-e2e-tests-matrix'), len(j[1])))
    for expr, setup, where, _ in hits[1:]:
        notes.append(f'  also {where} ({expr}): {setup}')
    for expr, setup, where, _ in hits[:1]:
        notes.append(f'  using {where} ({expr}){via}: {setup}')
        if where.startswith('nightly-e2e-tests-matrix'):
            nightly_engines += named
        else:
            dedicated += split(setup)
local = list(dict.fromkeys(dedicated))
for e in dict.fromkeys(nightly_engines):
    if all(engine(a) != e for a in local):
        args = [a for a in shard_args if engine(a) == e]
        pinned = [next(a for a in args if topology(a) == t) for t in sorted(labels.get(e, ())) if any(topology(a) == t for a in args)]
        local += pinned or args[:1]
line = ' '.join(f'--database {a}' for a in local)
if only_args:
    print(line)
else:
    print('\n'.join(notes))
    print(f'nightly shard arguments: {" | ".join(shard_args)}')
    print(f'vm: {line or "(server only)"}')
EOF
}

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
  merged
  local missing
  missing=$(grep -E '^\| [0-9]+ +\| (done|retired) ' "$tracker" | awk -F'|' '$10 ~ /^ *$/ || $11 ~ /^ *$/ {print $2}' | xargs)
  [[ -z $missing ]] || echo "WARN: done/retired rows without PR or Opened: $missing; report them, never invent the values"
  echo "next: $(grep -m1 -E '^\| [0-9]+ +\| pending' "$tracker")"
}

# Tracker columns: | # | Status | Bucket | Env | Setup | Source | Target | Tags | PR | Opened | Merged | Notes |
# split('|') puts them at 1..12. `done` and `retired` need the PR that retires the source: its number goes in
# PR and today's date in Opened; Merged is filled by `merged` once the source has left origin/main.
mark() {
  local row=$1 status=$2 pr=${3:-}
  [[ $status != "done" && $status != "retired" ]] || [[ $pr =~ /pull/[0-9]+ ]] || die "mark $row $status needs the PR url"
  cd "$control" || exit 1
  python3 - "$tracker" "$row" "$status" "$pr" <<'EOF' || exit 1
import datetime, re, sys
path, row, status, pr = sys.argv[1:]
lines = open(path, 'rb').read().split(b'\n')
hits = [i for i, l in enumerate(lines) if re.match(rb'^\| %s +\|' % row.encode(), l)]
assert len(hits) == 1, f'row {row}: {len(hits)} matches'
cells = lines[hits[0]].split(b'|')
assert len(cells) == 14, f'row {row}: {len(cells) - 2} columns, expected 12'
put = lambda i, v: cells.__setitem__(i, b' ' + v.encode().ljust(len(cells[i]) - 2) + b' ')
put(2, status)
if pr:
    n = '#' + re.search(r'/pull/(\d+)', pr).group(1)
    prs = cells[9].decode().split()
    put(9, ' '.join(prs + [n] if n not in prs else prs))
    if not cells[10].strip():
        put(10, datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d'))
lines[hits[0]] = b'|'.join(cells)
open(path, 'wb').write(b'\n'.join(lines))
EOF
  [[ $(git diff --numstat -- "$tracker" | cut -f1,2) == $'1\t1' ]] || die "tracker diff is not one line"
  git add -- "$tracker" || exit 1
  if [[ $status == "done" || $status == "retired" ]]; then
    dashboard && git add -- "$dashboard_json" || die "dashboard rebuild failed"
  fi
  local name
  name=$(grep -E "^\| $row +\|" "$tracker" | grep -oE 'tests/[A-Za-z0-9_/.-]+_test\.js' | head -1 | xargs basename | sed 's/\.js$//')
  git commit -q -m "chore(migration): mark $name ${status/-/ }" && git log --oneline -1
}

# Merged is the date the source left origin/main: the commit that retired it is the squash-merge of its PR.
merged() {
  cd "$control" || exit 1
  python3 - "$tracker" <<'EOF' || exit 1
import re, subprocess, sys
path = sys.argv[1]
lines = open(path, 'rb').read().split(b'\n')
for i, l in enumerate(lines):
    if not re.match(rb'^\| \d+ +\|', l):
        continue
    cells = l.split(b'|')
    if not cells[9].strip() or cells[11].strip():
        continue
    src = cells[6].strip().strip(b'`').decode()
    if subprocess.run(['git', 'cat-file', '-e', f'origin/main:{src}'], capture_output=True, check=False).returncode == 0:
        continue
    date = subprocess.run(['git', 'log', 'origin/main', '--no-renames', '--diff-filter=D', '-1', '--format=%cs', '--', src],
                          capture_output=True, text=True, check=False).stdout.strip()
    if date:
        cells[11] = b' ' + date.encode().ljust(len(cells[11]) - 2) + b' '
        lines[i] = b'|'.join(cells)
open(path, 'wb').write(b'\n'.join(lines))
EOF
  git diff --quiet -- "$tracker" && return 0
  dashboard && git add -- "$tracker" "$dashboard_json" || die "dashboard rebuild failed"
  git commit -q -m "chore(migration): record merge dates" && git log --oneline -1
}

# Data for the gh-pages Migration tab, which reads it from this branch. Control carries main's workflows and
# CodeceptJS sources after the preflight merge; Playwright counts need e2e_tests/node_modules, else the last ones stay.
dashboard() {
  local pw=()
  [[ -d $control/e2e_tests/node_modules ]] && pw=(--pw-list)
  python3 "$control/migration/dashboard/build.py" --main "$control" --out "$control/$dashboard_json" "${pw[@]}"
}

set_setup() {
  local row=$1 setup=$2
  cd "$control" || exit 1
  python3 - "$tracker" "$row" "$setup" <<'EOF' || exit 1
import re, sys
path, row, setup = sys.argv[1:]
lines = open(path, 'rb').read().split(b'\n')
hits = [i for i, l in enumerate(lines) if re.match(rb'^\| %s +\|' % row.encode(), l)]
assert len(hits) == 1, f'row {row}: {len(hits)} matches'
cells = lines[hits[0]].split(b'|')
cells[5] = b' ' + ('`%s`' % setup).encode().ljust(len(cells[5]) - 2) + b' '
lines[hits[0]] = b'|'.join(cells)
open(path, 'wb').write(b'\n'.join(lines))
EOF
  grep -E "^\| $row +\|" "$tracker"
}

env_check() {
  [[ -n $url && -n $pass ]] || die 'PMM_UI_URL/ADMIN_PASSWORD unset: eval "$(chaos-pmm.sh env <run_id>)"'
  curl -sk -o /dev/null -w '%{http_code}' -u "admin:$pass" "${url}v1/users/me" | grep -q 200 || die "/v1/users/me not 200 (wrong password?)"
  local from to report services
  from=$(date -u -d '-120 min' +%FT%TZ)
  to=$(date -u +%FT%TZ)
  services=$(curl -sk -u "admin:$pass" "${url}v1/inventory/services" | python3 -c 'import sys,json;[print(s["service_name"]) for v in json.load(sys.stdin).values() for s in v]')
  report=$(curl -sk -u "admin:$pass" -X POST "${url}v1/qan/metrics:getReport" \
    -d "{\"period_start_from\":\"$from\",\"period_start_to\":\"$to\",\"group_by\":\"service_name\",\"limit\":200,\"columns\":[\"num_queries\"]}")
  local p rc=0 name rows
  for p in "$@"; do
    name=$(grep -m1 -E "^$p" <<<"$services")
    rows=$(python3 -c 'import sys,json;d=json.load(sys.stdin);print(next((r.get("num_queries",0) for r in d.get("rows",[]) if r.get("dimension")==sys.argv[1]),0))' "$name" <<<"$report")
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
  mapfile -t paths < <(git status --porcelain --no-renames | cut -c4- | grep -v '^\.claude/')
  ((${#paths[@]})) || die "no migration changes in control"
  patch=$(mktemp)
  git add -N -- "${paths[@]}" && git diff HEAD --binary -M --output="$patch" -- "${paths[@]}" || exit 1
  if git rev-parse -q --verify "refs/heads/$branch" >/dev/null; then
    [[ $(git rev-parse "$branch") == $(git rev-parse "$base") ]] || die "local $branch differs from $base; reconcile it first"
    git worktree add -q "$publish" "$branch" || exit 1
  else
    git worktree add -q -b "$branch" "$publish" "$base" || exit 1
  fi
  git -C "$publish" apply --3way "$patch" || die "patch does not apply: cross-migration dependency"
  git -C "$publish" grep -qn '^<<<<<<< ' && die "conflict markers in $publish"
  (cd "$publish/e2e_tests" && npm ci --prefer-offline --no-audit --no-fund >/dev/null) || die "npm ci failed"
  echo "worktree $publish on $branch from $base; applied: ${paths[*]}"
}

selection() {
  [[ -d $publish ]] || die "no publish worktree"
  local base out=$control/.migration-observations/selection
  base=$(git -C "$publish" merge-base HEAD origin/main)
  [[ $(git -C "$publish" rev-parse --abbrev-ref '@{u}' 2>/dev/null) ]] && base=$(git -C "$publish" rev-parse '@{u}')
  rm -rf "$out" && mkdir -p "$out"
  { ci_jobs "$publish" | awk -F'\t' '$4 == "playwright" { print $1 }'
    printf '%s\n' '@gssapi-nightly' '@grafana-pr' "$@"; } | sort -u >"$out/exprs"
  # Only added test files, no workflow or config change: "before" is "after" without the added files,
  # so the base tree and its npm ci are skipped.
  local changes added=()
  changes=$(git -C "$publish" diff --name-status --no-renames "$base" HEAD -- e2e_tests/tests .github/workflows e2e_tests/playwright.config.ts)
  if [[ -n $changes ]] && ! grep -qv '^A' <<<"$changes"; then
    mapfile -t added < <(cut -f2 <<<"$changes" | sed 's#^e2e_tests/tests/##')
    echo "only added test files (${added[*]}): before = after without them"
  else
    rm -rf "$base_tree"; git -C "$control" worktree prune
    git -C "$control" worktree add -q --detach "$base_tree" "$base" || exit 1
    (cd "$base_tree/e2e_tests" && npm ci --prefer-offline --no-audit --no-fund >/dev/null) || die "npm ci failed in base tree"
  fi
  list() {
    (cd "$1/e2e_tests" && PMM_MIGRATION=1 npx playwright test --list --grep "$2" 2>/dev/null) |
      grep '›' | sed -E 's/:[0-9]+:[0-9]+ / /' | tr "\\\\" / | sort
  }
  local i=0 expr f
  while IFS= read -r expr; do
    i=$((i + 1))
    [[ ${#added[@]} -gt 0 ]] || list "$base_tree" "$expr" >"$out/$i.before" &
    list "$publish" "$expr" >"$out/$i.after" &
    (( i % 3 )) || wait
  done <"$out/exprs"
  wait
  if ((${#added[@]})); then
    for f in "$out"/*.after; do
      grep -vF -f <(printf '› %s ›\n' "${added[@]}") "$f" >"${f%.after}.before"
    done
  fi
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
  [[ -d $base_tree ]] && git -C "$control" worktree remove --force "$base_tree"
  return 0
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
  python3 support_scripts/generate_readme.py --check || rc=1
  for f in "$@"; do
    [[ $f == e2e_tests/* ]] || continue
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
  echo "PR https://github.com/$repo/pull/$pr"
  echo "job $job"
}

cmd=${1:-}
shift || true
case $cmd in
  preflight) preflight "$@" ;;
  mark) mark "$@" ;;
  merged) merged ;;
  dashboard) dashboard ;;
  set-setup) set_setup "$@" ;;
  setup) setup "$@" ;;
  env-check) env_check "$@" ;;
  publish-branch) publish_branch "$@" ;;
  selection) selection "$@" ;;
  revalidate) revalidate "$@" ;;
  publish) publish_pr "$@" ;;
  *) sed -n '2,13p' "$0"; exit 2 ;;
esac
