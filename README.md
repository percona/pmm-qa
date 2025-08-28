# PMM-QA
Automated tests for Percona Monitoring and Management

> **⚠️ IMPORTANT**: The `pmm-tests/` directory containing BATS tests is **deprecated**. See [documentation](docs/README.md#important-notice-legacy-tests-deprecation) and [pmm-tests/DEPRECATED.md](pmm-tests/DEPRECATED.md) for migration guidance.

## Test Architecture Overview

This project employs a comprehensive testing strategy, utilizing various frameworks and methodologies to ensure the quality and stability of Percona Monitoring and Management (PMM). The tests are broadly categorized by their focus and the tools they use:

- **End-to-End (E2E) UI Tests**: These tests validate the PMM user interface and user workflows. They are primarily written using Playwright and CodeceptJS.
- **CLI/Integration Tests**: These tests focus on the functionality of the `pmm-admin` command-line interface and the integration between PMM components and monitored services. They are typically written using Playwright for CLI interactions and Python for service setup.
- **Package Tests**: These tests verify the installation and functionality of PMM client packages across various operating systems. They leverage Vagrant for virtualized environments and Ansible for automation.
- **Infrastructure Tests**: These tests validate PMM deployments in different environments, including Kubernetes/Helm and using the Easy Install script. They utilize Bats for testing Helm deployments.

**Note**: The legacy BATS tests in `pmm-tests/` are deprecated. Current testing uses TypeScript/Playwright frameworks described in the [documentation](docs/).

Each test type has its own dedicated documentation, detailing how to run and write tests, along with their specific directory structures and conventions.



### Repository Directory Structures

Understanding the layout of the key repositories involved in PMM QA is essential for navigating the codebase and contributing to tests.

#### `pmm-qa` (This Repository)

```
.
├── .github/             # GitHub Actions workflows
├── docs/                # Project documentation
├── k8s/                 # Kubernetes/Helm test scripts (Bats)
├── pmm-integration/     # PMM integration setup scripts (TypeScript)
├── pmm-tests/           # ⚠️ DEPRECATED PMM test scripts (BATS/Bash)
├── tests/               # General test utilities
├── .gitignore
├── docker-compose.yml
├── LICENSE
├── package-lock.json
├── README.md            # This file
└── TEST_EXECUTION_GUIDE.md
```

#### `pmm-ui-tests`

This repository contains the UI End-to-End tests for PMM.

```
pmm-ui-tests/
├── playwright-tests/    # ⚠️ DEPRECATED
├── cli/                 # Playwright tests for CLI interactions
│   ├── tests/           # CLI test files (.spec.ts)
│   └── ...
├── tests/               # CodeceptJS tests and related code
├── helpers/             # CodeceptJS custom helpers
├── config/              # CodeceptJS configuration files
├── pr.codecept.js       # Main CodeceptJS configuration
├── docker-compose.yml   # Docker Compose for PMM server setup
└── ...
```

#### `qa-integration`

This repository provides Python-based scripts for setting up and managing PMM test environments and services.

```
qa-integration/
├── pmm_psmdb-pbm_setup/        # PSMDB replica setup from PSMDB QA team
├── pmm_psmdb_diffauth_setup/   # PSMDB replica setup from PSMDB QA team
├── pmm_qa/                     # Core Python setup scripts
│   ├── pmm-framework.py        # Main script for setting up services
│   ├── helpers/                # Helper modules for pmm-framework.py
│   ├── mysql/
│   ├── mongoDb/
│   ├── postgres/
│   └── ...
├── requirements.txt            # Python dependencies
└── ...
```

#### `package-testing`

This repository contains Ansible playbooks for testing PMM client package installations across various operating systems.

```
package-testing/
├── playbooks/              # Ansible playbooks for different test scenarios
│   ├── pmm3-client_integration.yml
│   └── ...
├── tasks/                  # Reusable Ansible tasks (e.g., verify_pmm3_metric.yml)
├── scripts/                # Reusable scripts (e.g., pmm3_client_install_tarball.sh)
├── inventory.ini           # Ansible inventory file
├── Vagrantfile             # Vagrant configuration for test VMs
└── ...
```


