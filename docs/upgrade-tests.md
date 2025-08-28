# Upgrade Tests

This guide provides instructions for running the PMM upgrade tests locally. These tests validate the PMM upgrade process, ensuring data integrity and functionality are maintained across versions.

## 💡 **What are Upgrade Tests?**

Upgrade tests are critical for ensuring a smooth user experience when new versions of PMM are released. They verify that:

- **The upgrade process is successful**: Whether using the UI, Docker, or Podman, the upgrade completes without errors.
- **Data is preserved**: All historical monitoring data, user configurations, and settings are maintained after the upgrade.
- **Functionality remains intact**: All features of PMM, from monitoring and alerting to QAN, continue to work correctly.

## 🤖 **How to Run Upgrade Tests Locally**


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


3.  **Set up the PMM Client and Services**:


### **Step 2: Run Pre-Upgrade Tests**

Before performing the upgrade, run the pre-upgrade tests. These tests capture the state of the system before the upgrade to compare it with the post-upgrade state.


### **Step 3: Perform the PMM Upgrade**

1.  **Stop and replace the PMM server container** with the new version.

    ```bash
    docker stop pmm-integration-server
    docker pull perconalab/pmm-server:3-dev-latest
    docker run --detach --restart always --network="pmm-integration-network" -p 80:80 -p 443:443 --volumes-from pmm-integration-server-data --name pmm-integration-server perconalab/pmm-server:3-dev-latest
    ```

### **Step 4: Run Post-Upgrade Tests**

After the upgrade is complete, run the post-upgrade tests to validate that everything is still working as expected.

By comparing the results of the pre-upgrade and post-upgrade tests, you can verify the success of the upgrade process.

## 📝 **How to Write Upgrade Tests**

Upgrade tests are complex and typically involve a sequence of steps across different tools and environments. They combine environment setup, UI interactions, and assertions to verify the upgrade process and data integrity.

### **Test Structure and Directory Layout**

### **Writing Conventions**

-   **Orchestration**: Playwright tests act as the orchestrator, calling external scripts (e.g., Python `pmm-framework.py` via `cli.exec` or similar helper) to set up the initial PMM environment with a specific older version.
-   **Pre-Upgrade Validation**: 
-   **Upgrade Execution**: Execute the upgrade process by replacing the PMM server container with the new version, ensuring all services are restarted and functional.
-   **Post-Upgrade Validation**: 
-   **Version Management**:
-   **Tags**: 

---

**Related Documentation**:
- [E2E Tests](e2e-tests.md)
- [Infrastructure Tests](infrastructure-tests.md)
- [Integration & CLI Tests](integration-cli-tests.md)
- [Package Tests](package-tests.md)
- [Test Parameters Reference](test-parameters.md)
- [Troubleshooting Guide](troubleshooting.md)