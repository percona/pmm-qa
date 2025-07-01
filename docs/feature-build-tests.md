# Feature Build Tests

This guide provides instructions for running the PMM Feature Build (FB) tests locally. These tests are designed to validate Docker images built with new features before they are merged into the main codebase.

## 💡 **What are Feature Build Tests?**

Feature Build tests are comprehensive UI testing suites that validate new features in PMM. They ensure that:

- **New features work correctly**: Verifying that the new functionality behaves as expected.
- **There are no regressions**: Ensuring that existing functionality is not broken by the new feature.
- **The UI remains consistent**: Checking that the new feature integrates well with the existing UI.

## 🤖 **How to Run Feature Build E2E Tests Locally**

You can reproduce the CI runner workflow for Feature Build E2E tests on your local machine. This is useful for debugging, development, or validating changes before pushing to CI. The steps below mirror what happens in the CI runner, with local commands and explanations.

### **Prerequisites**
- **Docker** and **Docker Compose** installed
- **Node.js** (v18+) and **npm**
- **Python 3** and **pip**
- **Ansible**, **Clickhouse client**, and other system dependencies (see below)
- Sufficient disk space and permissions to run containers

#### **Step-by-Step Local Execution (CI Runner Steps)**

1. **Clone the Required Repositories**
   
   Clone both the UI tests and QA integration repositories at the correct branch:
   ```bash
   git clone --branch v3 https://github.com/percona/pmm-ui-tests.git
   git clone --branch v3 https://github.com/Percona-Lab/qa-integration.git
   ```

2. **Install System Dependencies**
   
   Install all required system packages and tools (Ansible, Clickhouse client, dbdeployer, etc):
   ```bash
   sudo apt-get update
   sudo apt-get install -y apt-transport-https ca-certificates dirmngr ansible libaio1 libaio-dev libnuma-dev libncurses5 socat sysbench clickhouse-client
   curl -s https://raw.githubusercontent.com/datacharmer/dbdeployer/master/scripts/dbdeployer-install.sh | sudo bash -s -- -b /usr/local/bin
   ```

3. **Clean Up Disk Space (Optional, but recommended)**
   
   Free up space on your system to avoid issues with large Docker images:
   ```bash
   sudo rm -rf /usr/share/dotnet /opt/ghc "/usr/local/share/boost"
   ```

4. **Start PMM Server with Docker Compose**
   
   This step sets up the PMM Server container, changes the admin password, and runs initial DB setup scripts:
   ```bash
   cd pmm-ui-tests
   docker network create pmm-qa || true
   PMM_SERVER_IMAGE=perconalab/pmm-server-fb:feature-xyz docker compose -f docker-compose.yml up -d
   sleep 60
   docker exec pmm-server change-admin-password admin-password
   bash -x testdata/db_setup.sh
   docker network connect pmm-qa pmm-server || true
   cd ..
   ```

5. **Set Up PMM Client**
   
   This step configures the PMM Client to connect to your local PMM Server. First, dynamically retrieve the PMM Server container's IP address and export it as an environment variable:
   ```bash
   export PMM_SERVER_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' pmm-server)
   cd qa-integration/pmm_qa
   sudo bash -x pmm3-client-setup.sh --pmm_server_ip $PMM_SERVER_IP --client_version 3-dev-latest --admin_password admin-password --use_metrics_mode no
   cd ../..
   ```

6. **Prepare Python Environment and Run Setup**
   
   This step prepares the test environment and configures databases/services as needed for the test suite. Replace `[SETUP_ARGS]` with the appropriate setup string, e.g. `--database psmdb,SETUP_TYPE=pss`:
   ```bash
   cd qa-integration/pmm_qa
   mkdir -m 777 -p /tmp/backup_data
   python3 -m venv virtenv
   source virtenv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   pip install setuptools
   python pmm-framework.py --pmm-server-password=admin-password --verbose [SETUP_ARGS]
   cd ../..
   ```

7. **Install Node.js Dependencies for UI Tests**
   
   Installs all required Node.js modules and Playwright browser dependencies for UI testing:
   ```bash
   cd pmm-ui-tests
   npm ci
   npx playwright install --with-deps
   envsubst < env.list > env.generated.list
   ```

### **Step 8: Run the Tests**

Finally, run the E2E tests for the specific feature. Use the appropriate tag for the test suite you want to run.

```bash
# Example for MongoDB backup management tests:
./node_modules/.bin/codeceptjs run -c pr.codecept.js --grep "@bm-mongo"

# Example for exporter tests:
./node_modules/.bin/codeceptjs run -c pr.codecept.js --grep "@exporters"
```

## 📋 **Available Test Suites**

| Test Suite | Test Tag(s) | Description |
|---|---|---|
| Backup Management | `@bm-mongo`, `@bm-locations` | Tests for backup and restore functionality. |
| Exporters | `@exporters`, `@mongodb-exporter` | Tests for various exporters. |
| UI Components | `@fb-instances`, `@fb-alerting` | Tests for different UI components. |
| PostgreSQL Monitoring | `@pgsm-pmm-integration` | Tests for pg_stat_monitor integration. |

## 📝 **How to Write Feature Build Tests**

Feature Build tests are essentially End-to-End (E2E) UI tests that focus on validating new features. Therefore, the principles and practices for writing these tests are the same as for general E2E UI tests.

-   For writing **Playwright** tests, refer to the [How to Write Playwright Tests](e2e-tests.md#how-to-write-playwright-tests) section in the E2E Tests documentation.
-   For writing **CodeceptJS** tests, refer to the [How to Write CodeceptJS Tests](e2e-codeceptjs-tests.md#how-to-write-codeceptjs-tests) section in the E2E CodeceptJS Tests documentation.

When writing Feature Build tests, pay special attention to:

-   **Targeting new features**: Ensure your tests specifically cover the new functionality.
-   **Regression prevention**: Include checks for existing features that might be affected by the new changes.
-   **Using appropriate tags**: Tag your tests with relevant `@fb-` tags (e.g., `@fb-instances`, `@fb-alerting`) to categorize them as feature build tests.

---

**Related Documentation**:
- [E2E Tests](e2e-tests.md)
- [Integration & CLI Tests](integration-cli-tests.md)
- [Package Tests](package-tests.md)
- [Upgrade Tests](upgrade-tests.md)
- [Test Parameters Reference](test-parameters.md)
- [Troubleshooting Guide](troubleshooting.md)
