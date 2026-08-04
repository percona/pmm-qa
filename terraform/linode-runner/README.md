# linode-runner

Terraform module + wrapper scripts that give a Claude agent a throwaway
Linode VM for one PMM QA run — a real box with a real kernel and real
systemd, so the Docker/Ansible setups in `qa-integration/` (which is
**not** modified by anything here) behave exactly as they do on Jenkins/EC2
CI, instead of hitting the "container is not running" limits of a nested
sandbox.

See `.claude/skills/pmm-linode-provisioning/SKILL.md` for the agent-facing
workflow. This README is the implementation reference.

## Design

- **No shared state.** Each run gets its own `runs/<run_id>/terraform.tfstate`
  and `.terraform/` data dir. Nothing here is meant to outlive one run.
- **No pre-existing SSH key.** `main.tf` generates a fresh ED25519 keypair
  per run (`tls_private_key`); the private key is written to
  `runs/<run_id>/id_ed25519` (0600, gitignored) and never leaves the
  machine that ran `up.sh`.
- **Tag-based safety net, not state-based.** `reap.sh` never reads Terraform
  state — it asks the Linode API directly for anything tagged
  `pmm-qa-ephemeral` past its own `pmm-qa-ttl-hours:<N>` tag. That means the
  safety net still works even if the original run's container/session is
  long gone.
- **Firewall by default.** Every instance gets a `linode_firewall` allowing
  only 22/443/4647 inbound (from `var.allowed_ssh_cidr`, default open —
  tighten it if you have a stable egress IP) and dropping everything else.

## Requirements

- `LINODE_TOKEN` environment variable (a Linode API v4 personal access
  token with `linodes:read_write` and `firewalls:read_write` scopes).
  Never pass it as a `-var` or write it to a `.tfvars` file — the provider
  reads it straight from the environment.
- `terraform` >= 1.5, `jq`, `rsync`, `ssh`.

## Usage

```bash
export LINODE_TOKEN=...

# 1. Provision. role is free text (test-runner/test-healer/smoketest/...),
#    run_id must be unique (a Jira key, a PR number, whatever you like).
terraform/linode-runner/up.sh test-runner PMM-15196

# 2. Run whatever you need on it -- server bring-up, then pmm-framework.
terraform/linode-runner/run.sh PMM-15196 -- 'docker network create pmm-qa'
terraform/linode-runner/run.sh PMM-15196 -- \
  'cd qa-integration/pmm_qa/pmm-framework && ./pmm-framework --database ps=8.4'

# 3. Tear down -- ALWAYS, on every exit path.
terraform/linode-runner/down.sh PMM-15196
```

`up.sh` re-syncs `qa-integration/` fresh every time it's called for a new
`run_id` — whatever this checkout currently has, uncommitted changes
included, is exactly what runs on the box. There is no separate clone or
pinned ref to fall out of sync with.

## Safety net

`reap.sh` is meant to run on a schedule (a Claude Code Remote Routine), not
ad hoc. It is intentionally *not* wired to a live cron by default —
enabling that is a deliberate step with its own cadence/TTL confirmation
(see `docs/agents/AUTOMATIONS.md`).

```bash
# See what it would do without deleting anything:
LINODE_TOKEN=... terraform/linode-runner/reap.sh --dry-run
```

## Sizing

Default plan is `g6-standard-6` (4 CPU / 12 GB) — enough for PMM Server plus
a couple of monitored database containers. Override per run:

```bash
terraform/linode-runner/up.sh test-runner PMM-15196 -var instance_type=g6-standard-8
```
