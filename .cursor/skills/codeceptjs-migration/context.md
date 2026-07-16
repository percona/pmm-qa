# Migration Context Pack

Read this first for a migration run. Keep it small: this file is the quick-start map, not an inventory snapshot. Query existing Graphify artifacts read-only per `graphify.md`; do not regenerate graphs during migration.

## File Map

| Topic | Canonical file |
| --- | --- |
| Migration rules and invariants | `SKILL.md` |
| Step-by-step workflow | `run.md` |
| CodeceptJS call and custom-step mapping | `mappings.md` |
| Review checklist and done gate | `audit-checklist.md` |
| Broken locator recovery | `locator-fix.md` |
| Branch, PR, and tracker publishing | `branch-workflow.md` |
| Work queue | `tracker.md` |
| Source and target graph rules | `graphify.md` |

## Provisioning

The canonical provisioning and execution path is `.cursor/scripts/run-migration-single-test.sh` from repo root:

```bash
./.cursor/scripts/run-migration-single-test.sh '<tests/file.test.ts>' '<setup_services>' <setup_client> [--prepare-only] [--grep '<regex>']
```

- `<tests/file.test.ts>` is relative to `e2e_tests/`.
- `<setup_services>` is the `pmm-framework.py` service setup string, or an empty string for no DB/service setup.
- `<setup_client>` is `true` only for a standalone PMM Client/node outside `pmm-framework.py`; otherwise use `false`.
- `--prepare-only` provisions PMM for MCP review and exits before Playwright.
- `CLEAN_ENVIRONMENT=false` reuses the prepared environment for proof and regression runs. Do not recreate PMM after review provisioning.

Defaults: PMM server image `perconalab/pmm-server:3-dev-latest`, password `ADMIN_PASSWORD=admin-password`, UI URL `http://127.0.0.1/`. Override only when the migration explicitly needs different values.

## Setup Precedence

Source behavior wins. Derive setup by reading the selected source test, hooks, data rows, custom steps, helpers, APIs, and POM methods.

Use the tracker `Setup` value only as the planned default. Treat tags as hints, not truth; broad tags can cover both DB-backed and pure UI tests. When setup is unclear, inspect `qa-integration/pmm_qa/README.md` and `qa-integration/pmm_qa/scripts/database_options.py`.

For tests with no DB dependency, pass an empty `setup_services` string. Use `setup_client=true` only when the source test needs a standalone client/node.

## Repo Map

| Source | Target |
| --- | --- |
| `codeceptjs-e2e/tests/<category>/*_test.js` | best-fit existing `e2e_tests/tests/**/*.test.ts` |
| `codeceptjs-e2e/tests/**/pages/*.js` | `e2e_tests/pages/**/*.page.ts` |
| `codeceptjs-e2e/tests/**/pages/api/*.js` | `e2e_tests/api/*.api.ts` |
| `codeceptjs-e2e/tests/custom_steps.js` | existing helpers/components per `mappings.md` |
| `codeceptjs-e2e/testdata/` | `e2e_tests/testdata/` |

Match targets by behavior, fixtures, hooks, and environment, not filename alone. Append to an existing target when it fits; create a new test file only when no suitable target exists.

After live run PASS, retire the selected source according to `branch-workflow.md`.

## Live Discovery

Use current repo state instead of static inventories:

```bash
rg --files e2e_tests/pages e2e_tests/api e2e_tests/helpers e2e_tests/components
rg -n "base.extend|readonly .*Api|new .*Page|new .*Api" e2e_tests/fixtures/pmmTest.ts e2e_tests/api/api.ts
```

Also inspect Graphify output per `graphify.md` and then open actual files. Code on disk is authoritative when it conflicts with graph output.

## Registration Points

- POM fixtures: `e2e_tests/fixtures/pmmTest.ts`
- API clients: `e2e_tests/api/api.ts`
- API paths: `e2e_tests/helpers/apiEndpoints.ts`
- Timeouts enum: `e2e_tests/helpers/timeouts.ts`
- POM base shape: `e2e_tests/pages/base.page.ts`

Use repository patterns: POM locators grouped in `buttons`, `elements`, `inputs`, `messages`, or `builders`; arrow-function methods; `url` property for page URLs.

## Commands

Run validation from `e2e_tests/`:

```bash
npm ci
npx playwright install chromium
npx tsc --noEmit -p tsconfig.json
npx eslint .
```

Prepare once for MCP review from repo root:

```bash
./.cursor/scripts/run-migration-single-test.sh 'tests/<category>/<name>.test.ts' '<setup_services>' <setup_client> --prepare-only
```

Run one migrated test against the prepared environment:

```bash
CLEAN_ENVIRONMENT=false ./.cursor/scripts/run-migration-single-test.sh 'tests/<category>/<name>.test.ts' '<setup_services>' <setup_client> --grep '<anchored title regex>'
```

Other useful commands from `e2e_tests/`:

```bash
npx playwright test --grep "@<tag>"
npx playwright show-trace test-results/<folder>/trace.zip
```

The runner script exports `PMM_UI_URL=http://127.0.0.1/`, `ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin-password}`, `HEADLESS=true`, and `WORKERS=1`.

## Auth And Locators

Tests authorize through `grafanaHelper.authorize()` in `pmmTest.beforeEach`; `pmmTest` already mocks tour completion and server updates at context level.

For browser MCP locator discovery, use `.agents/workflows/pmmLogin.md`. For broken locator recovery, follow `locator-fix.md`.
