# End-to-End (E2E) Tests

This guide provides instructions for running the PMM End-to-End (E2E) tests locally. These tests validate the PMM UI functionality and user workflows using Playwright and CodeceptJS.

## 💡 **What are E2E Tests?**

E2E tests simulate real user scenarios from start to finish, ensuring all components of the PMM UI work together correctly. They are crucial for:

- **Validating new features**: Ensuring new UI functionality works as expected.
- **Preventing regressions**: Making sure existing features are not broken by new changes.
- **Ensuring stability**: Testing the integration between the PMM server and the UI.

## 🤖 **How to Run E2E Tests Locally**

The following steps will guide you through setting up the necessary environment and running the E2E tests on your local machine. These instructions are based on the steps performed by the CI runners (`runner-e2e-tests-playwright.yml` and `runner-e2e-tests-codeceptjs.yml`).

### **Prerequisites**

-   **Git**: To clone the required repositories.
-   **Docker** and **Docker Compose**: To run the PMM server and other services.
-   **Node.js (v18+)** and **npm**: For running the test frameworks.
-   **Python 3** and **pip**: For running setup scripts.
-   **System Dependencies**: `ansible`, `clickhouse-client`, `dbdeployer`, and others.

### **Step 1: Clone Repositories**

First, clone the `pmm-ui-tests` and `qa-integration` repositories. These contain the test code and setup scripts.

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

Next, set up and start the PMM server using Docker Compose.

```bash
cd pmm-ui-tests

# Create a docker network for PMM
docker network create pmm-qa || true

# Start PMM Server
PMM_SERVER_IMAGE=perconalab/pmm-server:3-dev-latest docker compose -f docker-compose.yml up -d

# Wait for the server to be ready and change the admin password
sleep 60
docker exec pmm-server change-admin-password admin-password
docker network connect pmm-qa pmm-server || true

cd ..
```

### **Step 4: Set Up PMM Client and Services**

Now, set up the PMM client and the database services you want to monitor.

```bash
cd qa-integration/pmm_qa

# Install the PMM client
sudo bash -x pmm3-client-setup.sh --pmm_server_ip 192.168.0.1 --client_version 3-dev-latest --admin_password admin-password --use_metrics_mode no

# Set up the test environment and services (e.g., a single Percona Server instance)
python3 -m venv virtenv
source virtenv/bin/activate
pip install --upgrade pip
pip install setuptools
pip install -r requirements.txt
python3 pmm-framework.py --pmm-server-password=admin-password --database ps

cd ../..
```
**Note:** You can customize the services by changing the arguments passed to `pmm-framework.py`. For example, to set up multiple databases for inventory tests, use `--database ps --database psmdb --database pdpgsql`.

### **Step 5: Install Test Dependencies**

Install the Node.js dependencies required for the UI tests.

```bash
cd pmm-ui-tests
npm ci
npx playwright install --with-deps
```

### **Step 6: Run the Tests**

Finally, run the E2E tests. You can run specific test suites by using tags.

#### **Running Playwright Tests**

```bash
# Run the Portal test suite
npx playwright test --project="Portal" --grep="@portal"

# Run the Inventory test suite
npx playwright test --project="Chromium" --grep="@inventory"
```

#### **Running CodeceptJS Tests**

```bash
# First, generate the environment file
envsubst < env.list > env.generated.list

# Run the Backup Management test suite for MongoDB
./node_modules/.bin/codeceptjs run -c pr.codecept.js --grep="@bm-mongo"
```

## 📋 **Available Test Suites**

Here are some of the main test suites you can run:

| Test Suite | Tag | Framework | Description |
|---|---|---|---|
| Portal | `@portal` | Playwright | Tests the main PMM Portal functionality. |
| Inventory | `@inventory` | Playwright | Tests the service inventory management pages. |
| Backup Management (Mongo) | `@bm-mongo` | CodeceptJS | Tests backup and restore for MongoDB. |
| Exporters | `@exporters` | CodeceptJS | Validates various exporters. |
| Settings | `@settings` | CodeceptJS | Tests the PMM settings and configuration pages. |

## 📝 **How to Write Playwright Tests**

