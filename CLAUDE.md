# PMM-QA — Claude Code Entry Point

Read [AGENTS.md](AGENTS.md) for the complete guide covering repository map, all test suites (Playwright, CodeceptJS, CLI, package, Helm), CI orchestration, patterns, and development workflow.

## PMM Context

This is the QA automation repo for [PMM](https://github.com/percona/pmm). For product-wide architecture and domain model, see [percona/pmm AGENTS.md](https://github.com/percona/pmm/blob/main/AGENTS.md).

## House style (applies to pmm-qa work: sessions, agents and routines)

This section is the single global lever for cross-cutting preferences — it loads whenever a session touches pmm-qa. To change how PMM QA agents write code or behave, edit **here**, not each agent/routine file.

- **Minimal comments.** Write code that reads like the surrounding file. Only comment the non-obvious — a tricky invariant, a workaround with a reason, a public API contract. Do not narrate what the code plainly says, and do not add header/section banners. Match the comment density already present in the file you are editing.
- **A local tooling workaround never mutates a tracked file.** Copy it to the scratch directory, patch the copy, and point the tool at it (`--config`, `--project`, …) — editing a tracked lint or build config in place changes what everyone else runs. When the config resolves paths **relatively** (`./codeceptConfigHelper`, `./tests/helper/hooks.js`), a scratch-directory copy cannot load: put the patched copy beside the original under an untracked name and pass it with the tool's own config flag. Either way the tracked file stays untouched.
- **Address a directory by its literal absolute path.** `cd "$VAR"` guarded only by `||` is forbidden: an unset variable makes `cd ""` a successful no-op, so the fallback never runs and the command executes in whatever directory the harness reset to — that is how `npm init` and downloaded CI artifacts landed in the tracked checkout. `mkdir -p` an absolute scratch subdir and `cd <literal path> || exit 1`, confirming `pwd`, before any file-creating or package-manager command.
- **Capture a command's own exit status; never read it through a pipe.** `out=$(cmd 2>&1); rc=$?`, then branch on `$rc`. A retry loop written as `if git push … 2>&1 | tail -3; then break; fi` tests `tail`, which exits 0 on the first failure and reports a push that never landed; `cmd | head -4; echo "rc=$?"` measures `head` the same way.
- **A scripted multi-line replacement anchors on unique start and end strings**, asserting each is present and unambiguous — never on a `sed -n 'A,Bp'` line-range snapshot, which ends mid-block and leaves a duplicated tail. Run the file's own syntax check (`bash -n`, `node --check`, …) immediately afterwards.
- **Read a third-party action's or library's own inputs before hand-rolling behaviour inside it.** Retry, pagination, auth, logging and timeout are usually already parameters — `actions/github-script` takes `retries`, which collapsed a 93-line hand-written backoff into one line per step. For a pinned ref, `curl raw.githubusercontent.com/<owner>/<repo>/<ref>/action.yml` reads them without guessing.
- **Re-read a copied comment against the file it lands in.** The same block applied to three files carried one justification that was true in one of them and plainly false in the other two. A comment rewritten in response to review gets re-checked for the same defect, not reworded around it.
- **Kill by pid, not by pattern.** `pkill -f <pattern>` matches your own command line, so it kills the calling shell and takes the rest of the compound command with it. `pgrep` first, then `kill -9 <pid>`.
- **Never run a hook by hand as a check.** The harness invokes it with a JSON payload on stdin, so a manual run reads `/dev/null`, reports success having linted nothing, or hangs on stdin. Call the underlying tool instead (`support_scripts/lint/lint-changed.sh <files>`) and let the gate fire on `git commit`.
- **Poll a harness background task on its exit marker**, `[exited with code`, as well as on any content string — and prefer the completion notification the harness delivers on its own to an interval poll of the output file. A loop matching only content ran twenty 30-second iterations after the work had already finished.
- **Only a 🔵 review finding is optional.** Fix a 🟡 or 🔴 one in its own push.
