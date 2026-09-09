# `codeceptjs-e2e/` — legacy CodeceptJS suite

Frozen for new coverage. Still the highest-traffic directory in the repo, so review it properly.

## Rules

- **No new coverage** unless the area exists only here. A new scenario that could live in `e2e_tests/` is 🔴.
- Bug fixes, flake fixes and migrations out are welcome.
- Registered tests are `tests/**/*_test.js` (`pr.codecept.js:147`). Renaming a file off that glob de-registers it — that is how a migrated test is retired, and it must be deliberate and stated in the PR body.
- Retiring a scenario means the destination test exists **and is reachable from a workflow** in the same PR. Check that no workflow still greps a tag that no longer has scenarios, and that no tag the destination needs is missing.
- A retired file left behind carries dead code forever. Prefer deleting — git history is the archive. If the migration programme keeps them, the convention needs writing down somewhere, not inventing per PR.
- `retry(2)` on a scenario when `pr.codecept.js` already defaults to 2 is redundant. 🔵
- Shared step logic goes in `tests/custom_steps.js`. Note its zip helpers map `entryName` to **basename**, unlike `e2e_tests/helpers/archive.helper.ts` which returns the full path — a migrated assertion changes meaning silently. PMM's `logs.zip` really does contain both `pmm-agent.log` and `client/pmm-agent/pmm-agent.log`.
- `tests/helper/reporter_helper.js` posts results to Zephyr Scale and swallows every error in a bare `catch`. Any change there must not widen that. 🟡
- Do not duplicate in a test what a Jenkins pipeline already covers (upgrade paths, for one) — link the pipeline instead.
