# Infrastructure Tests

This guide provides instructions for running the PMM infrastructure tests locally. These tests validate PMM deployments in various environments, including Kubernetes/Helm and simplified installations using the Easy Install script.

## 💡 **What are Infrastructure Tests?**

Infrastructure tests are designed to ensure that PMM can be deployed and configured correctly in different environments. They cover:

- **Kubernetes/Helm**: Validating PMM deployment using Helm charts on a Kubernetes cluster.
- **Easy Install - not automated**: Testing the simplified installation script on various supported operating systems.

## 🤖 **How to Run Infrastructure Tests Locally**

### **Helm Tests (Kubernetes)**

These steps will guide you through setting up a local Kubernetes cluster using Minikube and deploying PMM with Helm.

#### **Prerequisites**

- **Minikube**: For running a local Kubernetes cluster.
- **kubectl**: The Kubernetes command-line tool.
- **Helm**: The package manager for Kubernetes.

#### **Step 1: Start Minikube**

Start a Minikube cluster. This will create a local single-node Kubernetes cluster. Disable the default storage provisioner and enable the CSI hostpath driver for persistent storage.

```bash
minikube delete && \
  minikube start && \
  minikube addons disable storage-provisioner && \
  kubectl delete storageclass standard && \
  minikube addons enable csi-hostpath-driver && \
  minikube addons enable volumesnapshots && \
  kubectl patch storageclass csi-hostpath-sc -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}' &&\
  kubectl wait --for=condition=Ready node --timeout=90s minikube
```

#### **Step 2: Run Helm Tests**

Clone the `pmm-qa` repository and run the Helm tests using `bats`.

```bash
git clone https://github.com/percona/pmm-qa.git
cd pmm-qa/k8s

# Set up bats (BASH Automated Testing System)
sudo ./setup_bats_libs.sh

# Run the tests
SERVER_IMAGE=perconalab/pmm-server:3-dev-latest bats --tap helm-test.bats
```

### **Easy Install Tests - not automated**

These steps will show you how to test the Easy Install script on a supported operating system.

#### **Prerequisites**

- A clean installation of a supported OS (e.g., Ubuntu 24.04, Oracle Linux 9, Rocky Linux 9).
- `curl` or `wget` to download the script.

#### **Step 1: Download the Script**

Download the Easy Install script from the Percona website.

```bash
curl -fsSL https://www.percona.com/get/pmm > pmm-installer.sh
```

#### **Step 2: Run the Script**

Execute the script with `bash`. The script will automatically detect the OS and install PMM.

```bash
sudo bash pmm-installer.sh
```

#### **Step 3: Validate the Installation**

After the script finishes, you can check the status of the PMM server and other components.

```bash
docker ps -a
```

You should see the `pmm-server` and `watchtower` containers running.

## 📝 **How to Write Helm Tests**

All paths mentioned in this section are relative to the root of the `pmm-qa` repository, which can be found [here](https://github.com/percona/pmm-qa/tree/v3).

Helm tests in this project are written using Bats (Bash Automated Testing System). **Note**: This is different from the deprecated BATS tests in `pmm-tests/` - Helm-specific BATS tests in `k8s/` directory are still actively maintained for Kubernetes testing. Bats provides a simple way to test shell scripts and command-line tools. Helm tests typically involve deploying a Helm chart and then asserting on the state of the Kubernetes resources or the behavior of the deployed application.

### **Test Structure and Directory Layout**

Helm tests are located in the `pmm-qa/k8s` directory.

```
pmm-qa/
├── k8s/
│   ├── helm-test.bats     # Main Bats test file for Helm
│   ├── k8s_helper.sh      # Helper functions for Kubernetes interactions
│   ├── pmm_helper.sh      # Helper functions for PMM-specific actions
│   └── setup_bats_libs.sh # Script to set up Bats libraries
```

-   **`helm-test.bats`**: This is the main Bats test file. It contains the test cases for deploying PMM using Helm and verifying its functionality.
-   **`k8s_helper.sh`**: This script contains reusable Bash functions for interacting with Kubernetes, such as checking pod status, deploying resources, and running `kubectl` commands.
-   **`pmm_helper.sh`**: This script provides helper functions specific to PMM, such as checking PMM server status or client registration.

### **Writing Conventions**

-   **Bats Syntax**: Tests are written using Bats syntax, which is essentially Bash scripting with special Bats commands for defining tests (`@test`), assertions (`run`, `assert_success`, `assert_output`), and setup/teardown (`setup`, `teardown`).
-   **Helper Functions**: Utilize helper functions in `k8s_helper.sh` and `pmm_helper.sh` to abstract complex Kubernetes and PMM interactions. This promotes reusability and readability.
-   **Clear Assertions**: Assertions should clearly define the expected outcome of a command or the state of a resource.
-   **Test Isolation**: Each test should aim to be as isolated as possible, cleaning up resources after execution to prevent interference.

### **Basic Helm Test Example**

A typical Bats test in `helm-test.bats` might look like this:

```bash
#!/usr/bin/env bats

load 'test_helper/bats-support/load'
load 'test_helper/bats-assert/load'

@test "PMM Helm chart deploys successfully" {
  run helm install my-pmm ./pmm-helm-chart
  assert_success
  assert_output --partial "STATUS: deployed"

  run kubectl get pods -l app.kubernetes.io/instance=my-pmm
  assert_success
  assert_output --partial "pmm-server"
}

@test "PMM server is reachable after deployment" {
  run kubectl get service my-pmm-server -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
  assert_success
  PMM_IP="$output"

  # Assuming a simple ping endpoint for demonstration
  run curl -s "http://$PMM_IP/ping"
  assert_success
  assert_output "PMM Server is running"
}
```

During the development you may want to run only test you're working on. To achieve this you need to add comment `#bats test_tags=bats:focus` above the test annotation


```bash
#bats test_tags=bats:focus
@test "PMM server is reachable after deployment" {
  run kubectl get service my-pmm-server -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
  assert_success
  PMM_IP="$output"

  run curl -s "http://$PMM_IP/ping"
  assert_success
  assert_output "PMM Server is running"
}
```

**Note**: The actual `helm-test.bats` file in the project will be more complex, involving detailed setup, deployment, and validation steps specific to PMM. The example above is simplified to illustrate the basic structure.

---

**Related Documentation**:
- [E2E Tests](e2e-tests.md)
- [Integration & CLI Tests](integration-cli-tests.md)
- [Package Tests](package-tests.md)
- [Upgrade Tests](upgrade-tests.md)
- [Test Parameters Reference](test-parameters.md)
- [Troubleshooting Guide](troubleshooting.md)