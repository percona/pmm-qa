# PMM client performance / load-test harness

Ad-hoc scripts to spin up many PMM client VMs on Linode, register them against a
PMM server, build an Ansible inventory of one batch, and upgrade the PMM client
across it. Used for scale/load testing; **not** wired into CI.

## Secrets — never commit them

Root password and SSH keys are read from the environment. Do not hardcode them:

| Variable | Used by | Purpose |
| --- | --- | --- |
| `LINODE_ROOT_PASS` | create | root password for provisioned VMs |
| `PMM_PERF_SSH_PUBKEY` | create | SSH public key authorized on the VMs |
| `PMM_SERVER_PASSWORD` | create | PMM server admin password |
| `PMM_PERF_SSH_KEY` | inventory | local private key path (default `~/.ssh/id_rsa`) |

`linode-cli` must be configured with its own API token (`linode-cli configure`).

## Provision a batch

```bash
export LINODE_ROOT_PASS=...          # not in git
export PMM_PERF_SSH_PUBKEY="ssh-rsa AAAA... you@host"
export PMM_SERVER_PASSWORD=...
export PERF_RUN_ID=myrun-01           # optional; defaults to a UTC timestamp
./linode_stackScript_load_pmm3.sh <pmm_server_host> <client_version> <instances> <metrics_mode> <dbtype>
#   dbtype: mysql | postgresql | mongodb
```

Each VM is labelled `sp_fb_<i>_<dbtype>_<metrics_mode>_<PERF_RUN_ID>` and tagged
`pmm-qa-ephemeral`, `pmm-qa-perf`, and `pmm-qa-perf-run:<PERF_RUN_ID>`. The
create step prints the exact `PERF_RUN_ID` and the inventory/teardown commands
for that batch.

## Inventory + upgrade (one batch)

```bash
PERF_RUN_ID=myrun-01 ./prepare_ansible_client_inventory.sh   # selects that batch by tag; writes inventory_client_container2 (git-ignored)
./start_upgrade_v3.sh <version> <install_repo>               # runs upgrade_client.yml
```

`upgrade_client.yml` copies `upgrade_all_v3.sh` to each host and runs it as a
monitored async job, upgrading the PMM client in every `*client_container*`
Docker container and failing if the upgrade does not complete.

**Host-key precondition:** the inventory is freshly-provisioned VMs with no
`known_hosts` entries, and `start_upgrade_v3.sh` keeps `ANSIBLE_HOST_KEY_CHECKING`
on by default, so Ansible will refuse the first connection. Enroll each host's
key from a trusted source (e.g. the fingerprint Linode reports for the instance)
before running the upgrade. For throwaway hosts you already trust you may instead
run with `ANSIBLE_HOST_KEY_CHECKING=False`, accepting the MITM risk on that run.

## Tear down (do this — the VMs bill until deleted)

```bash
./teardown_perf_linodes.sh --dry-run                                # preview all pmm-qa-perf instances
PMM_PERF_TAG=pmm-qa-perf-run:myrun-01 ./teardown_perf_linodes.sh    # delete just one batch
./teardown_perf_linodes.sh                                          # delete every pmm-qa-perf instance
```

Teardown deletes only instances tagged `pmm-qa-perf` (this harness's own tag),
never the account-wide `pmm-qa-ephemeral`.
