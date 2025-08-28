# Package Tests

This guide provides instructions for running the PMM client package installation tests locally. These tests validate that PMM client packages install and function correctly on various supported operating systems and configurations.

## 💡 **What are Package Tests?**

Package tests are designed to verify the PMM client installation process from start to finish. They ensure:

- **Platform Compatibility**: That packages install correctly on all supported Linux distributions (Debian, Ubuntu, RHEL, etc.).
- **Installation Scenarios**: That different installation types, such as standard, custom path, and tarball, all work as expected.
- **Package Integrity**: That the packages themselves are not corrupt and contain all the necessary files and dependencies.

## 🤖 **How to Run Package Tests Locally**

The following steps will guide you through setting up a virtualized environment using Vagrant and running the package tests with Ansible, mirroring the process used in the `runner-package-test.yml` CI workflow.

### **Prerequisites**

- **Git**: To clone the required repositories.
- **Docker**: To run the PMM server.
- **Vagrant**: To create and manage virtual machine environments.
- **VirtualBox** (or another Vagrant provider): To run the virtual machines.
- **Ansible**: To automate the test execution within the VM.

### **Step 1: Clone the `package-testing` Repository**

First, clone the `package-testing` repository, which contains the Ansible playbooks for the tests.

```bash
git clone https://github.com/Percona-QA/package-testing.git
cd package-testing
```

### **Step 2: Set Up PMM Server**

Before running the client installation tests, you need a running PMM server for the client to connect to. Start one using Docker.

```bash
docker create -v /srv --name pmm-server-data perconalab/pmm-server:3-dev-latest
docker run -d -p 80:80 -p 443:8443 --volumes-from pmm-server-data --name pmm-server --restart always perconalab/pmm-server:3-dev-latest
timeout 240 bash -c 'while [[ "$(curl -k -s -o /dev/null -w '%{http_code}' https://127.0.0.1:443/v1/readyz)" != "200" ]]; do sleep 2; done' || false
```

### **Step 3: Configure and Run Vagrant**

Vagrant will create a clean VM, install the necessary dependencies, and run the Ansible playbook to perform the test.

1.  **Create a `Vagrantfile`**: Create a file named `Vagrantfile` in the `package-testing` directory with the following content. This example is for Ubuntu 22.04 (Jammy).

    ```ruby
    Vagrant.require_version ">= 1.7.0"
    Vagrant.configure(2) do |config|
      # Use a specific OS box for the test
      config.vm.box = "generic/ubuntu2204"

      config.ssh.insert_key = false
      config.vm.define :CLIENT_TEST

      # Sync the current directory to the VM
      config.vm.synced_folder ".", "/package-testing/"

      # Provision the VM with a shell script
      config.vm.provision "shell", privileged: true, inline: <<-SHELL
        # Set environment variables for the test
        export PMM_SERVER_IP=10.0.2.2:443
        export METRICS_MODE=auto
        export install_repo=experimental
        export install_package=pmm3-client

        # Install Ansible
        apt-get update -y
        apt-get install -y software-properties-common
        apt-add-repository --yes --update ppa:ansible/ansible
        apt-get install -y ansible git wget

        # Run the Ansible playbook for the test
        cd /package-testing/playbooks
        ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 pmm3-client_integration.yml
      SHELL
    end
    ```

2.  **Run Vagrant**: Start the VM and the provisioning process.

    ```bash
    vagrant up
    ```

### **Customizing Your Test**

-   **To test a different OS**: Change `config.vm.box` in the `Vagrantfile` to another supported box (e.g., `generic/debian11`, `generic/oracle9`). You may also need to adjust the Ansible installation commands for different package managers (e.g., `yum` or `dnf`).
-   **To run a different test scenario**: Change the playbook file in the `ansible-playbook` command (e.g., to `pmm3-client_integration_custom_path.yml`).

## 🚀 **Feature Build Tarball Suite**

The Feature Build Tarball Suite (`fb-tarball-suite.yml`) is used to test feature builds of the PMM client distributed as a tarball. It runs the package tests against a specified tarball URL.

To run these tests locally, follow the same steps as above, but in the `Vagrantfile`, set the `TARBALL_LINK` environment variable to the URL of the feature build tarball:

```ruby
# ... (Vagrantfile content) ...
      config.vm.provision "shell", privileged: true, inline: <<-SHELL
        # Set environment variables for the test
        export PMM_SERVER_IP=10.0.2.2:443
        export TARBALL_LINK="https://example.com/pmm-client-feature-xyz.tar.gz"

        # ... (rest of the script) ...
      SHELL
# ... (Vagrantfile content) ...
```

Replace `https://example.com/pmm-client-feature-xyz.tar.gz` with the actual URL of the feature build tarball.

## 📝 **How to Write Package Tests (Ansible)**

