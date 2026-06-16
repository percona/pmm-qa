# PMM CLI tests

Percona Monitoring and Management CLI automated tests.

## Folder Map

| Path                   | Purpose                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `tests/`               | Test entrypoints grouped by CLI or service area.                                          |
| `helpers/`             | Shared helpers for shell execution, `pmm-admin`, constants, assertions, and ZIP handling. |
| `support/`             | Shared support types for command results and pipe assertions.                             |
| `test-setup/`          | Docker Compose files used by CLI scenarios.                                               |
| `test-data/`           | Static files used by CLI tests.                                                           |
| `playwright.config.ts` | Playwright runtime configuration.                                                         |

## Getting Started

- Open the `cli` folder in terminal.
- Install Node.js 18+ and make sure `npx` is available.
- Install dependencies: `npm ci`.
- Install Playwright browsers: `npx playwright install`.

## Running Tests

Run commands from `cli/`.

| Goal                  | Command                                                |
| --------------------- | ------------------------------------------------------ |
| Run all tests         | `npx playwright test`                                  |
| Run one file          | `npx playwright test tests/<filename>.spec.ts`         |
| Run by test title     | `npx playwright test --grep "<test-title-or-id>"`      |
| Run by tag            | `npx playwright test --grep "@<tag>"`                  |
| Run by multiple tags  | `npx playwright test --grep "@<tag-1>\|@<tag-2>"`      |
| Exclude a tag         | `npx playwright test --grep-invert "@<tag>"`           |
| Run previous failures | `npx playwright test --last-failed`                    |
| Debug one file        | `npx playwright test tests/<filename>.spec.ts --debug` |
| Open HTML report      | `npx playwright show-report <report-folder>`           |

## Tags

- `@client-docker`
- `@client-generic`
- `@generic`
- `@haproxy`
- `@help`
- `@mongo`
- `@mongoDb`
- `@mysql`
- `@mysql-conf-file`
- `@pdpgsql`
- `@percona-server`
- `@pgsql`
- `@proxysql`
- `@psmdb`
- `@psmdb-shard`
- `@server-docker-generic`
- `@server-only`
- `@service-removal`
- `@unregister`
- `@shard-psmdb`
- `@haproxy`
- `@proxysql`
- `@mongoDb`

## Related Workspaces

- [Playwright E2E Tests](../e2e_tests/README.md) - Playwright web UI and API-assisted E2E tests.
- [CodeceptJS E2E Tests](../codeceptjs-e2e/README.md) - existing CodeceptJS tests.
- [Package Tests](../package_tests/README.md) - PMM client package install and upgrade validation.
- [QA Integration](../qa-integration/README.md) - database and PMM integration environment setup.
