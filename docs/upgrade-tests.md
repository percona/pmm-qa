# Upgrade Tests

This guide provides instructions for running the PMM upgrade tests locally. These tests validate the PMM upgrade process, ensuring data integrity and functionality are maintained across versions.

> **⚠️ Note**: Some examples in this document reference legacy scripts in `pmm-tests/` which are deprecated. While these specific scripts (`pmm2-client-setup.sh`, `pmm-framework.sh`) may still be used for upgrade testing scenarios, **no new BATS tests should be created**. For new test development, use the TypeScript/Playwright framework. See [main documentation](README.md#important-notice-legacy-tests-deprecation) for details.

## 💡 **What are Upgrade Tests?**

Upgrade tests are critical for ensuring a smooth user experience when new versions of PMM are released. They verify that:

- **The upgrade process is successful**: Whether using the UI, Docker, or Podman, the upgrade completes without errors.
- **Data is preserved**: All historical monitoring data, user configurations, and settings are maintained after the upgrade.
- **Functionality remains intact**: All features of PMM, from monitoring and alerting to QAN, continue to work correctly.

## 🤖 **How to Run Upgrade Tests Locally**

The following steps will guide you through setting up an older version of PMM, performing an upgrade, and running validation tests locally. These instructions are based on the `runner-e2e-upgrade-tests.yml` CI workflow.

### **Prerequisites**

- **Git**: To clone the required repositories.
- **Docker**: To run the PMM server and other services.
- **Node.js (v18+)** and **npm**: For running the test framework.
- **Python 3** and **pip**: For running setup scripts.

### **Step 1: Set Up the Initial PMM Environment**

First, set up the environment with the *starting* version of PMM Server and Client that you want to test the upgrade from.

1.  **Clone the repositories**:

    ```bash
    git clone --branch v3 https://github.com/percona/pmm-ui-tests.git
    git clone --branch v3 https://github.com/percona/pmm-qa.git
    ```

2.  **Set up the PMM Server**:

    Start a PMM server container with a specific older version tag (e.g., `2.44.1`).

    ```bash
    cd pmm-qa/pmm-integration
    npm install
    sudo npx ts-node ./integration-setup.ts --ci --setup-docker-pmm-server --rbac --pmm-server-docker-tag=percona/pmm-server:2.44.1
    cd ../..
    ```

3.  **Set up the PMM Client and Services**:

    Install the corresponding older version of the PMM client and add some services to be monitored.

    ```bash
    sudo ./pmm-qa/pmm-tests/pmm2-client-setup.sh --pmm_server_ip 127.0.0.1 --client_version 2.44.1 --admin_password admin
    sudo ./pmm-qa/pmm-tests/pmm-framework.sh --addclient=ps,1 --pmm2 --pmm2-server-ip=127.0.0.1
    ```

### **Step 2: Run Pre-Upgrade Tests**

Before performing the upgrade, run the pre-upgrade tests. These tests capture the state of the system before the upgrade to compare it with the post-upgrade state.

```bash
cd pmm-ui-tests/playwright-tests
npm install
npx playwright install
npx playwright test --grep="@config-pre-upgrade"
cd ../..
```

### **Step 3: Perform the PMM Upgrade**

Now, perform the upgrade using one of the following methods:

#### **UI Way Upgrade**

1.  **Enable the target repository** in the PMM server container.

    ```bash
    docker exec pmm-integration-server percona-release enable-only pmm3-client dev-latest
    ```

2.  **Run the UI upgrade test**.

    ```bash
    cd pmm-ui-tests/playwright-tests
    npx playwright test --grep="@pmm-upgrade"
    cd ../..
    ```

#### **Docker Way Upgrade**

1.  **Stop and replace the PMM server container** with the new version.

    ```bash
    docker stop pmm-integration-server
    docker pull perconalab/pmm-server:3-dev-latest
    docker run --detach --restart always --network="pmm-integration-network" -p 80:80 -p 443:443 --volumes-from pmm-integration-server-data --name pmm-integration-server perconalab/pmm-server:3-dev-latest
    ```

### **Step 4: Run Post-Upgrade Tests**

After the upgrade is complete, run the post-upgrade tests to validate that everything is still working as expected.

```bash
cd pmm-ui-tests/playwright-tests
npx playwright test --grep="@config-post-upgrade"
cd ../..
```

By comparing the results of the pre-upgrade and post-upgrade tests, you can verify the success of the upgrade process.

## 📝 **How to Write Upgrade Tests**

Upgrade tests are complex and typically involve a sequence of steps across different tools and environments. They combine environment setup, UI interactions, and assertions to verify the upgrade process and data integrity.

### **Test Structure and Directory Layout**

Upgrade tests are primarily orchestrated through Playwright test files, which call out to Python scripts for environment setup and management. The relevant files are located in the `pmm-ui-tests/playwright-tests/tests/upgrade` directory and the `qa-integration/pmm_qa` directory.

```
pmm-ui-tests/
├── playwright-tests/
│   ├── tests/
│   │   └── upgrade/         # Playwright test files for upgrade scenarios
│   │       ├── basic_upgrade.spec.ts
│   │       └── ...
qa-integration/
├── pmm_qa/                  # Python scripts for environment setup
│   ├── pmm-framework.py     # Main script for setting up services
│   ├── pmm2-client-setup.sh # Script for PMM client setup
│   └── ...
```

-   **`pmm-ui-tests/playwright-tests/tests/upgrade/`**: Contains the Playwright test files (`.spec.ts`) that define the upgrade scenarios. These tests will typically navigate the PMM UI to trigger upgrades or verify post-upgrade states.
-   **`qa-integration/pmm_qa/`**: This directory holds the Python and Bash scripts (`pmm-framework.py`, `pmm2-client-setup.sh`) used to set up the initial PMM environment (server and client) at a specific version, and to manage services before and after the upgrade.

### **Writing Conventions**

-   **Orchestration**: Playwright tests act as the orchestrator, calling external scripts (e.g., Python `pmm-framework.py` via `cli.exec` or similar helper) to set up the initial PMM environment with a specific older version.
-   **Pre-Upgrade Validation**: Use Playwright to interact with the UI and verify the state of PMM *before* the upgrade. This might involve checking dashboard data, service lists, or configuration settings.
-   **Upgrade Execution**: Trigger the upgrade process. This can be done via UI interaction (e.g., clicking an upgrade button), or by executing shell commands (e.g., `docker pull` and `docker run` for Docker-based upgrades).
-   **Post-Upgrade Validation**: After the upgrade, use Playwright to verify that PMM is functioning correctly, data is preserved, and new features are available. This often involves re-running the same checks as the pre-upgrade validation and adding new ones for the upgraded version.
-   **Version Management**: Be mindful of the PMM server and client versions. Upgrade tests specifically target upgrades *from* an older version *to* a newer version.
-   **Tags**: Use `@` tags (e.g., `@config-pre-upgrade`, `@config-post-upgrade`, `@pmm-upgrade`) to categorize different phases or aspects of the upgrade tests.

### **Basic Upgrade Test Flow (Conceptual)**

```typescript
import { test, expect } from '@playwright/test';
// Assume cli helper is available for executing shell commands
import * as cli from '@helpers/cli-helper';

test.describe('PMM Upgrade Scenario', () => {
  test.beforeAll(async () => {
    // Step 1: Set up PMM Server and Client at an older version
    // This would involve calling pmm-qa/pmm-integration/integration-setup.ts
    // and qa-integration/pmm_qa/pmm2-client-setup.sh
    console.log('Setting up PMM Server and Client at older version...');
    // Example: await cli.exec('sudo npx ts-node pmm-qa/pmm-integration/integration-setup.ts --pmm-server-docker-tag=percona/pmm-server:2.41.0');
    // Example: await cli.exec('sudo pmm-qa/pmm-tests/pmm2-client-setup.sh --client_version 2.41.0');
  });

  test('should perform pre-upgrade checks', async ({ page }) => {
    // Navigate to PMM UI and perform checks before upgrade
    await page.goto('http://localhost/');
    await expect(page.locator('text=Dashboard')).toBeVisible();
    // Assertions for existing data, configurations, etc.
    // await page.locator('text=Some old feature').toBeVisible();
  });

  test('should perform UI upgrade', async ({ page }) => {
    // Navigate to upgrade section in UI
    // Click upgrade button
    // Wait for upgrade to complete
    console.log('Triggering UI upgrade...');
    // Example: await page.locator('button[data-testid="upgrade-button"]').click();
    // await page.waitForSelector('text=Upgrade Complete');
  });

  test('should perform post-upgrade checks', async ({ page }) => {
    // Navigate to PMM UI and perform checks after upgrade
    await page.goto('http://localhost/');
    await expect(page.locator('text=New Dashboard Feature')).toBeVisible();
    // Assertions for data persistence, new features, etc.
    // await page.locator('text=Some old feature').toBeVisible(); // Should still be there
  });
});
```

**Note**: The example above is conceptual and simplified. Actual upgrade tests involve more intricate setup, version management, and detailed assertions across various PMM components.

---

**Related Documentation**:
- [E2E Tests](e2e-tests.md)
- [E2E CodeceptJS Tests](e2e-codeceptjs-tests.md)
- [Infrastructure Tests](infrastructure-tests.md)
- [Integration & CLI Tests](integration-cli-tests.md)
- [Package Tests](package-tests.md)
- [Test Parameters Reference](test-parameters.md)
- [Troubleshooting Guide](troubleshooting.md)