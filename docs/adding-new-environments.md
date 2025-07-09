# Adding New Environments to PMM Framework

This guide explains how to add new database types and environments to the PMM qa-integration framework.

## Overview

The PMM framework uses a Python-based system (`pmm-framework.py`) with Ansible playbooks to set up various database and service environments for testing. Adding a new environment involves several coordinated changes.

## Architecture

The framework consists of:

- **`pmm-framework.py`** - Main Python script that orchestrates setup
- **`database_options.py`** - Configuration definitions for all database types
- **Ansible playbooks** (`.yml` files) - Infrastructure automation scripts
- **Helper scripts** - Supporting bash/shell scripts

## Step-by-Step Guide

### 1. Define Database Configuration

Edit `qa-integration/pmm_qa/scripts/database_options.py`:

```python
# Add your new database type to the database_options dictionary
"YOUR_DB_TYPE": {
    "versions": ["1.0", "2.0", "latest"],  # Available versions
    "configurations": {
        "CLIENT_VERSION": "3-dev-latest",   # Default PMM client version
        "CUSTOM_OPTION": "default_value",   # Your custom configuration options
        # Add more configuration options as needed
    }
},
```

**Example from our external TLS implementation:**
```python
"EXTERNAL_TLS": {
    "versions": ["0.15.1", "0.16.0"],
    "configurations": {
        "CLIENT_VERSION": "3-dev-latest", 
        "SKIP_TLS_VERIFY": "true"
    }
},
```

### 2. Create Setup Function

Add a new setup function in `qa-integration/pmm_qa/pmm-framework.py`:

```python
def setup_your_db_type(db_type, db_version=None, db_config=None, args=None):
    # Check if PMM server is running
    container_name = get_running_container_name()
    if container_name is None and args.pmm_server_ip is None:
        print(f"Check if PMM Server is Up and Running..Exiting")
        exit()

    # Gather version details
    your_version = os.getenv('YOUR_VERSION') or db_version or database_configs[db_type]["versions"][-1]

    # Define environment variables for playbook
    env_vars = {
        'PMM_SERVER_IP': args.pmm_server_ip or container_name or '127.0.0.1',
        'YOUR_VERSION': your_version,
        'YOUR_CONTAINER': 'your_container_name',
        'CLIENT_VERSION': get_value('CLIENT_VERSION', db_type, args, db_config),
        'ADMIN_PASSWORD': os.getenv('ADMIN_PASSWORD') or args.pmm_server_password or 'admin',
        'PMM_QA_GIT_BRANCH': os.getenv('PMM_QA_GIT_BRANCH') or 'v3',
        # Add your custom environment variables
        'CUSTOM_OPTION': get_value('CUSTOM_OPTION', db_type, args, db_config),
    }

    # Ansible playbook filename
    playbook_filename = 'your_setup.yml'

    # Call the function to run the Ansible playbook
    run_ansible_playbook(playbook_filename, env_vars, args)
```

### 3. Register in Setup Database Function

Add your database type to the routing logic in the `setup_database()` function:

```python
def setup_database(db_type, db_version=None, db_config=None, args=None):
    # ... existing code ...
    
    elif db_type == 'YOUR_DB_TYPE':
        setup_your_db_type(db_type, db_version, db_config, args)
    
    # ... rest of existing code ...
```

### 4. Create Ansible Playbook

Create `qa-integration/pmm_qa/your_setup.yml`:

```yaml
---
# Description of what this playbook does

- hosts: all
  vars:
    # Define variables using the lookup pattern
    your_version: "{{ lookup('vars', 'extra_your_version', default=lookup('env','YOUR_VERSION') | default('1.0', true) ) }}"
    your_container: "{{ lookup('vars', 'extra_your_container', default=lookup('env','YOUR_CONTAINER') | default('your_default_container', true) ) }}"
    pmm_server_ip: "{{ lookup('vars', 'extra_pmm_server_ip', default=lookup('env','PMM_SERVER_IP') | default('127.0.0.1', true) ) }}"
    client_version: "{{ lookup('vars', 'extra_client_version', default=lookup('env','CLIENT_VERSION') | default('3-dev-latest', true) ) }}"
    admin_password: "{{ lookup('vars', 'extra_admin_password', default=lookup('env','ADMIN_PASSWORD') | default('admin', true) ) }}"
    pmm_qa_branch: "{{ lookup('vars', 'extra_pmm_qa_branch', default=lookup('env','PMM_QA_GIT_BRANCH') | default('v3', true) ) }}"

  tasks:
  - name: Create pmm-qa network if not exist
    shell: docker network create pmm-qa
    ignore_errors: true

  - name: Cleanup existing containers
    shell: >
      docker ps -a --filter "name={{ your_container }}" | grep -q . && docker stop {{ your_container }} && docker rm -fv {{ your_container }}
    ignore_errors: true
    tags:
      - cleanup

  # Add your setup tasks here
  - name: Setup your environment
    shell: echo "Setting up your environment"

  # Standard PMM client setup pattern
  - name: Prepare Container
    shell: >
      docker run -d --name={{ your_container }}
      --network pmm-qa
      phusion/baseimage:jammy-1.0.1

  - name: Install basic packages
    shell: "{{ item }}"
    with_items:
      - docker exec {{ your_container }} apt-get update
      - docker exec {{ your_container }} apt-get -y install wget curl git gnupg2 lsb-release

  - name: Setup PMM client
    shell: "{{ item }}"
    with_items:
      - docker cp ./pmm3-client-setup.sh {{ your_container }}:/
      - docker exec {{ your_container }} bash -x ./pmm3-client-setup.sh --pmm_server_ip {{ pmm_server_ip }} --client_version {{ client_version }} --admin_password {{ admin_password }} --use_metrics_mode no

  # Add your services to PMM monitoring
  - name: Set Random Number Fact
    set_fact:
      random_number: "{{ (10000 | random) | int }}"

  - name: Add service to PMM monitoring
    shell: >
      docker exec {{ your_container }} bash -c 'source ~/.bash_profile || true; 
      pmm-admin add external --listen-port=YOUR_PORT --group="your_group" 
      --service-name=your_service_{{ random_number }}'

  - name: Display service information
    shell: >
      docker exec {{ your_container }} bash -c 'source ~/.bash_profile || true; 
      pmm-admin list'
    register: pmm_services

  - name: Show PMM services
    debug:
      msg: "{{ pmm_services.stdout }}"
```

