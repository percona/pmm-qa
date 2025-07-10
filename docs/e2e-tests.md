# E2E CodeceptJS Tests

This guide provides instructions for running the PMM E2E tests that use the CodeceptJS framework. These tests cover a wide range of scenarios, including SSL, experimental features, and more.

## 💡 **What are E2E CodeceptJS Tests?**

These tests are designed to validate specific and advanced PMM functionalities. They ensure that:

- **SSL connections are secure**: Verifying that PMM can connect to databases over SSL.
- **Experimental features are stable**: Testing features that are not yet released to the general public.
- **Core functionality is robust**: Covering scenarios like disconnecting and reconnecting services.
- **Etc..**

## 🤖 **How to Run E2E CodeceptJS Tests Locally**

The following steps will guide you through setting up the environment and running the CodeceptJS tests locally, based on the `e2e-codeceptjs-matrix.yml` CI workflow.

### **Prerequisites**

- **Git**: To clone the required repositories.
- **Docker** and **Docker Compose**: To run the PMM server and other services.
- **Node.js (v20+)** and **npm**: For running the test frameworks.
- **Python 3** and **pip**: For running setup scripts.
- **System Dependencies**: `ansible`, `clickhouse-client`, `dbdeployer`, and others.

### **Step 1: Clone Repositories**

First, clone the `pmm-ui-tests` and `qa-integration` repositories. These contain the test code and setup scripts.

```bash
git clone --branch v3 https://github.com/percona/pmm-ui-tests.git
git clone --branch v3 https://github.com/Percona-Lab/qa-integration.git
```

### **Step 2: Set Up PMM Server**

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

### **Step 3: Set Up Required Services**

Now, set up the PMM client and the database services you want to monitor.

```bash
cd qa-integration/pmm_qa

# Set up the test environment and services (e.g., a single Percona Server instance)
python3 -m venv virtenv
source virtenv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
python pmm-framework.py --pmm-server-password=admin-password --database ps

cd ../..
```
**Note:** You can customize the services by changing the arguments passed to `pmm-framework.py`. For example, to set up multiple databases for inventory tests, use `--database ps --database psmdb --database pdpgsql`.

### **Step 4: Install Test Dependencies**

Install the Node.js dependencies required for the UI tests.

```bash
cd pmm-ui-tests
npm ci
npx playwright install --with-deps
```

### **Step 5: Run the Tests**

Run the CodeceptJS tests using the appropriate tags. The setup for the services will vary depending on the test.

#### **SSL Tests**

```bash
# Set up the environment for MySQL SSL tests
python qa-integration/pmm_qa/pmm-framework.py --pmm-server-password=admin-password --database ssl_mysql

# Run the MySQL SSL tests
./node_modules/.bin/codeceptjs run -c pmm-ui-tests/pr.codecept.js --grep "@ssl-mysql"
```

#### **Experimental Tests**

```bash
# Set up the environment for experimental tests
python qa-integration/pmm_qa/pmm-framework.py --pmm-server-password=admin-password --database pdpgsql

# Run the experimental tests
./node_modules/.bin/codeceptjs run -c pmm-ui-tests/pr.codecept.js --grep "@experimental"
```

## 📋 **Available Test Suites**

### **Core E2E CodeceptJS Matrix Test Suites**

| Test Suite | Test Tag(s) | Description |
|---|---|---|
| Settings and CLI | `@settings\|@cli` | General settings and CLI tests. |
| SSL Tests | `@ssl-mysql`, `@ssl-mongo`, `@ssl-postgres` | Tests for SSL connections to different databases. |
| Experimental | `@experimental` | Tests for experimental features. |
| Disconnect | `@disconnect` | Tests for disconnecting and reconnecting services. |
| Backup Management MongoDB | `@bm-mongo` | MongoDB backup and restore functionality. |
| Backup Management Common | `@bm-locations` | Backup location management and common features. |
| Exporters | `@exporters` | Various exporter functionality tests. |
| MongoDB Exporter | `@mongodb-exporter` | MongoDB-specific exporter tests. |
| Instances | `@fb-instances` | Instance management UI tests. |
| Alerting and Settings | `@fb-alerting\|@fb-settings` | Alerting and settings UI components. |
| User and Password | `@user-password` | User authentication with changed password. |
| PGSM Integration | `@pgsm-pmm-integration` | PostgreSQL pg_stat_monitor integration. |
| PGSS Integration | `@pgss-pmm-integration` | PostgreSQL pg_stat_statements integration. |
| PSMDB Replica | `@pmm-psmdb-replica-integration` | MongoDB replica set integration. |
| PSMDB Arbiter | `@pmm-psmdb-arbiter-integration` | MongoDB arbiter replica integration. |
| Dump Tool | `@dump` | Database dump tool functionality. |
| Service Account | `@service-account` | Service account management tests. |
| PS Integration | `@fb-pmm-ps-integration` | Percona Server integration tests. |
| RBAC | `@rbac` | Role-based access control tests. |
| Encryption | `@fb-encryption` | Encryption functionality tests. |
| Docker Configuration | `@docker-configuration` | Docker configuration tests. |
| Nomad | `@nomad` | Nomad orchestration tests. |

