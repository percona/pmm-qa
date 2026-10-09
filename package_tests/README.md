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
| `docker/` | systemd-capable OS images the GitHub Actions matrix runs the playbooks in, with the databases `docker/database-versions` lists per OS preinstalled from Percona's repositories. |

## Typical Flow

`prepare OS/repo -> install PMM Client -> register with PMM Server -> install monitored DBs -> add services with pmm-admin -> verify exporters and metrics`

## Getting Started

- Open the `package_tests` folder in terminal.
- Install Ansible and make sure `ansible-playbook` is available.
- Make sure the target host is reachable through your Ansible inventory.
- Make sure the target PMM Server is available.
- Install the databases `docker/database-versions` lists for the target's OS: the playbooks expect them, check their versions, start them and add them to PMM, and fail where one is missing or at another version. `docker/install-databases.sh` installs them the way the CI images get them; an OS the file does not list expects none.
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

Every container in these workflows runs on podman; none uses Docker. `pmm3-client_integration_tarball_gssapi` runs in the same matrix, on `ol8` and `ol9` only (it sets up Kerberos with dnf), and `../.github/workflows/gssapi-psmdb-tests-matrix.yml` calls it there. Its mongod authorizes against an LDAP directory at `127.0.0.1:1389`, which the cell starts beside the client, in the client's network namespace; on any other host, provide one there.

`../.github/workflows/pmm3-package-tests-matrix.yml` runs eight playbooks across eight operating systems on amd64, arm64 (the `arch` input) or both, each in a systemd container next to its own PMM Server. arm64 needs a pmm-server image built for arm64, such as `perconalab/pmm-server:3-dev-latest`. The images come from `docker/` and are published to `ghcr.io/percona/pmm-qa/package_tests`, one tag per OS (`package_tests:ol8`, `package_tests:debian13`, ...), whenever the workflow is run by hand, by `../.github/workflows/build-package-test-images.yml`. Each OS tag is a multi-arch image built natively for amd64 and arm64, and those tags are the only ones. Run the matrix with `build_images` ticked to rebuild and republish them from the selected branch before testing. A failed cell is retried from scratch on a fresh client and PMM Server (the `attempts` input, default 2), so a run reports a failure only when every attempt failed; `../.github/scripts/package-test-cell.sh` runs each attempt. Other workflows can call the matrix with `workflow_call` and the same inputs; the calling job grants `contents: read` and `packages: write`, and a caller outside pmm-qa passes `pmm_qa_ref`, the pmm-qa ref it calls the workflow at.

## Related Workspaces

- [CLI Tests](../cli/README.md) - Playwright-based `pmm-admin` CLI tests.
- [Playwright E2E Tests](../e2e_tests/README.md) - Playwright web UI and API-assisted E2E tests.
- [CodeceptJS E2E Tests](../codeceptjs-e2e/README.md) - existing CodeceptJS tests.
- [QA Integration](../qa-integration/README.md) - database and PMM integration environment setup.
