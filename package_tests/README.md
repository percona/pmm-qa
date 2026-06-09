# PMM Package Tests

Ansible-based tests for PMM Client package, tarball, registration, service monitoring, and upgrade scenarios.

These tests validate the real PMM Client user path: enable Percona repositories, install `pmm-client`, connect it to PMM Server, add monitored databases, and verify exporters, metrics, config, files, and upgrades.

## Folder Map

| Path | Purpose |
| --- | --- |
| `*.yml` | Main Ansible playbooks for PMM Client package scenarios. |
| `tasks/` | Reusable install, setup, and verification task files. |
| `templates/` | Jinja templates used by package test tasks. |
| `scripts/` | Shell scripts used by package and tarball install flows. |
| `support-files/` | Static support files used by package test tasks. |

## Typical Flow

`prepare OS/repo -> install PMM Client -> register with PMM Server -> install monitored DBs -> add services with pmm-admin -> verify exporters and metrics`

## Getting Started

- Open the `package_tests` folder in terminal.
- Install Ansible and make sure `ansible-playbook` is available.
- Make sure the target host is reachable through your Ansible inventory.
- Make sure the target PMM Server is available.
- Set environment variables required by the selected playbook.

Create or export variables before running a playbook:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PMM_SERVER_IP` | `127.0.0.1` | PMM Server address used for client registration. |
| `ADMIN_PASSWORD` | `admin` | PMM admin password. |
| `PMM_VERSION` | unset | Expected PMM Client version for verification. |
| `install_package` | `pmm3-client` | Package name to install. |
| `install_repo` | unset | Percona repository channel to enable, such as `release`, `testing`, or `experimental`. |
| `METRICS_MODE` | `auto` | Metrics mode used by `pmm-admin config`. |
| `TARBALL_LINK` | unset | PMM Client tarball URL for tarball scenarios. |
| `OLD_TARBALL_LINK` | unset | Previous tarball URL for tarball upgrade scenarios. |
| `PS_REPOSITORY` | `release` | Percona Server repository channel. |
| `PSMDB_REPOSITORY` | `release` | PSMDB repository channel. |

## Running Tests

Run commands from `package_tests/`.

| Goal | Command |
| --- | --- |
| Run one playbook | `ansible-playbook -i <inventory> <playbook>.yml` |
| Run with inline inventory | `ansible-playbook -i <host>, <playbook>.yml` |
| Run locally | `ansible-playbook -i localhost, --connection=local <playbook>.yml` |
| Run with extra vars | `ansible-playbook -i <inventory> <playbook>.yml -e "<key>=<value>"` |
| Check syntax | `ansible-playbook --syntax-check <playbook>.yml` |

Main playbooks:

| Scenario | Playbooks |
| --- | --- |
| Fresh install | `pmm3-client_integration.yml` |
| Auth | `pmm3-client_integration_auth_config.yml`, `pmm3-client_integration_auth_register.yml` |
| Custom install path or port | `pmm3-client_integration_custom_path.yml`, `pmm3-client_integration_custom_port.yml` |
| Upgrade | `pmm3-client_integration_upgrade.yml`, `pmm3-client_integration_upgrade_custom_path.yml`, `pmm3-client_integration_upgrade_custom_port.yml` |
| GSSAPI tarball | `pmm3-client_integration_tarball_gssapi.yml`, `pmm3-client_integration_upgrade_tarball_gssapi.yml` |

## Adding A Playbook

1. Create the playbook in `package_tests/` with the `*.yml` suffix.
2. Keep reusable install or verification logic in `tasks/`; avoid duplicating existing task flows.
3. Use environment variables consistently with existing playbooks.
4. Keep service-specific setup in focused task files.
5. Add templates under `templates/` only when task parameters are not enough.
6. Run `ansible-playbook --syntax-check <playbook>.yml` before running against hosts.

Playbook template:

```yaml
---
- hosts: all
  become: true
  become_method: sudo
  vars:
    pmm_server_address: "{{ lookup('env', 'PMM_SERVER_IP') | default('127.0.0.1', true) }}"
    pmm_server_password: "{{ lookup('env', 'ADMIN_PASSWORD') | default('admin', true) }}"

  tasks:
    - name: Prepare PMM Client test environment
      include_tasks: ./tasks/pmm3_client_test_prepare.yml

    - name: Verify PMM Client version
      include_tasks: ./tasks/verify_pmm_client_version.yml
```

Run the changed playbook directly:

```bash
ansible-playbook -i <inventory> <playbook>.yml
```

## Quality Checks

Quality commands:

```bash
ansible-playbook --syntax-check <playbook>.yml
yamllint <path>
```

## CI Usage

GitHub Actions package workflows call these playbooks through `../.github/workflows/runner-package-test.yml`.

## Related Workspaces

- [CLI Tests](../cli/README.md) - Playwright-based `pmm-admin` CLI tests.
- [Playwright E2E Tests](../e2e_tests/README.md) - Playwright web UI and API-assisted E2E tests.
- [CodeceptJS E2E Tests](../codeceptjs-e2e/README.md) - existing CodeceptJS tests.
- [QA Integration](../qa-integration/README.md) - database and PMM integration environment setup.
