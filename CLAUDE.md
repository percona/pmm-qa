# PMM-QA — Claude Code Entry Point

Read [AGENTS.md](AGENTS.md) for the complete guide covering repository map, all test suites (Playwright, CodeceptJS, CLI, package, Helm), CI orchestration, patterns, and development workflow.

## PMM Context

This is the QA automation repo for [PMM](https://github.com/percona/pmm). For product-wide architecture and domain model, see [percona/pmm AGENTS.md](https://github.com/percona/pmm/blob/main/AGENTS.md).

## House style (applies to every session, agent, and routine)

This section is the single global lever for cross-cutting preferences — it loads in every session, including multi-repo ones where the project `.claude/settings.json` does not. To change how all of PMM AI writes code or behaves, edit **here**, not each agent/routine file.

- **Minimal comments.** Write code that reads like the surrounding file. Only comment the non-obvious — a tricky invariant, a workaround with a reason, a public API contract. Do not narrate what the code plainly says, and do not add header/section banners. Match the comment density already present in the file you are editing.
- **A local tooling workaround never mutates a tracked file.** Copy it to the scratch directory, patch the copy, and point the tool at it (`--config`, `--project`, …). Editing a tracked lint or build config in place to get past a crash on this machine changes what everyone else runs, and it broke the config outright the one time it was tried (`ReferenceError: unicorn is not defined`, undone with `git checkout --`); the scratch copy produced the same signal with the tracked file untouched.
