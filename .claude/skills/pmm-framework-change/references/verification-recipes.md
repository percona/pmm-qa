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

awk -v f="^$fn\\\\(\\\\)" '$0 ~ f,/^}/' "$file" \
  | grep -oE '\[[A-Z_]+\]' | tr -d '[]' | sort -u > "$SCRATCH/sent.txt"

# Get the playbook path from the run_playbook call itself rather than assuming
# a directory. Match on '*.yml' because the call can span lines.
playbook=$(awk -v f="^$fn\\\\(\\\\)" '$0 ~ f,/^}/' "$file" \
  | grep -oE "'[^']+\.yml'" | tr -d "'" | head -1)
[[ -n $playbook ]] || { echo "ABORT: no playbook found in $fn"; }
playbook_dir=$(dirname "../$playbook")               # PMM_QA_ROOT is one level up
[[ -d $playbook_dir ]] || { echo "ABORT: $playbook_dir does not exist"; }

grep -rohE "lookup\('env', *'[A-Z_]+'" "$playbook_dir" \
  | grep -oE "'[A-Z_]+'" | tr -d "'" | sort -u > "$SCRATCH/read.txt"
printf 'sent=%s read=%s\n' "$(wc -l < "$SCRATCH/sent.txt")" "$(wc -l < "$SCRATCH/read.txt")"

echo "--- sent but never read ---"; comm -23 "$SCRATCH/sent.txt" "$SCRATCH/read.txt"
echo "--- read but never sent (playbook falls back to its own default) ---"
comm -13 "$SCRATCH/sent.txt" "$SCRATCH/read.txt"
```

Read the two halves differently:

- **read-but-not-sent** is usually fine — the playbook has a `| default(...)`
  and the framework is deliberately not overriding it. Confirm the default is
  what you want; don't add the key reflexively.
- **sent-but-not-read** deserves more suspicion, but check the playbook's
  *actual* directory tree before concluding it's dead. A stale sibling playbook
  that nothing in `setups/dispatch.sh` calls can reference the same variable
  names and give a false sense that they're consumed. (`setup_pdpgsql` sends
  `DISTRIBUTION`, `PDPGSQL_PGSM_PORT`, `PGSTAT_MONITOR_BRANCH`,
  `PMM_QA_GIT_BRANCH`, `PDPGSQL_PGSM_CONTAINER` and `USE_SOCKET`, none of which
  the playbook it calls reads. They appear in `pdpgsql_pgsm_setup.yml` at the
  `pmm_qa/` root, which nothing dispatches to. Worth a second look, not
  something to silently delete.)

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
bats tests 2>&1 | grep -E '^not ok' || echo "NOTHING FAILED -- test does not cover the fix"
```

Two failure shapes to watch for:

- **nothing fails** — the test you added doesn't exercise the fix; strengthen
  the assertion
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
import os, pty
S = "/path/to/stub/bin"
os.environ["PATH"] = S + ":" + os.environ["PATH"]   # BEFORE pty.spawn, not after
out = []
pty.spawn(
    ["./pmm-framework", "--parallel", "--pmm-server-ip", "1.2.3.4",
     "--database", "valkey=8", "--database", "pgsql=16"],
    lambda fd: (lambda d: (out.append(d), d)[1])(os.read(fd, 4096)),
)
text = b"".join(out).decode(errors="replace")
print("stopped (T) processes:", text.count("state='T'"), flush=True)  # if you also poll `ps -o state=`
```

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

Every `--database ...` shape actually used lives in `.github/workflows/*.yml` as
`services_list:` / `setup_services:` strings. When changing argument parsing,
the catalogue, or a flag, run every real shape through the parser — don't invent
inputs.

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
is noise. At the time of writing this yields 63 unique shapes — if you get
substantially fewer, the pattern has drifted from how the workflows are written.

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
  if ( eval "parse_args $shape" ) >/dev/null 2>&1; then
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
