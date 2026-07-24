# Migration Context Pack

Read this first for a migration run. It is a map, not a command cookbook. Query existing Graphify artifacts read-only per `graphify.md`; do not regenerate graphs during migration.

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

Use `.cursor/scripts/run-migration-single-test.sh` from repo root. Arguments are target test path relative to `e2e_tests/`, `setup_services`, `setup_client`, plus optional `--prepare-only` and `--grep`.

Defaults: PMM server image `perconalab/pmm-server:3-dev-latest`, password `ADMIN_PASSWORD=admin-password`, UI URL `http://127.0.0.1/`. The script exports `PMM_MIGRATION=1` and local `PMM_UI_URL`; never edit `e2e_tests/.env` during migration.

For MCP locator fallback, run `node .cursor/scripts/verify-migration-locator.mjs help-export-logs` against the prepared environment.

## Setup Precedence

Source behavior wins. Derive setup by reading the selected source test, hooks, data rows, custom steps, helpers, APIs, and POM methods.

Use the tracker `Setup` value only as the planned default. Tags are hints, not truth. When setup is unclear, inspect `qa-integration/pmm_qa/README.md` and `qa-integration/pmm_qa/scripts/database_options.py`.

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

## Auth And Locators

Tests authorize through `grafanaHelper.authorize()` in `pmmTest.beforeEach`; `pmmTest` already mocks tour completion and server updates at context level.

For browser MCP locator discovery, use `.agents/workflows/pmmLogin.md`. For broken locator recovery, follow `locator-fix.md`.