### 5. Test Your Implementation

```bash
# Test syntax
python3 -m py_compile qa-integration/pmm_qa/pmm-framework.py

# Test Ansible syntax
ansible-playbook --syntax-check qa-integration/pmm_qa/your_setup.yml

# Test the functionality
python3 pmm-framework.py --database your_db_type
```

## Best Practices

### 1. Naming Conventions

- **Database types**: Use UPPERCASE with underscores (e.g., `EXTERNAL_TLS`, `MY_DATABASE`)
- **Container names**: Use lowercase with underscores (e.g., `my_database_container`)
- **Playbook files**: Use lowercase with underscores (e.g., `my_database_setup.yml`)

### 2. Environment Variables

- Use consistent naming patterns
- Provide sensible defaults
- Support both environment variables and command-line arguments

### 3. Error Handling

```python
# Always check if PMM server is running
container_name = get_running_container_name()
if container_name is None and args.pmm_server_ip is None:
    print(f"Check if PMM Server is Up and Running..Exiting")
    exit()
```

### 4. Cleanup Support

Always include cleanup tasks in your Ansible playbook:

```yaml
- name: Cleanup existing containers
  shell: >
    docker ps -a --filter "name={{ your_container }}" | grep -q . && docker stop {{ your_container }} && docker rm -fv {{ your_container }}
  ignore_errors: true
  tags:
    - cleanup
```

### 5. Documentation

Create a README file for your new environment:

```markdown
# Your Database Type Setup

## Usage
python3 pmm-framework.py --database your_db_type

## What it Creates
- Description of containers and services

## Configuration Options
- List of available options

## Testing
- How to verify the setup works
```

## Example: External Setup with TLS Enhancement

Here's how we enhanced the existing External setup to support TLS testing:

1. **Database Configuration Enhancement** (`database_options.py`):
```python
"EXTERNAL": {
    "REDIS": {
        "versions": ["1.14.0", "1.58.0"],
    },
    "NODEPROCESS": {
        "versions": ["0.7.5", "0.7.10"],
    },
    "configurations": {"CLIENT_VERSION": "3-dev-latest", "USE_TLS": "false"}
},
```

2. **Setup Function Enhancement** (`pmm-framework.py`):
```python
def setup_external(db_type, db_version=None, db_config=None, args=None):
    # Added TLS support to existing function
    env_vars = {
        # ... existing vars ...
        'USE_TLS': get_value('USE_TLS', db_type, args, db_config),
    }
```

3. **Ansible Playbook Enhancement** (`external_setup.yml`):
   - Keeps existing Redis and Node Process functionality
   - Conditionally creates TLS test server when USE_TLS=true
   - Uses `--tls-skip-verify` flag when TLS mode is enabled
   - Maintains backward compatibility

4. **Usage**:
```bash
# Default behavior (unchanged)
python3 pmm-framework.py --database external

# Enhanced with TLS testing
python3 pmm-framework.py --database external,USE_TLS=true
```

This approach demonstrates how to enhance existing environments rather than creating entirely new ones.

## Common Patterns

### Database with Version Support

```python
# In setup function
db_version = os.getenv('DB_VERSION') or db_version or database_configs[db_type]["versions"][-1]
```

### Multiple Container Setup

```yaml
# In Ansible playbook
- name: Start database container
  shell: docker run -d --name database_container ...

- name: Start exporter container  
  shell: docker run -d --name exporter_container ...
```

### Custom Configuration Options

```python
# In setup function
custom_option = get_value('CUSTOM_OPTION', db_type, args, db_config)

# In environment variables
'CUSTOM_OPTION': custom_option,
```

## Troubleshooting

### Common Issues

1. **Python Syntax Errors**: Use `python3 -m py_compile` to check
2. **Ansible Syntax Errors**: Use `ansible-playbook --syntax-check`
3. **Missing Dependencies**: Ensure all required packages are installed in containers
4. **Network Issues**: Always use the `pmm-qa` Docker network
5. **PMM Client Issues**: Verify PMM server is running and accessible

### Testing Steps

1. Syntax validation
2. Framework recognition (`python3 pmm-framework.py --help`)
3. Dry run with verbose output
4. Full integration test
5. Cleanup verification

## Contributing

When contributing new environments:

1. Follow the established patterns
2. Include comprehensive tests
3. Add documentation
4. Ensure cleanup works properly
5. Test with different PMM server configurations

This approach ensures consistency and maintainability across all PMM framework environments. 