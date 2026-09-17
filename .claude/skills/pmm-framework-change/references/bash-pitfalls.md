# Constructs that change behaviour without looking like they do

ARCHITECTURE.md §7 covers the language-level conventions (`local x=$(cmd)`,
namerefs, `set -euo pipefail` + `inherit_errexit`, the version-gate drift) and
§4 covers value resolution. **This file does not repeat them.** It holds the
things that only show up when you try to *verify* a change — signal delivery,
job control, and the resolver detail §4's table leaves out.

Entries are anchored to functions, not line numbers, which drift.

## Contents

- [Background jobs, job control and signals](#background-jobs-job-control-and-signals)
- [Namerefs](#namerefs)
- [Value resolution: two things not to "fix"](#value-resolution-two-things-not-to-fix)

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

## Namerefs

§7 names the three namerefs a caller must never shadow. The convention that
keeps you clear of them: every `setup_*` function in this repo calls its
associative array `env_map`. Keep that when adding one, and the collision
cannot arise.

## Value resolution: two things not to "fix"

ARCHITECTURE.md §4 has the precedence chain and the table contrasting the two
resolvers. Both look like bugs and are not:

- **Don't reconcile `resolve_value` with `resolved_version`.** They disagree on
  the exported-but-empty variable on purpose (§4's table says which way each
  goes). Making them agree silently changes precedence for real CI callers. A
  third resolver should pick a rule deliberately and say which, the way
  `resolve_value`'s doc comment already does.
- **Don't collapse `resolve_value`'s first branch.** The `GLOBAL_CLIENT_VERSION`
  check that runs before the environment lookup applies to `CLIENT_VERSION`
  only, which reads like a special case worth tidying away — removing it demotes
  `--client-version` below an inherited environment variable.
