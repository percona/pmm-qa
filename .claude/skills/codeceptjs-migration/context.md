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

Use the Docker-native [`provisioning/`](../../../provisioning/) entry point from the repository root. It owns the local PMM Server lifecycle and accepts the tracked `pmm-framework` spellings such as `--database`, so source-derived `setup_services` database arguments can be passed unchanged:

```bash
node provisioning/setup.ts
node provisioning/setup.ts --database ps=8.4 --database psmdb
node provisioning/setup.ts --db client
node provisioning/setup.ts --database ps=8.4 --db client
```

Build the command from source behavior:

- no database arguments starts PMM Server only;
- pass every derived database argument for a database-backed test; and
- append `--db client` whenever `setup_client=true`, with or without database arguments. A database container's embedded PMM Client does not replace a source-required standalone client/node.

Tracker values `-h` and `--help` mean no database setup in the old workflow. Omit them here: passing either to `provisioning/setup.ts` prints help and exits without starting PMM.

Local requirements are Node.js 22.18 or newer, a running Docker engine, and `e2e_tests` dependencies (`npm ci` there when missing). `DOCKER_VERSION`, `CLIENT_VERSION`, and `ADMIN_PASSWORD` select non-default builds without changing the command shape. Run `node provisioning/setup.ts --help` for the complete descriptor grammar.

Run `bash .claude/scripts/run-migration-single-test.sh` from the repository root to wait for readiness and run the target test. Arguments are the target test path relative to `e2e_tests/`, plus optional `--prepare-only` and `--grep`. The prepare-only check also ensures Chromium is installed for the reviewer. It defaults to the local provisioner's `PMM_UI_URL=https://127.0.0.1/` and `ADMIN_PASSWORD=admin`; export both when provisioning used a different host port or password. Never edit `e2e_tests/.env` during migration.

Local provisioning does not create AWS RDS, Aurora, Azure, AMI, OVF, or pmm-demo dependencies. Those tracker rows remain blocked until their named external infrastructure exists.

For MCP locator fallback, run `node .claude/scripts/verify-migration-locator.mjs help-export-logs` against the prepared environment.

## Setup Precedence

Source behavior wins. Derive setup by reading the selected source test, hooks, data rows, custom steps, helpers, APIs, and POM methods.

Use the tracker `Setup` value only as the planned default. Tags are hints, not truth. When setup is unclear, inspect `provisioning/ARCHITECTURE.md` and `node provisioning/setup.ts --help`.

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

For browser MCP locator discovery, use `.agents/workflows/pmmLogin.md` with the prepared `PMM_UI_URL` and `ADMIN_PASSWORD`. For broken locator recovery, follow `locator-fix.md`.