All paths mentioned in this section are relative to the root of the `package-testing` repository, which can be found [here](https://github.com/Percona-QA/package-testing/tree/v3).

Package tests are primarily written as Ansible playbooks. Ansible allows for declarative definition of system states and automates the installation, configuration, and validation of software packages across various operating systems.

### **Test Structure and Directory Layout**

Ansible playbooks for package testing are located in the `package-testing/playbooks` directory. Each playbook (`.yml`) defines a specific test scenario (e.g., standard installation, custom path installation).

```
package-testing/
├── playbooks/             # Ansible playbooks for different test scenarios
│   ├── pmm3-client_integration.yml
│   ├── pmm3-client_integration_custom_path.yml
│   └── ...
├── roles/                 # Reusable Ansible roles
│   ├── pmm-client/        # Role for PMM client installation and configuration
│   └── ...
├── inventory.ini          # Ansible inventory file (defines hosts)
└── Vagrantfile            # Vagrant configuration for test VMs
```

-   **`playbooks/`**: Contains the main Ansible playbooks. Each playbook orchestrates a series of tasks to perform a specific package test scenario.
-   **`roles/`**: Contains reusable Ansible roles. Roles encapsulate a set of tasks, variables, and handlers for a specific purpose (e.g., installing and configuring the PMM client).
-   **`inventory.ini`**: Defines the hosts that Ansible will manage. In local testing with Vagrant, this typically points to the local VM.
-   **`Vagrantfile`**: Configures the virtual machine environment where the Ansible playbooks will be executed.

### **Writing Conventions**

-   **Declarative Style**: Ansible playbooks are declarative, describing the desired state rather than the steps to achieve it.
-   **Idempotency**: Playbooks should be idempotent, meaning running them multiple times will have the same result as running them once.
-   **Roles**: Utilize Ansible roles to organize tasks, variables, and handlers into logical, reusable units.
-   **Variables**: Use variables to make playbooks flexible and reusable across different environments or test scenarios.
-   **Assertions**: Use Ansible's `assert` module or conditional tasks to validate the success of installation steps and the state of the system.

### **Basic Ansible Playbook Example**

A simplified Ansible playbook (`pmm3-client_integration.yml`) might look like this:

```yaml
---
- name: Install PMM Client (Standard Integration)
  hosts: all
  become: yes
  vars:
    pmm_server_ip: "{{ lookup('env', 'PMM_SERVER_IP') }}"
    metrics_mode: "{{ lookup('env', 'METRICS_MODE') }}"
    install_repo: "{{ lookup('env', 'install_repo') }}"
    install_package: "{{ lookup('env', 'install_package') }}"

  tasks:
    - name: Ensure Percona repository is configured
      ansible.builtin.shell: |-
        curl -fsSL https://www.percona.com/get/percona-release | bash
        percona-release enable-only {{ install_package }} {{ install_repo }}

    - name: Install PMM Client package
      ansible.builtin.package:
        name: "{{ install_package }}"
        state: present
        update_cache: yes

    - name: Configure PMM Client to connect to PMM Server
      ansible.builtin.command: |-
        pmm-admin config --server-url=https://{{ pmm_server_ip }}:443 --server-username=admin --server-password=admin

    - name: Add MySQL service
      ansible.builtin.command: |-
        pmm-admin add mysql --query-source=perfschema --username=root --password=root

    - name: Verify PMM Client status
      ansible.builtin.command: pmm-admin status
      register: pmm_status
      until: pmm_status.stdout.find("PMM Client is running") != -1
      retries: 10
      delay: 10

    - name: Assert MySQL service is added
      ansible.builtin.command: pmm-admin list
      register: pmm_list
      failed_when: pmm_list.stdout.find("mysql") == -1
```

### **Key Concepts**

-   **Playbook**: The entry point for an Ansible run, defining the hosts to target and the tasks to execute.
-   **Hosts**: Specifies which machines the playbook will run against (e.g., `all` for all hosts in the inventory, or a specific group).
-   **`become: yes`**: Instructs Ansible to escalate privileges (e.g., use `sudo`) for tasks that require root access.
-   **`vars`**: Defines variables that can be used within the playbook. These can be sourced from environment variables (`lookup('env', ...)`), files, or command-line arguments.
-   **Tasks**: Individual actions that Ansible performs. Tasks use modules (e.g., `ansible.builtin.package`, `ansible.builtin.command`, `ansible.builtin.shell`) to interact with the remote hosts.
-   **Modules**: Pre-built units of code that Ansible executes. They perform specific functions like installing packages, running commands, or managing services.
-   **`register`**: Captures the output of a task into a variable for later use or assertion.
-   **`until` / `retries` / `delay`**: Used for retrying tasks until a certain condition is met, useful for waiting on services to start or become healthy.
-   **`failed_when`**: Defines a condition under which a task should be considered failed.

### **Running New Tests**

After creating a new playbook or modifying an existing one, you can run it by updating your `Vagrantfile` to point to the new playbook and then running `vagrant up`.

---

**Related Documentation**:
- [E2E Tests](e2e-tests.md)
- [Infrastructure Tests](infrastructure-tests.md)
- [Integration & CLI Tests](integration-cli-tests.md)
- [Upgrade Tests](upgrade-tests.md)
- [Test Parameters Reference](test-parameters.md)
- [Troubleshooting Guide](troubleshooting.md)
