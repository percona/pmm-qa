# `.github/workflows/` — GitHub Actions

Naming: `runner-*` is a reusable workflow for one suite, `fb-*` wraps a runner against a feature build, `*-matrix*` fans a runner out. Low PR volume, highest cost per defect.

## The nightly rendezvous — read before touching it

`nightly-e2e-tests-matrix.yml` couples setup shards and test jobs through **string literals and hand-maintained counters**. Nothing validates them.

| Contract | Where |
|---|---|
| Setup job names start with `setup / ` | consumed at `runner-e2e-tests-codeceptjs-remote-nightly-tests.yml:76` |
| Test job names start with `test execution / ` | consumed at `runner-e2e-tests-codeceptjs-remote-nightly-setup.yml:55` |
| Step named exactly `Waiting for tests execution` | defined at `…-setup.yml:141`, polled by the test job |
| `expected_setup_jobs` = number of setup shards | passed per test job |
| `expected_test_jobs` = number of consumer jobs | passed per setup shard |

Findings:

- A job renamed out of its prefix becomes invisible to the poller: the shard finishes, its runner dies, and a still-running consumer loses its client. 🔴
- A counter that does not match the matrix length deadlocks or releases early. Adding a consumer without bumping `expected_test_jobs` is 🔴.
- `WAIT_POLL_INTERVAL_SECONDS: 600` is deliberate — a shorter interval hits the Actions API rate limit and has already been reverted once. Lowering it is 🔴.
- `WAIT_TIMEOUT_SECONDS` above the job's `timeout-minutes` can never fire; you lose the descriptive error and get GitHub's generic kill. 🟡
- A no-DB test does not belong in the rendezvous. Give it a job named outside the `test execution / ` prefix so the shards do not wait on it. 🟡

## Silent green

- `npx playwright test … || true` swallows the exit code, so the job's result depends entirely on `launchable gate`. The CodeceptJS runner does **not** use `|| true`; two runners in one matrix reporting failure differently is 🟡, and 🔴 if it also strands the report artifact.
- `if: failure()` on the report upload never fires when the test step is `|| true`. Use `always()` — traces and screenshots are the only debugging material.
- No `LAUNCHABLE_TOKEN` → empty subset → every step skips → **green job, zero tests run**, and it still counts toward `expected_test_jobs`. Any change that widens this path is 🔴.
- Launchable also mutes a quarantined or below-confidence test: a green job does not prove the test step passed. Read the step, not the job summary.
- `launchable subset` selects at **file** granularity (`launchable-prepare.js`), so a tag decision is a per-file decision.
- The launchable `--test-suite` name must distinguish framework: `playwright` and `codeceptjs` subsets use different path formats, and a shared suite name poisons the model.

## Ordinary hygiene

| Rule | Note |
|---|---|
| No copied block over ~50 lines | extract a composite action under `.github/actions/`. The 96-line rendezvous script already exists in three places |
| Pin actions consistently within a file | `actions/checkout` is SHA-pinned while `github-script@v7` and `upload-artifact@v4` float |
| Env vars in `run:`, not `${{ }}` interpolation | `"$ADMIN_PASSWORD"`, not `${{ env.ADMIN_PASSWORD }}` |
| No hardcoded branch name | `github.event.repository.default_branch` |
| Artifact name matches its content | a `junit_*` artifact carrying `results.json` is misleading; `output/junit.xml` exists |
| Every declared secret is consumed | `ZEPHYR_PMM_API_KEY` is set in `runner-e2e-tests-playwright.yml` and read by nothing — Playwright results never reach Zephyr |
| Two env vars for one input | pick one |