All paths mentioned in this section are relative to the root of the `pmm-ui-tests` repository, which can be found [here](https://github.com/percona/pmm-ui-tests/tree/v3).

Playwright tests are written in TypeScript and use a clear, readable syntax. Tests are typically organized into `describe` blocks for test suites and `test` blocks for individual test cases.

### **Test Structure and Directory Layout**

Playwright tests for PMM UI are located in the `pmm-ui-tests/playwright-tests` directory. Within this directory, tests are organized by feature or functional area. For example:

```
pmm-ui-tests/
├── playwright-tests/
│   ├── pages/             # Page Object Model definitions
│   │   ├── LoginPage.ts
│   │   └── DashboardPage.ts
│   │   └── ServicesPage.ts
│   ├── tests/             # Actual test files
│   │   ├── login.spec.ts
│   │   └── inventory.spec.ts
│   ├── fixtures/          # Test data or reusable components
│   └── playwright.config.ts # Playwright configuration
```

-   **`pages/`**: This directory typically contains Page Object Model (POM) files. POM is a design pattern that helps create an object repository for UI elements within the application. Each page in the web application has a corresponding Page Object class, which contains methods that perform interactions on that web page.
-   **`tests/`**: This is where the actual test files (`.spec.ts`) reside. Each file usually contains tests for a specific feature or a logical group of functionalities.
-   **`fixtures/`**: This directory can be used for test data, custom fixtures, or reusable test components.
-   **`playwright.config.ts`**: This file configures Playwright, including projects, reporters, and global setup/teardown.

### **Writing Conventions**

-   **Descriptive Naming**: Test files and test blocks should have clear, descriptive names that indicate their purpose (e.g., `login.spec.ts`, `test.describe('Login Page')`).
-   **Page Object Model (POM)**: Utilize the Page Object Model for interacting with UI elements. This improves test readability, maintainability, and reduces code duplication.
-   **Assertions**: Use `expect` assertions to verify the state of the UI. Be specific with your assertions.
-   **Tags**: Use `@` tags in `test.describe` or `test` blocks to categorize tests (e.g., `@portal`, `@inventory`). These tags are used to run specific subsets of tests.
-   **Comments**: Add comments to explain complex logic or the *why* behind certain actions, rather than just *what* is being done.

### **Basic Test Example**

Here's an example demonstrating how to navigate to the Inventory page and verify a service:

```typescript
import { test, expect } from '@playwright/test';
import { ServicesPage } from './pages/ServicesPage'; // Assuming ServicesPage is defined

test.describe('PMM Inventory', () => {
  let servicesPage: ServicesPage;

  test.beforeEach(async ({ page }) => {
    servicesPage = new ServicesPage(page);
    await page.goto(servicesPage.url); // Navigate to the Inventory page URL
    await servicesPage.verifyPageLoaded(); // Custom method to wait for page to load
  });

  test('should verify local MongoDB service presence', async () => {
    const serviceName = 'mo-integration-'; // Example service name
    await servicesPage.servicesTable.verifyService({ serviceName }); // Custom method to verify service in a table
  });

  test('should verify kebab menu options for MongoDB service', async () => {
    const serviceName = 'mo-integration-';
    await servicesPage.servicesTable.buttons.options(serviceName).click();
    await expect(servicesPage.servicesTable.buttons.deleteService).toBeVisible();
    await expect(servicesPage.servicesTable.buttons.serviceDashboard).toBeVisible();
    await expect(servicesPage.servicesTable.buttons.qan).toBeVisible();
  });
});
```

### **Key Concepts**

-   **`test` object**: Used for defining tests, test suites, and hooks.
-   **`page` object**: Represents a browser tab, used for navigation and interaction.
-   **Locators**: Methods to find elements on the page (e.g., `page.locator('input[name="username"]')`).
-   **`expect` object**: Used for making assertions about the UI state.
-   **`await` keyword**: Essential for asynchronous Playwright operations.
-   **Page Object Model (POM)**: A design pattern where web pages are represented as classes, abstracting UI elements and interactions. This improves test readability and maintainability.

### **Running New Tests**

After creating a new test file, you can run it using the `npx playwright test` command, specifying the path to your test file or using a `grep` pattern for its title or tags.

```bash
cd pmm-ui-tests
npx playwright test playwright-tests/my-new-test.spec.ts
# Or with a grep pattern
npx playwright test --grep="@my-new-feature"
```

---

**Related Documentation**:
- [Integration & CLI Tests](integration-cli-tests.md)
- [Infrastructure Tests](infrastructure-tests.md)
- [Package Tests](package-tests.md)
- [Upgrade Tests](upgrade-tests.md)
- [Test Parameters Reference](test-parameters.md)
- [Troubleshooting Guide](troubleshooting.md)