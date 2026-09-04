# PMM client performance / load-test harness

Ad-hoc scripts to spin up many PMM client VMs on Linode, register them against a
PMM server, build an Ansible inventory of them, and upgrade the PMM client across
them. Used for scale/load testing; **not** wired into CI.

## Secrets — never commit them

Root password and SSH keys are read from the environment. Do not hardcode them:

| Variable | Used by | Purpose |
| --- | --- | --- |
| `LINODE_ROOT_PASS` | create | root password for provisioned VMs |
| `PMM_PERF_SSH_PUBKEY` | create | SSH public key authorized on the VMs |
| `PMM_SERVER_PASSWORD` | create | PMM server admin password |
| `PMM_PERF_SSH_KEY` | inventory | local private key path (default `~/.ssh/id_rsa`) |

`linode-cli` must be configured with its own API token (`linode-cli configure`).

## Provision

```bash
export LINODE_ROOT_PASS=...          # not in git
export PMM_PERF_SSH_PUBKEY="ssh-rsa AAAA... you@host"
export PMM_SERVER_PASSWORD=...
./linode_stackScript_load_pmm3.sh <pmm_server_host> <client_version> <instances> <metrics_mode> <dbtype>
#   dbtype: mysql | postgresql | mongodb
```

Every VM is tagged `pmm-qa-ephemeral`, `pmm-qa-perf`, and
`pmm-qa-perf-run:<PERF_RUN_ID>`.

## Tear down (do this — the VMs bill until deleted)

```bash
./teardown_perf_linodes.sh --dry-run   # preview
./teardown_perf_linodes.sh             # delete every pmm-qa-ephemeral instance
PMM_PERF_TAG=pmm-qa-perf-run:<id> ./teardown_perf_linodes.sh   # just one batch
```

## Inventory + upgrade

```bash
./prepare_ansible_client_inventory.sh          # writes inventory_client_container2 (git-ignored)
./start_upgrade_v3.sh <version> <install_repo>  # runs upgrade_client.yml
```

`upgrade_client.yml` copies `upgrade_all_v3.sh` to each host and runs it as a
monitored async job, upgrading the PMM client in every `*client_container*`
Docker container and failing if the upgrade does not complete.
