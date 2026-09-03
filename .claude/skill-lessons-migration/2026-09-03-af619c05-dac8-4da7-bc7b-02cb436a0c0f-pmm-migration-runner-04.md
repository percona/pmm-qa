# .claude/skills/codeceptjs-migration/branch-workflow.md — name the server-only `setup_services` idiom for a new Playwright job

- Added: 2026-09-03
- Applies to: target only
- Evidence: The Workflow coverage section tells the runner to "mirror the retiring CodeceptJS job's setup verbatim", which gives no answer on a row where the source is kept and the new Playwright job needs no database; the value had to be recovered by grepping `.github/workflows/`, which shows `-h` in `fb-e2e-suite.yml`'s `alerting` job and `--help` in `e2e-tests-matrix.yml`'s CodeceptJS `disconnect` job, while omitting the input entirely is not equivalent — `runner-e2e-tests-playwright.yml` line 100 then passes an empty `WIZARD_ARGS` and `pmm-framework` runs with no arguments at all.
- Proposed change: Add one sentence to that section giving `setup_services: '-h'` as the server-only value for a new Playwright job, citing the `alerting` job as precedent and noting that omitting the input yields an empty `WIZARD_ARGS` rather than a server-only setup.