### **Jenkins E2E CodeceptJS Test Suites**
| Test Suite | Test Tag(s) | Description |
|---|---|---|
| Query Analytics | `@qan` | Tests for QAN features. |
| Dashboards | `@nightly`, `@dashboards` | Tests that make sure Dashboards have data. |
| Alerting | `@ia` | Alerting tests. |
| Remote instances | `@instances` | Tests for AWS and Azure integration. |
| GCP Remote instances | `@gcp` | Tests for GCP integration. |

## 📝 **How to Write CodeceptJS Tests**

All paths mentioned in this section are relative to the root of the `pmm-ui-tests` repository, which can be found [here](https://github.com/percona/pmm-ui-tests/tree/v3).

CodeceptJS tests are written in JavaScript and provide a high-level, readable syntax for UI interactions. They are built on top of WebDriver or Playwright and use a BDD-style syntax.

### **Test Structure and Directory Layout**

CodeceptJS tests for PMM UI are primarily located in the `pmm-ui-tests/tests` directory. Tests are organized by feature or functional area.

```
pmm-ui-tests/
├── tests/                 # Actual test files
│   ├── pages/             # Page Object Model definitions
│   │   ├── LoginPage.js
│   │   └── DashboardPage.js
│   ├── login_test.js
│   ├── inventory_test.js
├── helpers/               # Custom helpers for common actions
├── config/                # Configuration files
└── pr.codecept.js         # Main CodeceptJS configuration
```

-   **`tests/`**: This directory contains the main test files (`_test.js`). Each file typically covers a specific feature or a logical group of functionalities.
-   **`pages/`**: Similar to Playwright, CodeceptJS also supports the Page Object Model. This directory holds page object definitions, abstracting UI interactions.
-   **`helpers/`**: Custom helpers can be created to encapsulate common actions or assertions, promoting reusability.
-   **`pr.codecept.js`**: This is the primary configuration file for CodeceptJS, defining helpers, plugins, and test paths.

### **Writing Conventions**

-   **BDD Style**: Tests are written using `Scenario` and `I` (the actor) to describe user interactions in a readable way.
-   **Page Objects**: Utilize Page Objects for interacting with UI elements to improve maintainability.
-   **Tags**: Use `@` tags in `Scenario` or `Feature` blocks to categorize tests (e.g., `@bm-mongo`, `@exporters`). These tags are used for selective test execution.
-   **Comments**: Add comments for complex logic or to explain the *why* behind certain steps.

### **Basic Test Example**

A typical CodeceptJS test file (`_test.js`) will look like this:

```javascript
Feature('Login');

Scenario('should display login form', ({ I }) => {
  I.amOnPage('http://localhost/');
  I.seeElement('input[name="username"]');
  I.seeElement('input[name="password"]');
  I.seeElement('button[type="submit"]');
});

Scenario('should allow user to login', ({ I }) => {
  I.amOnPage('http://localhost/');
  I.fillField('input[name="username"]', 'admin');
  I.fillField('input[name="password"]', 'admin');
  I.click('button[type="submit"]');
  I.see('Dashboard');
});
```

### **Key Concepts**

-   **`Feature`**: Defines a test suite.
-   **`Scenario`**: Represents an individual test case.
-   **`I` (the actor)**: The global object for performing UI actions (e.g., `I.amOnPage()`, `I.click()`).
-   **Helpers**: Provide methods for `I` to interact with the browser.
-   **Tags**: Used for categorizing and selectively running tests.

### **Running New Tests**

After creating a new test file, you can run it using the `codeceptjs run` command, specifying the path to your test file or using a `grep` pattern for its title or tags.

```bash
cd pmm-ui-tests
./node_modules/.bin/codeceptjs run -c pr.codecept.js tests/my_new_feature_test.js
# Or with a grep pattern
./node_modules/.bin/codeceptjs run -c pr.codecept.js --grep="@my-new-feature"
```

---

**Related Documentation**:
- [Feature Build Tests](feature-build-tests.md)
- [Integration & CLI Tests](integration-cli-tests.md)
- [Test Parameters Reference](test-parameters.md)
- [Troubleshooting Guide](troubleshooting.md)