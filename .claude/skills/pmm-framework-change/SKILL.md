---
name: pmm-framework-change
description: >-
  Change qa-integration/pmm_qa/pmm-framework — the bash CLI that provisions
  databases (PS, MySQL, PXC, PostgreSQL, PSMDB, Valkey, ...) and registers them
  with a PMM Server. Use when editing its entrypoint, lib/*.sh, setups/*.sh or
  tests/*.bats, adding a database type or CLI flag, touching --parallel or the
  buffered-log path, porting a type from its Ansible playbook to a prebaked
  image, or checking whether a change broke the framework before a push.
  Doc-only and one-line changes count.
---

# Changing pmm-framework safely

`pmm-framework` is a dispatcher: most `setup_<name>` functions in `setups/*.sh`
build an environment-variable map and hand it to an existing Ansible playbook or
shell script under `qa-integration/pmm_qa/`. PS, MySQL, SSL MySQL, PXC, PSMDB, SSL PSMDB,
HAProxy, External and Valkey instead run on prebaked images with plain `docker` commands
(`lib/prebaked.sh`). To port
another type, follow [prebaked-port.md](references/prebaked-port.md).

**Read [ARCHITECTURE.md](../../../qa-integration/pmm_qa/pmm-framework/ARCHITECTURE.md)
first.** It owns the module map, the run sequence, the value-resolution
precedence chain (§4), the parallel conflict rule (§3), how to extend (§5), and
the language-level conventions (§7). This skill does not repeat it — it covers
only how to *verify* a change to it, which the architecture doc has no opinion
about.

Two things make this codebase unusually easy to break silently: it is bash (a
renamed variable or a dropped `local` is invisible until runtime), and it has a
sequential path that streams live and a parallel path that buffers to a file.
Both regressions that actually shipped — a `SIGTTIN` hang and successful setups
dumping their whole log — came from the parallel path, and both passed `bats`.

## `make check` is necessary, not sufficient

```bash
cd qa-integration/pmm_qa/pmm-framework
make check      # bash -n, shellcheck -x, then the full bats suite
```

The suite stubs `docker`, `ansible-playbook` and `curl`, and every test's stdout
is a pipe — so it can never observe a `[[ -t 1 ]]` branch, terminal signal
delivery, or job-control effects. Green means "no regression the suite knows to
look for," not "no regression."

## Verify the specific property you're changing

This is the part worth slowing down for. Before touching anything, finish the
sentence *"After this change, ___ should be identical."* Then verify that exact
thing, with the cheapest check that would actually **fail** if you were wrong.

| Your claim | What discriminates it | Recipe |
|---|---|---|
| Comment/doc-only pass across `lib/`, `setups/` | Strip comments, diff the remainder per changed file | [#comments-only](references/verification-recipes.md#comments-or-docs-only-pass) |
| Refactored the catalogue in `lib/config.sh` | Dump every type's versions, `DEFAULT_VERSION` and option defaults, diff | [#catalogue](references/verification-recipes.md#refactoring-the-config-catalogue) |
| Changed a `setup_<name>` env map | Diff the exact keys against what the target playbook reads via `lookup('env', ...)` | [#env-map](references/verification-recipes.md#changing-a-setup-function-env-map) |
| Changed `--help`, a flag, or entrypoint plumbing | Compare `--help` and exit codes against a `git worktree` of `HEAD` | [#cli-surface](references/verification-recipes.md#cli-surface-and-exit-codes) |
| Fixed a bug in `lib/execution.sh` | The failing case passes **and** reverting the fix fails the *specific* test again | [#mutation](references/verification-recipes.md#mutation-testing) |
| Touched `run_parallel_setups`, `set -m`, traps, `should_dump_successful_logs` | Drive it through a real pty / real process group | [#pty](references/verification-recipes.md#driving-parallel-mode-under-a-real-pty) |
| Changed argument parsing or the catalogue | Replay every `--database` shape CI actually sends | [#real-inputs](references/verification-recipes.md#exercising-real-caller-inputs-from-ci-workflows) |
| Touched `preflight_database_setups` or the conflict rules | Classify every pair as refused / sequential / parallel — all three, both orderings | [#preflight](references/verification-recipes.md#preflight-conflict-outcomes) |
| Ported a type to a prebaked image, or changed one | The playbook's end state (names, ports, labels via the PMM API, exporters, workload) reproduced by a real run of every CI spec | [prebaked-port.md §6](references/prebaked-port.md#6-verify-for-real) |

A check that passes before *and* after your change tells you nothing. If you
cannot construct one that would have caught the mistake, you don't yet
understand what you changed. That cuts both ways: a check that reports success
having silently examined nothing (an empty input file, a path that doesn't
exist) is the same failure wearing a green hat — confirm the check saw real
input before believing it.

## The parallel path needs a pty, not just bats

ARCHITECTURE.md §3 explains *why* `run_parallel_setups` uses `set -m` and
redirects each job's stdin from `/dev/null`. What it doesn't say is that
**neither guard can be tested under `bats`**, because stdin is never a tty
there. That is exactly how the `SIGTTIN` bug shipped: `set -m` was added
without `</dev/null`, tested under bats, and merged clean.

Don't go looking only for a hang. Removing `</dev/null` today aborts the run
in under a second with `finished_pid: unbound variable` — the stopped job wakes
`wait -n -p`, which *unsets* its variable when the job stopped rather than
exited (verify with `kill -STOP`). The symptom depends on the reaping code, so
judge the pty run by "did every setup report OK", not by whether it hung.

If your change touches `run_parallel_setups`, `cleanup_parallel_jobs`,
`should_dump_successful_logs`, `print_setup_log`, `cat_setup_log`, the
`trap ... INT TERM` block, or the `</dev/null` redirect, drive it with the
[pty recipe](references/verification-recipes.md#driving-parallel-mode-under-a-real-pty)
before trusting `make check`.

Ctrl-C and `kill <pid>` are **different scenarios and both need checking** — see
[bash-pitfalls.md](references/bash-pitfalls.md#background-jobs-job-control-and-signals).
In this codebase Ctrl-C worked *before* the process-group fix; it was the
single-pid case (what a CI timeout sends) that leaked `ansible-playbook`.

## Flags are where CI silently drifts

A flag added or repurposed here has callers in `.github/workflows/*.yml` that no
test covers. `--verbose` was once hardcoded across several runners and had to be
traced and stripped from each one individually after the framework's default
logging changed. After touching a flag, run both the
[CLI-surface](references/verification-recipes.md#cli-surface-and-exit-codes) and
[real-caller-inputs](references/verification-recipes.md#exercising-real-caller-inputs-from-ci-workflows)
recipes.

When adding a database type or flag, follow
[ARCHITECTURE.md §5](../../../qa-integration/pmm_qa/pmm-framework/ARCHITECTURE.md#5-how-to-extend),
then add a `tests/dispatch.bats` case asserting the *exact* env-map keys the
target playbook reads — grep the playbook, don't guess.

## Suspect the harness before the code

A failure that looks like a deep bug is often the verification scaffolding.
Before concluding the framework is broken, check for:

- a subshell that ate an exit status (`local x=$(cmd)`)
- a backgrounded process whose SIGINT can't be trapped (inherited `SIG_IGN` —
  a harness artifact, not a bug; use `SIGTERM` or `setsid` + `killpg`)
- an unreaped zombie read as a hang, or buffered stdout hiding output until a
  timeout kills the process
- a login shell that isn't bash — macOS defaults to zsh, and sourcing this
  repo's associative-array/nameref syntax into zsh fails with `bad substitution`,
  which reads exactly like a script bug

Explain the failure mechanism before you fix it.

## Report honestly

State which property you verified and how. "Ran `make check`" is not the same
claim as "diffed the env map `setup_pdpgsql` sends against the playbook's
`lookup('env', ...)` calls." If you couldn't reach a code path — no pty, no real
PMM Server, a workflow you can't trigger — say so rather than implying broader
coverage than you have.
