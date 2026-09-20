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
- **A try/catch, `.catch()` or conditional around an `I.*` step is dead code** unless the `tryTo` plugin is enabled in the codecept config: CodeceptJS drives steps through its own recorder, so a failing step rejects the *test*, not the promise the catch is watching. One retry helper wrapped `await I.waitForElement(locator, 30)` so a straggler panel could get a longer second wait; it shipped, linted clean, never executed its catch, and two nightly lanes failed reporting the original 30 s timeout from inside the helper meant to rescue them. The non-throwing form is a grab — `grabNumberOfVisibleElements` returns 0 — tested before committing to a step that can fail.
- **A "replace the fixed wait" finding is 🔵, not 🟡, unless it names the replacement predicate and that predicate can be verified in an environment the reviewer has.** A bot asked for `I.wait(2)` in `tests/pages/explorePage.js` to become content-based; the predicate would need `waitForFunction` against Monaco's `.view-lines`, an empty editor still renders one empty `view-line` so it must reach into the text, and none of it is checkable without the external-ClickHouse datasource. A later assertion in the same method that fails loudly on the lost race — here the `assert.strictEqual` ending `setSqlQuery`, which prints both strings — is itself a reason to leave the wait alone.
