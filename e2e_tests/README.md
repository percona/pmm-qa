# PMM Playwright E2E Tests

This folder contains the Playwright end-to-end test suite for PMM.
It includes tests, shared fixtures, page objects, helpers, API clients, and test data.

## Folder Map

| Path                   | Purpose                                                                        |
| ---------------------- | ------------------------------------------------------------------------------ |
| `tests/`               | Test entrypoints grouped by PMM area.                                          |
| `fixtures/`            | Shared Playwright fixtures. Tests use `pmmTest` from `@fixtures/pmmTest`.      |
| `pages/`               | Page objects for PMM pages and Grafana dashboards.                             |
| `components/`          | Reusable UI components, mostly dashboard panels.                               |
| `helpers/`             | Shared helpers for API, URL, auth, CLI, metrics, mocks, MongoDB, and timeouts. |
| `api/`                 | API clients used by UI and API tests.                                          |
| `interfaces/`          | Shared TypeScript types.                                                       |
| `testdata/`            | Test data used by specific scenarios.                                          |
| `playwright.config.ts` | Playwright runtime configuration.                                              |

## Getting Started

- Open the `e2e_tests` folder in terminal.
- Install Node.js 18+ and make sure `npx` is available.
- Install dependencies: `npm ci`.
- Install Playwright browsers: `npx playwright install chromium`.
- Make sure the target PMM server is available.

Create `e2e_tests/.env` before running tests. These are default values; change them for your PMM environment:

```env
PMM_UI_URL=http://localhost/
ADMIN_PASSWORD=admin
HEADLESS=true
WORKERS=1
```

| Variable         | Default             | Purpose                                                |
| ---------------- | ------------------- | ------------------------------------------------------ |
| `PMM_UI_URL`     | `http://localhost/` | PMM server base URL.                                   |
| `ADMIN_PASSWORD` | `admin`             | Password used to authenticate as PMM `admin`.          |
| `HEADLESS`       | `true`              | Browser visibility; use `false` for a visible browser. |
| `WORKERS`        | `1`                 | Playwright worker count.                               |

## Running Tests

Run commands from `e2e_tests/`.

| Goal                  | Command                                                |
| --------------------- | ------------------------------------------------------ |
| Run all tests         | `npx playwright test`                                  |
| Run one file          | `npx playwright test tests/<filename>.test.ts`         |
| Run one folder        | `npx playwright test tests/<folder>`                   |
| Run by test title     | `npx playwright test --grep "<test-title-or-id>"`      |
| Run by tag            | `npx playwright test --grep "@<tag>"`                  |
| Run by multiple tags  | `npx playwright test --grep "@<tag-1>\|@<tag-2>"`      |
| Run previous failures | `npx playwright test --last-failed`                    |
| Run headed            | `npx playwright test --headed`                         |
| Open UI mode          | `npx playwright test --ui`                             |
| Debug one file        | `npx playwright test tests/<filename>.test.ts --debug` |
| Record traces         | `npx playwright test --trace on`                       |
| View a trace          | `npx playwright show-trace <path-to-trace.zip>`        |
| Open HTML report      | `npx playwright show-report <report-folder>`           |

Runtime defaults:

- Browser project: `chromium`
- Test directory: `tests/`
- Test timeout: 10 minutes
- Global timeout: 30 minutes
- Fully parallel: `true`
- Workers: `WORKERS`, or `1`
- Retries: `2` in CI, `0` locally
- Viewport: `1920x1080`
- Headless: `true` unless `HEADLESS=false`
- Screenshots: only on failure
- Traces: retained on first failure

Use shared timeout values from `@helpers/timeouts`.

For test, page-object, fixture, and helper conventions, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Available Tags

<!-- E2E-TAGS-START -->

- `@dashboards`
- `@docker-configuration`
- `@downloads`
- `@ha-settings`
- `@image-renderer`
- `@inventory`
- `@LBAC`
- `@new-navigation`
- `@nightly`
- `@pmm-ps-integration`
- `@pmm-ps-pxc-haproxy-integration`
- `@pmm-valkey-integration`
- `@post-release`
- `@rta`
- `@settings`
- `@standalone`

<!-- E2E-TAGS-END -->

## Related Workspaces

- [CLI Tests](../cli/README.md) - focused `pmm-admin` CLI tests.
- [CodeceptJS E2E Tests](../codeceptjs-e2e/README.md) - existing CodeceptJS tests.
- [Package Tests](../package_tests/README.md) - PMM client package install and upgrade validation.
- [QA Integration](../qa-integration/README.md) - database and PMM integration environment setup.
