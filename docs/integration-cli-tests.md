# Integration & CLI Tests

This guide provides instructions for running the PMM Integration and Command-Line Interface (CLI) tests locally. These tests validate the interaction between the PMM server and client, as well as the functionality of the `pmm-admin` CLI tool.

> **⚠️ Note**: This document covers the **current TypeScript/Playwright-based CLI testing framework**. The legacy BATS tests in `pmm-tests/` directory are deprecated and should not be used for new test development. See [main documentation](README.md#important-notice-legacy-tests-deprecation) for details.

## 💡 **What are Integration & CLI Tests?**

These tests are designed to:

- **Validate client-server communication**: Ensuring that the PMM client can successfully register with and send data to the PMM server.
- **Test database integration**: Verifying that PMM can monitor various database technologies (MySQL, MongoDB, PostgreSQL, etc.).
- **Ensure CLI functionality**: Testing the different commands, flags, and options of the `pmm-admin` CLI.

## 🤖 **How to Run Integration & CLI Tests Locally**

The following steps will guide you through setting up the necessary environment and running the integration and CLI tests on your local machine. These instructions are based on the `runner-integration-cli-tests.yml` CI workflow.

### **Prerequisites**

- **Git**: To clone the required repositories.
- **Docker**: To run the PMM server and other services.
- **Node.js (v18+)** and **npm**: For running the test framework.
- **Python 3** and **pip**: For running setup scripts.
- **System Dependencies**: `ansible`, `clickhouse-client`, `dbdeployer`, etc.

### **Step 1: Clone Repositories**

Clone the `pmm-ui-tests` and `qa-integration` repositories.

```bash
git clone --branch v3 https://github.com/percona/pmm-ui-tests.git
git clone --branch v3 https://github.com/Percona-Lab/qa-integration.git
```

### **Step 2: Install System Dependencies**

Install the required system packages. The command below is for Debian/Ubuntu-based systems.

```bash
sudo apt-get update
sudo apt-get install -y apt-transport-https ca-certificates dirmngr ansible libaio1 libaio-dev libnuma-dev libncurses5 socat sysbench clickhouse-client
curl -s https://raw.githubusercontent.com/datacharmer/dbdeployer/master/scripts/dbdeployer-install.sh | sudo bash -s -- -b /usr/local/bin
```

### **Step 3: Set Up PMM Server**

Set up and start the PMM server using Docker.

```bash
docker create -v /srv --name pmm-server-data perconalab/pmm-server:3-dev-latest
docker run -d -p 80:80 -p 443:8443 --volumes-from pmm-server-data --name pmm-server --restart always perconalab/pmm-server:3-dev-latest
timeout 240 bash -c 'while [[ "$(curl -k -s -o /dev/null -w ''%{http_code}'' https://127.0.0.1:443/v1/readyz)" != "200" ]]; do sleep 2; done' || false
```

### **Step 4: Set Up PMM Client and Services**

Set up the PMM client and the database services you want to monitor.

```bash
cd qa-integration/pmm_qa

# Install the PMM client (used only for help, unregister, generic test suites. These suites need to be moved to some db container)
sudo bash -x pmm3-client-setup.sh --pmm_server_ip 127.0.0.1 --client_version 3-dev-latest --admin_password admin --use_metrics_mode no

# Set up the test environment and services (e.g., a single Percona Server instance)
python3 -m venv virtenv
source virtenv/bin/activate
pip install --upgrade pip
pip install setuptools
pip install -r requirements.txt
python3 pmm-framework.py --database ps

cd ../..
```

### **Step 5: Install Test Dependencies**

Install the Node.js dependencies for the CLI tests.

```bash
cd pmm-ui-tests/cli
npm ci
```

### **Step 6: Run the Tests**

Finally, run the CLI tests using Playwright. You can run specific test files or all of them.

```bash
cd pmm-ui-tests/cli

# Run the help tests
npx playwright test tests/help.spec.ts

# Run the Percona Server tests
npx playwright test tests/perconaMySqlServer.spec.ts

# Run all tests
npx playwright test
```

## 🚀 **Feature Build Integration Suite**

The Feature Build Integration Suite (`fb-integration-suite.yml`) is used to test feature builds of the PMM server and client. It runs the same set of integration and CLI tests against a specified feature build image.

To run these tests locally, follow the same steps as above, but in Step 3, use the feature build Docker image for the PMM server:

```bash
docker create -v /srv --name pmm-server-data perconalab/pmm-server-fb:feature-xyz
docker run -d -p 80:80 -p 443:8443 --volumes-from pmm-server-data --name pmm-server --restart always perconalab/pmm-server-fb:feature-xyz
```

Replace `perconalab/pmm-server:feature-xyz` with the actual tag of the feature build image.

## 📝 **How to Write CLI/Integration Tests**

All paths mentioned in this section are relative to the root of the `pmm-ui-tests` repository ([here](https://github.com/percona/pmm-ui-tests/tree/v3)) or the `qa-integration` repository ([here](https://github.com/Percona-Lab/qa-integration/tree/v3)).

CLI/Integration tests in this project are primarily written using Playwright for interacting with the command line and asserting outputs, combined with Python scripts (`pmm-framework.py`) for setting up and managing the test environment and services.

### **Test Structure and Directory Layout**

CLI tests are located in the `pmm-ui-tests/cli/tests` directory. Each test file (`.spec.ts`) typically focuses on a specific `pmm-admin` command or a set of related commands.

```
pmm-ui-tests/
├── cli/
│   ├── tests/             # Playwright test files for CLI
│   │   ├── help.spec.ts
│   │   ├── inventory.spec.ts
│   │   └── mysql.spec.ts
│   ├── playwright.config.ts # Playwright configuration for CLI tests
│   └── package.json       # Node.js dependencies for CLI tests
qa-integration/
├── pmm_qa/                # Python scripts for environment setup
│   ├── pmm-framework.py   # Main script for setting up services
│   ├── helpers/           # Helper modules for pmm-framework.py
│   └── requirements.txt   # Python dependencies
```

-   **`pmm-ui-tests/cli/tests/`**: Contains the Playwright test files written in TypeScript. These files use Playwright's `expect` assertions to validate CLI output and behavior.
-   **`qa-integration/pmm_qa/pmm-framework.py`**: This is a crucial Python script responsible for setting up the PMM server, PMM clients, and various database services required for testing. It abstracts away the complexities of environment provisioning.

### **Writing Conventions**

-   **CLI Interaction**: Use  `cliHelper` to execute CLI commands.
-   **Python for Environment Setup**: Leverage `pmm-framework.py` to programmatically set up databases, PMM clients, and other services. This ensures a consistent and reproducible test environment.
-   **Clear Assertions**: Assertions should clearly define the expected CLI output, service status, or data collected by PMM.
-   **Test Isolation**: Each test should aim to be as isolated as possible, setting up and tearing down its own resources to prevent interference.

### **Basic CLI Test Example**

CLI/Integration tests in this project typically use a custom `cli-helper` module (located in `pmm-ui-tests/helpers/cli-helper.ts`) to execute `pmm-admin` commands and capture their output. The `cli-helper` returns an `ExecReturn` object, which provides convenient methods for assertions.

```typescript
import { test } from '@playwright/test';
import * as cli from '@helpers/cli-helper'; // Project-specific CLI helper
import ExecReturn from '@support/types/exec-return.class'; // Type definition for command output

let addMongoHelp: ExecReturn;

test.describe('pmm-admin help output', () => {
  test.beforeAll(async () => {
    // Execute a pmm-admin command silently and store its output
    addMongoHelp = await cli.execSilent('sudo pmm-admin add mongodb --help');
    await addMongoHelp.assertSuccess(); // Assert that the command exited successfully
  });

  test('pmm-admin add mongodb --help should contain key options', async () => {
    // Assert that the output contains specific lines or patterns
    await addMongoHelp.outContainsMany([
      'Usage: pmm-admin add mongodb [<name> [<address>]]',
      '--socket=STRING',
      'metrics-mode="auto"',
      'host',
      'port',
      'service-name',
    ]);
  });

  test('pmm-admin add mongodb --help should contain TLS flags', async () => {
    await addMongoHelp.outContainsMany([
      'tls                        Use TLS to connect to the database',
      'tls-skip-verify            Skip TLS certificate verification',
      'tls-certificate-key-file=STRING',
      'tls-ca-file=STRING         Path to certificate authority file',
    ]);
  });
});
```

**Explanation of the Example:**

-   **`import * as cli from '@helpers/cli-helper';`**: Imports the custom CLI helper module that wraps shell command execution.
-   **`import ExecReturn from '@support/types/exec-return.class';`**: Imports the type definition for the object returned by the CLI helper, which includes `stdout`, `stderr`, `exitCode`, and assertion methods.
-   **`cli.execSilent('sudo pmm-admin add mongodb --help')`**: Executes the `pmm-admin` command. `execSilent` runs the command without printing its output to the console, which is useful for tests where you only care about the return value or specific output assertions.
-   **`await addMongoHelp.assertSuccess()`**: An assertion method provided by `ExecReturn` to verify that the command executed successfully (exit code 0).
-   **`await addMongoHelp.outContainsMany([...])`**: An assertion method to check if the standard output of the command contains all the specified strings. This is a common way to verify help messages or command outputs.

This example demonstrates how to execute a `pmm-admin` command, check its success, and assert on its output using the project's established helper functions, providing a more accurate representation of how CLI tests are written here.

---

**Related Documentation**:
- [E2E Tests](e2e-tests.md)
- [Infrastructure Tests](infrastructure-tests.md)
- [Package Tests](package-tests.md)
- [Upgrade Tests](upgrade-tests.md)
- [Test Parameters Reference](test-parameters.md)
- [Troubleshooting Guide](troubleshooting.md)
