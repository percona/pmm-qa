# Constructs that change behaviour without looking like they do

ARCHITECTURE.md §7 covers the language-level conventions (`local x=$(cmd)`,
namerefs, `set -euo pipefail` + `inherit_errexit`, the version-gate drift) and
§4 covers value resolution. **This file does not repeat them.** It holds the
things that only show up when you try to *verify* a change — signal delivery,
job control, and the resolver detail §4's table leaves out.

Entries are anchored to functions, not line numbers, which drift.

## Contents

- [Background jobs, job control and signals](#background-jobs-job-control-and-signals)
- [Namerefs: the third name](#namerefs-the-third-name)
- [Value resolution: the tier §4 added](#value-resolution-the-tier-4-added)

---

## Background jobs, job control and signals

Everything here lives in `run_parallel_setups` / `cleanup_parallel_jobs`
(`lib/execution.sh`).

**The `</dev/null` on each job is load-bearing, and `bats` cannot prove it.**
`set -m` puts each background job in its own process group; a job in a
background process group that **reads the terminal** gets `SIGTTIN` and is
stopped. This is the bug that actually shipped: `set -m` landed without the
redirect, tested only under `bats` where stdin is never a tty, and merged
clean. If you remove or narrow that redirect, verify with a real pty (see
`verification-recipes.md`).

**A stopped job does not read as a hang any more — it reads as a crash.**
`wait -n -p VAR` returns when a job *stops*, not just when it exits, and it
**unsets** VAR in that case. So `run_parallel_setups`' reaping loop hits
`[[ -n $finished_pid ]]` with the variable unset and `set -u` aborts the run —
you get a bare `finished_pid: unbound variable` instead of the loop's own
`die "Parallel wait lost track of setup processes."`, which can never fire as
written. Minimal proof:

```bash
set -m; sleep 30 & pid=$!; finished_pid=
kill -STOP "$pid"; wait -n -p finished_pid "$pid" || true
[[ -v finished_pid ]] && echo SET || echo UNSET      # -> UNSET
```

Guarding it as `${finished_pid:-}` would let the intended message through.

The `trap cleanup_parallel_jobs INT TERM` is load-bearing for the same reason:
under `set -m`, backgrounded jobs no longer receive terminal-generated signals
directly.

**`kill $pid` alone only kills the wrapper subshell.** The real
`ansible-playbook` keeps running. `cleanup_parallel_jobs` signals the whole
group first and falls back to the single pid:

```bash
kill -- -"$pid" >/dev/null 2>&1 || kill "$pid" >/dev/null 2>&1 || true
```

**Ctrl-C and `kill <pid>` are different scenarios and both need checking.**
Ctrl-C signals the whole foreground process group; `kill <pid>` — what a CI job
timeout or `nick-fields/retry` does — signals one process. Verifying only
Ctrl-C and assuming a job-timeout kill behaves the same is exactly backwards:
in this codebase Ctrl-C worked *before* the process-group fix (the terminal
signalled the shared group directly), and it was the single-pid case that
leaked `ansible-playbook` processes.

**A script started with `&` cannot trap SIGINT — this is a harness artifact,
not a bug to chase.** It inherits `SIGINT = SIG_IGN`, and a signal ignored at
entry can be neither trapped nor reset. If a manual test backgrounds
`pmm-framework` to poke at Ctrl-C handling and the trap "doesn't fire," that's
the test, not `cleanup_parallel_jobs`. Use `SIGTERM`, or `setsid` + `killpg` to
simulate a real terminal signal instead.

## Namerefs: the third name

§7 warns against naming a local `env_ref` or `map_ref`. There are **four**
nameref sites and **three** distinct names:

| Function | File | Nameref |
|---|---|---|
| `print_env_map` | `lib/ansible.sh` | `map_ref` |
| `run_playbook` | `lib/ansible.sh` | `env_ref` |
| `run_setup_script` | `lib/runners.sh` | `env_ref` |
| `resolve_value` | `lib/config.sh` | `config_ref` |

`config_ref` is the one §7 omits, and `resolve_value` is called from inside
almost every `setup_*` function — so a local named `config_ref` there is the
easiest of the three to hit. Bash raises a circular-reference error, not a
clean type error. Every `setup_*` function in this repo names its array
`env_map` specifically to avoid the collision; keep that convention.

## Value resolution: the tier §4 added

§4's table contrasts the two resolvers on the empty-env-var case. Two things
it is thin on:

**Precedence has four tiers, and the top one is newer than most of the code.**
`resolve_value` checks `GLOBAL_CLIENT_VERSION` *before* the environment, but
only for `CLIENT_VERSION`. Every other key still starts at the environment.
A change that "simplifies" the first branch away silently demotes
`--client-version` below an inherited env var.

**Don't reconcile the two resolvers.** `resolve_value` (`lib/config.sh`, spec
options) uses `[[ -v $key ]]`, so an exported-but-empty variable **wins** and
yields `''` — Python's `os.environ.get`. `resolved_version` (`lib/runners.sh`,
versions) uses `[[ -n ${!env_name:-} ]]`, so an exported-but-empty variable is
**skipped** — Python's `os.getenv(X) or ...`. They look like they should agree.
Making them agree silently changes precedence for real CI callers. If you add a
third resolver, pick a rule deliberately and say which, the way
`resolve_value`'s doc comment already does.
