# Verification recipes for pmm-framework

Ready-to-run checks, anchored to `qa-integration/pmm_qa/pmm-framework`. Run
everything from that directory unless noted. Each recipe is chosen because it
*fails* when the claim is false — a check that would pass either way isn't
verification.

Every recipe starts from a scratch dir and creates it:

```bash
SCRATCH=${TMPDIR:-/tmp}/pmm-framework-verify && mkdir -p "$SCRATCH"
```

**Confirm each recipe saw real input before believing its verdict.** The
recipes below that read a file or a directory print a count and abort at zero,
because the failure mode that bit this file was a wrong relative path producing
an empty input set and a silent all-clear.

## Contents

- [Comments or docs only pass](#comments-or-docs-only-pass)
- [Refactoring the config catalogue](#refactoring-the-config-catalogue)
- [Changing a setup function env map](#changing-a-setup-function-env-map)
- [CLI surface and exit codes](#cli-surface-and-exit-codes)
- [Preflight conflict outcomes](#preflight-conflict-outcomes)
- [Mutation testing](#mutation-testing)
- [Driving parallel mode under a real pty](#driving-parallel-mode-under-a-real-pty)
- [Exercising real caller inputs from CI workflows](#exercising-real-caller-inputs-from-ci-workflows)

---

## Comments or docs only pass

The claim: executable content in `lib/*.sh` / `setups/*.sh` / `pmm-framework`
is byte-for-byte unchanged. Strip comments and blank lines from both sides and
diff what remains — don't eyeball a diff full of `#` noise.

```bash
strip() { grep -vE '^\s*#|^\s*$' | sed -E 's/[[:space:]]+#.*$//' | sed -E 's/[[:space:]]+$//'; }

for f in pmm-framework lib/*.sh setups/*.sh; do
  a=$(git show "HEAD:qa-integration/pmm_qa/pmm-framework/$f" | strip)
  b=$(strip < "$f")
  [[ $a == "$b" ]] && printf '  %-24s ok\n' "$f" || { printf '  %-24s CHANGED\n' "$f"; diff <(echo "$a") <(echo "$b"); }
done
```

Two gotchas:

- the trailing-comment strip also eats a `#` inside a string literal (rare in
  this codebase, but check the diff, don't just trust the verdict)
- a comment containing a quote can dodge the strip on some lines — simplify the
  comment rather than complicating the checker

## Refactoring the config catalogue

The claim: every type's versions, `DEFAULT_VERSION`, and option defaults in
`lib/config.sh` resolve identically after the refactor. Don't eyeball the
`register_database` calls — enumerate the resolved state from both versions.

```bash
SCRATCH=${TMPDIR:-/tmp}/pmm-framework-verify && mkdir -p "$SCRATCH/base"
git show HEAD:qa-integration/pmm_qa/pmm-framework/lib/common.sh > "$SCRATCH/base/common.sh"
git show HEAD:qa-integration/pmm_qa/pmm-framework/lib/config.sh > "$SCRATCH/base/config.sh"

cat > "$SCRATCH/dump_catalogue.sh" <<'SCRIPT'
#!/usr/bin/env bash
source "$1/common.sh"; source "$1/config.sh"
for t in $(printf '%s\n' "${!DB_OPTIONS[@]}" | sort); do
  printf '%s|versions=%s|default=%s\n' "$t" "${DB_VERSIONS[$t]}" "$(database_default_version "$t")"
  for k in ${DB_OPTIONS[$t]}; do printf '    %s=%s\n' "$k" "$(database_default_value "$t" "$k")"; done
done
SCRIPT
chmod +x "$SCRATCH/dump_catalogue.sh"

diff <("$SCRATCH/dump_catalogue.sh" "$SCRATCH/base") \
     <("$SCRATCH/dump_catalogue.sh" lib) && echo "catalogue identical"
```

`config.sh` runs its `DEFAULT_VERSION` validation loop at source time and calls
`die`, so `common.sh` must be sourced first — a registration bug surfaces here
as an abort, which is the point.

This is exactly the check that would catch reordering `PGSQL`'s version list
(`'11 12 13 14 15 16 17 18'`) — `database_default_version` reads
`DB_DEFAULT_VERSIONS[TYPE]`, not "the last element," but a future refactor that
accidentally reintroduces order-dependence would slip past a visual diff.

## Changing a setup function env map

The claim: `setup_<name>`'s env map still matches what its playbook actually
reads. Extract both sides mechanically — a key typo or a dropped entry is
invisible in a manual read of a 15-line `declare -A`.

```bash
SCRATCH=${TMPDIR:-/tmp}/pmm-framework-verify && mkdir -p "$SCRATCH"
fn=setup_pdpgsql; file=setups/postgresql.sh          # adjust these two

(                                    # subshell, so the aborts below can be real
set -uo pipefail
awk -v f="^$fn\\\\(\\\\)" '$0 ~ f,/^}/' "$file" \
  | grep -oE '\[[A-Z_]+\]' | tr -d '[]' | sort -u > "$SCRATCH/sent.txt"

# Get the playbook path from the run_playbook call itself rather than assuming
# a directory. Match on '*.yml' because the call can span lines.
playbook=$(awk -v f="^$fn\\\\(\\\\)" '$0 ~ f,/^}/' "$file" \
  | grep -oE "'[^']+\.yml'" | tr -d "'" | head -1)
[[ -n $playbook ]] || { echo "ABORT: no playbook found in $fn"; exit 1; }
playbook_path="../$playbook"                         # PMM_QA_ROOT is one level up
[[ -f $playbook_path ]] || { echo "ABORT: $playbook_path does not exist"; exit 1; }

# That playbook and the task files it includes -- never its directory.
pbdir=$(dirname "$playbook_path")
scan=("$playbook_path")
while IFS= read -r inc; do
  [[ -f $pbdir/$inc ]] && scan+=("$pbdir/$inc")
done < <(grep -ohE 'include_tasks:[[:space:]]*\S+' "$playbook_path" \
           | awk '{print $NF}' | tr -d "'\"")
printf 'scanning %d file(s):\n' "${#scan[@]}"; printf '  %s\n' "${scan[@]}"

grep -ohE "lookup\('env', *'[A-Z_]+'" "${scan[@]}" \
  | grep -oE "'[A-Z_]+'" | tr -d "'" | sort -u > "$SCRATCH/read.txt"
printf 'sent=%s read=%s\n' "$(wc -l < "$SCRATCH/sent.txt")" "$(wc -l < "$SCRATCH/read.txt")"
(( $(wc -l < "$SCRATCH/read.txt") > 0 )) || { echo "ABORT: no env lookups found"; exit 1; }

echo "--- sent but never read ---"; comm -23 "$SCRATCH/sent.txt" "$SCRATCH/read.txt"
echo "--- read but never sent (playbook falls back to its own default) ---"
comm -13 "$SCRATCH/sent.txt" "$SCRATCH/read.txt"
)
```

Read the two halves differently:

- **read-but-not-sent** is usually fine — the playbook has a `| default(...)`
  and the framework is deliberately not overriding it. Confirm the default is
  what you want; don't add the key reflexively.
- **sent-but-not-read** deserves more suspicion. (`setup_pdpgsql` sends
  `DISTRIBUTION`, `PDPGSQL_PGSM_PORT`, `PGSTAT_MONITOR_BRANCH`,
  `PMM_QA_GIT_BRANCH`, `PDPGSQL_PGSM_CONTAINER` and `USE_SOCKET`, none of which
  the playbook it calls reads. They used to be read by `pdpgsql_pgsm_setup.yml`
  at the `pmm_qa/` root, which nothing dispatched to and which has since been
  deleted, so today they are sent and consumed by nothing at all. Worth a
  second look, not something to silently delete.)

Scope the scan to the playbook and its includes, never to the directory holding
it. Most of these playbooks sit at the `pmm_qa/` root beside ten unrelated ones,
so a directory scan collects ~60 keys instead of the handful the playbook really
reads, the sent-but-not-read list comes back empty, and a key nothing consumes
looks consumed — `setup_haproxy` hides `CLIENT_DEBUG` exactly that way.
`setup_pdpgsql` is the example that makes a directory scan look sound: it is the
one playbook with a private directory of its own, so both scopes agree on it.

## CLI surface and exit codes

The claim: `--help`, flag parsing, or exit codes are unchanged for the same
input. Compare against a **git worktree** of `HEAD`, not a copy of the
`pmm-framework` script — the entrypoint resolves `lib/` and `setups/` from
`${BASH_SOURCE[0]}`, so an isolated copy sources nothing and reports a false
mismatch unrelated to your change.

```bash
W=${TMPDIR:-/tmp}/pmm-framework-old
git worktree add -q --detach "$W" HEAD
OLD="$W/qa-integration/pmm_qa/pmm-framework/pmm-framework"
NEW="$PWD/pmm-framework"     # run from pmm-framework/

for args in '--help' '-h' '' '--bogus' '--database ps=8.4'; do
  "$OLD" $args >/dev/null 2>&1; old=$?
  "$NEW" $args >/dev/null 2>&1; new=$?
  printf '  args=%-24s old=%d new=%d %s\n' "${args:-<none>}" "$old" "$new" \
    "$([[ $old == "$new" ]] && echo ok || echo MISMATCH)"
done
diff <("$OLD" --help) <("$NEW" --help)

git worktree remove --force "$W"
```

If the `--help` diff comes back empty when you expected a difference, check that
`HEAD` is where you think it is — a commit made mid-session moves the baseline
out from under this check.

## Preflight conflict outcomes

The claim: `preflight_database_setups` still sorts every `--database`
combination into the right bucket. It has **three** outcomes, and a check that
greps only for the sequential warning scores a hard refusal as "parallel" and
reports a pass:

| Outcome | Signal on stderr |
|---|---|
| refused (`die`) | `ERROR: ... cannot share a host` |
| demoted to sequential | `WARNING: Running setups sequentially` |
| parallel | neither |

ARCHITECTURE.md §3 is the authority on which pairs fall where; this recipe
checks the code against it. Stub the side effects preflight performs *after*
the conflict decision, or it will try to reach a real PMM Server.

`PARALLEL` is the one bucket inferred from the *absence* of a message, so a
harness that fails to source, parse or stub falls into it and scores a pass on
the three rows that expect it. Check the exit status before that fallthrough.

```bash
SCRATCH=${TMPDIR:-/tmp}/pmm-framework-verify && mkdir -p "$SCRATCH"
cat > "$SCRATCH/conflictcheck.sh" <<'SCRIPT'
#!/usr/bin/env bash
set -uo pipefail
FW=$1
export FRAMEWORK_DIR=$FW PMM_QA_ROOT=$FW/.. QA_INTEGRATION_ROOT=$FW/../..
for m in lib/common lib/config lib/cli lib/docker lib/ansible lib/runners \
         setups/mysql setups/postgresql setups/mongodb setups/services \
         setups/dispatch lib/execution; do source "$FW/$m.sh"; done
resolve_pmm_server() { :; }; require_command() { :; }
ensure_docker_collection() { :; }; configure_ansible_python() { :; }

pass=0; fail=0
check() {
  local expect=$1; shift
  local out got rc
  out=$( ( parse_args "$@"; preflight_database_setups ) 2>&1 ); rc=$?
  if grep -q 'cannot share a host' <<<"$out"; then got=REFUSED
  elif grep -q 'Running setups sequentially' <<<"$out"; then got=SEQUENTIAL
  elif (( rc != 0 )); then got="ERROR(rc=$rc)"; printf '%s\n' "$out" | tail -5
  else got=PARALLEL; fi
  if [[ $got == "$expect" ]]; then ((pass++)); printf '  ok    %-10s %s\n' "$got" "$*"
  else ((fail++)); printf '  FAIL  expected=%s got=%s :: %s\n' "$expect" "$got" "$*"; fi
}

check REFUSED    --parallel --database psmdb,SETUP_TYPE=pss --database psmdb,SETUP_TYPE=sharding
check REFUSED    --parallel --database psmdb --database psmdb
check REFUSED    --parallel --database external --database valkey
check REFUSED    --database external --database valkey        # refused with or without --parallel
check SEQUENTIAL --parallel --database ps --database ps
check SEQUENTIAL --parallel --database ps --database mysql
check SEQUENTIAL --parallel --database pdpgsql --database pgsql,SETUP_TYPE=replication
check SEQUENTIAL --parallel --database ssl_psmdb --database ssl_psmdb
check PARALLEL   --parallel --database psmdb --database ssl_psmdb
check PARALLEL   --parallel --database pdpgsql --database pgsql
check PARALLEL   --parallel --database valkey=8 --database pgsql=16

printf '\n%d passed, %d failed\n' "$pass" "$fail"; (( fail == 0 ))
SCRIPT
chmod +x "$SCRATCH/conflictcheck.sh"
"$SCRATCH/conflictcheck.sh" "$PWD"
```

Cover **all three** outcomes whenever you touch the conflict logic. A one-sided
check passes while you silently serialize all of CI, or while a pair that can
never share a host is waved through to fail later inside Docker. Order matters
too — a pair must be caught whichever spec comes first, which is why the
`EXTERNAL`/`VALKEY` case appears in both directions above.

## Mutation testing

The claim: the bats suite actually covers the bug you fixed, not just that it
passes. Break the fix again and confirm the *specific* tests fail.

Restore through a `trap`, not a trailing `cp` — `grep` exits non-zero when it
matches nothing, so a `set -e` shell aborts before the restore line and leaves
the tracked file mutated.

```bash
SCRATCH=${TMPDIR:-/tmp}/pmm-framework-verify && mkdir -p "$SCRATCH"
cp lib/execution.sh "$SCRATCH/execution.ok"
trap 'cp "$SCRATCH/execution.ok" lib/execution.sh; echo restored' EXIT

perl -0pi -e 's/<the fixed condition>/<the condition before your fix>/s' lib/execution.sh
git diff --stat lib/execution.sh          # confirm the mutation actually applied

out=$(bats tests 2>&1); rc=$?
if grep -qE '^not ok' <<<"$out"; then
  grep -E '^not ok' <<<"$out"
elif (( rc != 0 )); then
  echo "BATS ERRORED (rc=$rc) -- the suite never ran; this says nothing about coverage"
  tail -20 <<<"$out"
else
  echo "NOTHING FAILED -- test does not cover the fix"
fi
```

Three failure shapes to watch for:

- **nothing fails** — the test you added doesn't exercise the fix; strengthen
  the assertion
- **`bats` itself errors** — likely here, because the mutation edits a sourced
  file and can leave it unparseable. There is no `not ok` line then, so piping
  straight into `grep` reports "nothing failed" and sends you off strengthening
  a test that was fine. Capture the status, don't read it through the pipe.
- **unrelated tests fail too** — the mutation (or the fix) is broader than
  intended. This caught the parallel-log regression, where reverting the
  `should_dump_successful_logs` gate failed `cli.bats` and `integration.bats`
  cases unrelated to the change, a sign the boundary between "log on failure"
  and "log on `--verbose`" wasn't as clean as it looked.

Finish with `git status --short qa-integration/` to confirm nothing stayed
mutated.

## Driving parallel mode under a real pty

`bats` stdout is always a pipe, so it can never observe `[[ -t 1 ]]` branches,
terminal signal delivery, or job-control (`set -m`) effects — exactly where
`run_parallel_setups` lives. This is the only way to catch a `SIGTTIN` hang
before it ships.

```python
import os, pty, select, signal, subprocess, time

S = "/path/to/stub/bin"
os.environ["PATH"] = S + ":" + os.environ["PATH"]   # BEFORE the fork, not after
ARGV = ["./pmm-framework", "--parallel", "--pmm-server-ip", "1.2.3.4",
        "--database", "valkey=8", "--database", "pgsql=16"]

pid, fd = pty.fork()          # fork, not pty.spawn -- spawn never hands back a pid
if pid == 0:
    os.execv(ARGV[0], ARGV)

def stopped_in_group(pgid):   # pty.fork() child is a session leader, so pgid == pid
    ps = subprocess.run(["ps", "-eo", "pid=,pgid=,stat="],
                        capture_output=True, text=True).stdout
    return [ln.strip() for ln in ps.splitlines()
            if (f := ln.split()) and len(f) >= 3 and f[1] == str(pgid)
            and f[2][0] in "Tt"]

out, stopped, deadline = [], [], time.time() + 300
while time.time() < deadline:
    if select.select([fd], [], [], 0.5)[0]:
        try:
            data = os.read(fd, 4096)
        except OSError:       # EIO: the child is gone
            break
        if not data:
            break
        out.append(data)
    stopped += stopped_in_group(pid)
else:
    print("TIMED OUT", flush=True)
    os.killpg(pid, signal.SIGKILL)

_, status = os.waitpid(pid, 0)
print(b"".join(out).decode(errors="replace"), flush=True)
print("stopped (T/t):", sorted(set(stopped)) or "none", flush=True)
print("exit:", os.waitstatus_to_exitcode(status), flush=True)   # negative == signal
```

Read the verdict off all three prints together: a non-empty `stopped` list is the
`SIGTTIN` hang, `TIMED OUT` with an empty one is some other stall, and a clean
run has to show the expected completion output *and* a zero exit. Poll `ps` for
the state — the framework's own stdout never contains process state, so a check
that greps the captured text for it can only ever report zero.

Stub `docker`, `ansible-playbook`, `ansible-galaxy` and `curl` under `S` before
running this — `tests/integration.bats` already has the exact stub shapes this
repo uses (it fakes `docker ps`, records calls, and can be told to fail or sleep
via env vars).

To simulate Ctrl-C accurately without a pty, put the child in its own session
and signal the whole group — that's what a terminal does, and it's what
confirmed the process-group kill fix works:

```python
import os, signal, time
pid = os.fork()
if pid == 0:
    os.setsid()
    os.execv("./pmm-framework", ["./pmm-framework", "--parallel",
                                 "--pmm-server-ip", "1.2.3.4", "--database", "valkey=8"])
time.sleep(3)
os.killpg(pid, signal.SIGINT)          # exactly what Ctrl-C delivers
w, status = os.waitpid(pid, 0)
print("exit:", os.WEXITSTATUS(status) if os.WIFEXITED(status) else f"signal {os.WTERMSIG(status)}", flush=True)
```

Then check nothing leaked: `pgrep -f ansible-playbook` should come back empty.

Always `print(..., flush=True)` (or redirect to a file) in these harnesses — a
timeout that kills the process discards buffered diagnostics and makes a working
script look hung.

## Exercising real caller inputs from CI workflows

Every `--database ...` shape CI actually runs lives in `.github/workflows/*.yml`
as `services_list:` / `setup_services:` strings. When changing argument parsing,
the catalogue, or a flag, run every real shape through the parser — don't invent
inputs. (CI is not the only caller — `percona/pmm`'s dev docs and manual runs
use shapes of their own — but it is the set that breaks the build.)

The workflows directory is **three** levels up from `pmm-framework/`
(`pmm-framework` → `pmm_qa` → `qa-integration` → repo root). Get that wrong and
`grep` writes a warning to stderr, the shapes file lands empty, and the checker
reports nothing at all — which reads exactly like "everything passed."

```bash
SCRATCH=${TMPDIR:-/tmp}/pmm-framework-verify && mkdir -p "$SCRATCH"

grep -rhE "^[[:space:]]*(services_list|setup_services):[[:space:]]*'" ../../../.github/workflows/ \
  | sed -E "s/^[^']*'//; s/'[[:space:]]*\$//" | sort -u > "$SCRATCH/shapes.txt"
n=$(wc -l < "$SCRATCH/shapes.txt"); echo "shapes found: $n"
(( n > 0 )) || echo "ABORT: wrong path or grep pattern -- do not trust a pass from here"
```

The `^[[:space:]]*` anchor drops entries commented out in the workflow
(`#      setup_services: ...`); those aren't live callers and a "failure" there
is noise.

Don't calibrate against a frozen number — the matrix is regrouped periodically
(a4d8fe77 merged fourteen nightly shards into five and moved the count from 63
to 59 in a single commit). Expect *dozens*: a single-digit or zero result means
the pattern or the path has drifted, not that the matrix shrank.

```bash
cat > "$SCRATCH/parsecheck.sh" <<'SCRIPT'
#!/usr/bin/env bash
set -uo pipefail
FRAMEWORK_DIR=$1
source "$FRAMEWORK_DIR/lib/common.sh"
source "$FRAMEWORK_DIR/lib/config.sh"
source "$FRAMEWORK_DIR/lib/cli.sh"
checked=0
while IFS= read -r shape; do
  [[ -z ${shape// } ]] && continue
  ((checked++))
  # read -ra, not eval: these strings come from the branch under review, and
  # eval would run any shell syntax a workflow value happens to contain (it
  # would glob a bare '*' against cwd, too).
  read -ra args <<<"$shape"
  if ( parse_args "${args[@]}" ) >/dev/null 2>&1; then
    printf '  ok   %s\n' "$shape"
  else
    printf '  FAIL %s\n' "$shape"
  fi
done
printf '%d shapes checked\n' "$checked"
(( checked > 0 )) || { echo "ABORT: no shapes read"; exit 1; }
SCRIPT
chmod +x "$SCRATCH/parsecheck.sh"
"$SCRATCH/parsecheck.sh" "$PWD" < "$SCRATCH/shapes.txt"
```

Put the checker in a **file with a bash shebang**, not an inline subshell
sourced from your interactive prompt — a login shell may be zsh, and sourcing
this repo's associative-array/nameref syntax into zsh fails with
`bad substitution`, a harness error that reads exactly like a script bug.

Any failures are either real incompatibilities or dead config — both worth
knowing before a push.
