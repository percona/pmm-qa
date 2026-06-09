# PMM-QA (Percona Monitoring and Management Quality Assurance)

Automated tests and integration tools for Percona Monitoring and Management (PMM). This repository serves as the central hub for validating PMM across different layers, from UI and CLI to package and upgrades.

## Repository Overview

This repository is organized into several workspaces, each focusing on a specific area of PMM:

| Workspace                                       | Purpose                                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| [`e2e_tests/`](./e2e_tests/README.md)           | End-to-End tests for PMM Web UI and API.                                    |
| [`cli/`](./cli/README.md)                       | Automated tests for the CLI tool.                                           |
| [`codeceptjs-e2e/`](./codeceptjs-e2e/README.md) | UI automation for legacy and existing PMM features.                         |
| [`package_tests/`](./package_tests/README.md)   | Validation of PMM Client package installation, configuration, and upgrades. |
| [`qa-integration/`](./qa-integration/README.md) | Environment setup                                                           |

## Getting Started

To learn about a specific area, please refer to the documentation within each folder:

- [Playwright E2E Tests](./e2e_tests/README.md)
- [CLI Tests](./cli/README.md)
- [CodeceptJS E2E Tests](./codeceptjs-e2e/README.md)
- [Package Tests](./package_tests/README.md)
- [QA Integration](./qa-integration/README.md)
