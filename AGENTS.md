# PMM QA Automation — AI Agent Development Guide

<!-- SINGLE ENTRY POINT for all AI coding assistants (Claude Code, Cursor, GitHub Copilot, etc.)
     Compatibility shims: CLAUDE.md, .cursorrules, .github/copilot-instructions.md
     Last reviewed: 2026-03 -->

## PMM Context

This repository is part of [Percona Monitoring and Management (PMM)](https://github.com/percona/pmm). For the product-wide overview, architecture, and domain model, see [copilot-instructions.md](https://github.com/percona/pmm/blob/v3/.github/copilot-instructions.md) in the main PMM repo.

**Role in PMM**: QA automation hub — Playwright browser E2E tests, Helm/Kubernetes tests, CI orchestration workflows, and support scripts. Works alongside [pmm-ui-tests](https://github.com/percona/pmm-ui-tests) (CodeceptJS + Playwright E2E) and the monorepo's `/api-tests` (Go API integration tests).

**Communicates with**: PMM Server (via browser + REST API), uses [Percona-Lab/qa-integration](https://github.com/Percona-Lab/qa-integration) for DB topology provisioning (`pmm-framework.py`, `pmm3-client-setup.sh`).

## PMM QA Testing Landscape

PMM has three complementary test suites across repositories:

| Repository | Test Type | Framework | Language | Target |
|------------|-----------|-----------|----------|--------|
| **pmm-qa** (this repo) | Browser E2E, Helm, CLI integration orchestration | Playwright, Bats | TypeScript, Shell | PMM UI, Kubernetes |
| [pmm-ui-tests](https://github.com/percona/pmm-ui-tests) | Browser E2E (large), CLI automation | CodeceptJS + Playwright, Playwright Test | JavaScript, TypeScript | PMM UI, pmm-admin CLI |
| [pmm/api-tests](https://github.com/percona/pmm/tree/main/api-tests) | API integration | Go `testing` + Swagger clients | Go | PMM REST APIs |

## Architecture

### Test Stacks in This Repo

| Stack | Location | Purpose |
|-------|----------|---------|
| **Playwright Test** | `e2e_tests/` | Primary browser E2E tests (TypeScript) |
| **Bats** | `k8s/` | Helm chart and Kubernetes tests |
| **Python unittest** | `support_scripts/` | Upgrade and agent status checks |
| **GitHub Actions** | `.github/workflows/` | CI orchestration (24 workflow files) |

### CI Pipeline Architecture

```
.github/workflows/
├── Entry workflows (push/schedule/dispatch)
│   ├── e2e-tests.yml, e2e-tests-matrix.yml
│   ├── integration-cli-tests.yml
│   ├── helm-tests.yml
│   ├── e2e-upgrade-tests*.yml
│   ├── package-test-matrix.yml
│   └── pmm-easy-install.yml
│
├── Reusable runners (workflow_call)
│   ├── runner-e2e-tests-playwright.yml       # Playwright E2E
│   ├── runner-e2e-tests-codeceptjs.yml       # CodeceptJS (legacy, from pmm-ui-tests)
│   ├── runner-integration-cli-tests.yml      # CLI via pmm-ui-tests/cli
│   ├── runner-package-test.yml               # Package install tests
│   ├── runner-easy-install.yml               # Easy install matrix
│   └── runner-e2e-upgrade-tests.yml          # Upgrade E2E
│
└── Feature-branch variants
    ├── fb-e2e-suite.yml
    └── fb-integration-suite.yml
```

**Cross-repo orchestration**: Workflows check out `pmm-qa`, `Percona-Lab/qa-integration`, and `percona/pmm-ui-tests` with configurable branch inputs, provision PMM Server + databases via `pmm-framework.py`, then run tests.

## Directory Structure

```
pmm-qa/
├── e2e_tests/                          # Playwright Test suite (primary)
│   ├── playwright.config.ts            # Config: baseURL from PMM_UI_URL, Chromium, tags
│   ├── package.json                    # Dependencies: @playwright/test, TypeScript, ESLint
│   ├── docker-compose.yml              # PMM Server + renderer + watchtower
│   ├── tsconfig.json                   # Path aliases: @pages/*, @helpers/*, @fixtures/*
│   ├── tests/
│   │   ├── welcomePage/                # Welcome page tests
│   │   ├── pmmTour/                    # Product tour tests
│   │   ├── helpCenter/                 # Help center tests
│   │   ├── changeTheme/                # Theme switching tests
│   │   ├── inventory/                  # Inventory management tests
│   │   ├── qan/                        # Query Analytics (RTA, stored metrics)
│   │   ├── dashboards/                 # Dashboard tests (MySQL, Valkey, image renderer)
│   │   ├── cli/mysql/                  # CLI smoke tests via browser context
│   │   └── api/mysql/                  # API checks from browser context
│   ├── pages/                          # Page Object Model classes
│   │   ├── base page objects
│   │   ├── dashboards/
│   │   ├── inventory/
│   │   └── qan/
│   ├── components/dashboards/panels/   # Grafana panel abstractions
│   ├── helpers/                        # Test utilities
│   ├── fixtures/                       # Test data and fixtures
│   ├── interfaces/                     # TypeScript interfaces
│   └── api/                            # API client helpers
│
├── k8s/                                # Kubernetes / Helm tests
│   ├── helm-test.bats                  # Bats test suite for PMM Helm chart
│   ├── pmm_helper.sh                   # PMM-specific shell helpers
│   ├── k8s_helper.sh                   # Kubernetes shell helpers
│   ├── install_k8s_tools.sh            # Tool installation script
│   └── setup_bats_libs.sh              # Bats library setup
│
├── support_scripts/                    # Python utility scripts
│   ├── check_upgrade.py                # Server upgrade verification
│   ├── check_client_upgrade.py         # Client upgrade verification
│   └── agent_status.py                 # Agent status checks
│
├── .github/workflows/                  # CI orchestration (24 files)
│   ├── e2e-tests*.yml                  # E2E entry points
│   ├── runner-*.yml                    # Reusable runners
│   └── fb-*.yml                        # Feature-branch variants
│
└── package-lock.json                   # Root lockfile (placeholder)
```

## Playwright Test Suite (`e2e_tests/`)

### Configuration

- **Config**: `e2e_tests/playwright.config.ts`
- **Base URL**: `PMM_UI_URL` env var (default `http://localhost/`)
- **Browser**: Chromium only
- **Workers**: configurable via `WORKERS` env var
- **Reporters**: HTML + JSON (CI uses Launchable for test subsetting)
- **Retries**: 1 in CI, 0 locally

### Page Object Model

Tests use class-based page objects in `e2e_tests/pages/`:
- Page classes encapsulate selectors and actions
- Locators use `data-testid` attributes
- Path aliases: `@pages/*`, `@helpers/*`, `@fixtures/*` (via `tsconfig.json`)

### Test Tags

Tests are filtered by tags (in test titles or annotations): `@dashboards`, `@qan`, `@inventory`, `@settings`, `@cli`, etc. CI workflows use `--grep @tag` for selective runs.

### Running Locally

```bash
cd e2e_tests

# Install dependencies
npm ci
npx playwright install-deps
npx playwright install chromium

# Start PMM Server
docker compose up -d

# Run all tests
npx playwright test

# Run specific tag
npx playwright test --grep @inventory

# Run specific file
npx playwright test tests/dashboards/
```

## Helm / Kubernetes Tests (`k8s/`)

- **Framework**: [Bats](https://github.com/bats-core/bats-core) (Bash Automated Testing System)
- **Target**: PMM Helm chart on minikube
- **Helpers**: `pmm_helper.sh`, `k8s_helper.sh` for cluster and PMM operations
- **CI**: `.github/workflows/helm-tests.yml`

## Patterns and Conventions

### Do
- Use the **Page Object Model** for browser tests — put selectors and actions in `pages/`
- Use **`data-testid`** locators (stable, not CSS-class dependent)
- Tag tests for CI filtering (`@inventory`, `@dashboards`, `@qan`, etc.)
- Make tests **idempotent** — clean up created resources
- Use `e2e_tests/api/` helpers for test setup/teardown via REST API
- Use path aliases (`@pages/`, `@helpers/`) in imports
- Use Playwright's `test.step()` for readable test structure

### Don't
- Don't use CSS class selectors for Grafana elements (they change across versions)
- Don't hardcode PMM Server URLs — use `PMM_UI_URL` env var
- Don't hardcode admin passwords — use `ADMIN_PASSWORD` env var (default `admin`)
- Don't skip cleanup — CI runs accumulate state across tests
- Don't mix Playwright Test and CodeceptJS patterns — new tests go in `e2e_tests/` (Playwright)

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PMM_UI_URL` | `http://localhost/` | PMM Server URL |
| `ADMIN_PASSWORD` | `admin` | Grafana/PMM admin password |
| `WORKERS` | `1` | Playwright parallel workers |
| `DOCKER_VERSION` | `perconalab/pmm-server:3-dev-latest` | PMM Server Docker image |

## Key Files to Reference

- `e2e_tests/playwright.config.ts` — Playwright configuration
- `e2e_tests/package.json` — dependencies and scripts
- `e2e_tests/docker-compose.yml` — local PMM Server environment
- `e2e_tests/pages/` — Page Object Model classes
- `e2e_tests/tests/` — test specs organized by feature
- `k8s/helm-test.bats` — Helm chart test suite
- `.github/workflows/runner-e2e-tests-playwright.yml` — reusable Playwright CI runner
