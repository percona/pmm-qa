---
name: pmm-framework-change
description: >-
  Change qa-integration/pmm_qa/pmm-framework — the bash CLI that provisions
  databases (PS, MySQL, PXC, PostgreSQL, PSMDB, Valkey, ...) and registers them
  with a PMM Server. Use when editing its entrypoint, lib/*.sh, setups/*.sh or
  tests/*.bats, adding a database type or CLI flag, touching --parallel or the
  buffered-log path, or checking whether a change broke the framework before a
  push. Doc-only and one-line changes count.
---

# Changing pmm-framework safely

`pmm-framework` is a dispatcher, not a provisioner: `setup_<name>` functions in
`setups/*.sh` build an environment-variable map and hand it to an existing
Ansible playbook or shell script under `qa-integration/pmm_qa/`.

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

**A database version bump is verified on a live VM, not by the unit tests.** Adding a
version to `lib/config.sh` and `product_version_download_helper` passes `make check` and
then fails at runtime — PXC 8.4 died on `CREATE USER … identified with
mysql_native_password` (the plugin is OFF by default from 8.4), and PXC 9.7 aborted
mysqld on `unknown variable 'wsrep_slave_threads=2'` (renamed to
`wsrep_applier_threads`). Provision and run the setup before calling a bump done.

Two habits that fall out of it. **Express version guards by exclusion or a numeric major
compare** (`${v%%.*}`, `!= 5.7`), never a substring match: an 8.x-only workaround gated
`echo "$pxc_version" | grep '8'` silently skipped every 9.x release. And **when you
replace a vendor tool with a hand-rolled setup, enumerate every side effect the tests
depend on**, not just the happy-path config — dropping `proxysql-admin` for upstream
ProxySQL also dropped the `admin-stats_credentials='read_user:read_user'` it had been
setting, which is the only reason the `@proxysql` CLI test's `read_user` registration
worked. Reproducing those CLI tests faithfully also means mirroring the runner: run
`pmm-framework` with `--client-debug` (the connection-timeout tests grep
`/pmm-agent.log` for debug-only `timeout=N` lines) and a **fresh** PMM server per run, or
leftover registered services fail `add-proxysql` with "already exists" and a stale
container still holds host port 6033.

Three paths where the obvious check silently misses the change:

- **A green PR-check e2e run is not evidence for the client-install path.** Those
  legs pass `pmm_client_version: latest-tarball`, which leaves the repository
  component empty and skips the changed block entirely — one change passed every
  leg twice and broke the first nightly setup job that ran. Only a component
  version (`3-dev-latest`, `pmm3-rc`, `pmm3-latest`) reaches it, so exercise it
  with a dispatched nightly or a VM run before calling it verified.
- **An Ansible shell task runs in the playbook's directory, not the `pmm_qa` root.**
  A shared task file invoking `./scripts/<name>.sh` resolved for the root-level
  playbooks and died with rc 127 for one in a subdirectory, killing the setup. The
  repo already shows the rule — `tls-ssl-setup/mysql_tls_setup.yml` reaches
  `./mysql/mysql_ssl_setup.sh`, relative to the *playbook*. Address other repo files
  absolutely through the exported `PMM_QA_ROOT`, and check any relative path in a
  shared task file against a playbook in a subdirectory, never only a root-level one.
- **`pmm-agent setup`'s positionals are `[node-address] [node-type] [node-name]`.**
  Four `pmm-agent setup … {{ container_name }}` calls were read as setting the node
  *name*; the single positional sets the **address**, and node-name defaults to
  `os.Hostname()`. The containers are created without `--hostname`, so every node
  registered under its docker short ID — a new identity on each re-provision and a
  permanent orphan in `label_values` after each retry. Set
  `PMM_AGENT_SETUP_NODE_NAME` (or an explicit container `hostname:`) whenever a setup
  registers a client from inside a container.

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
