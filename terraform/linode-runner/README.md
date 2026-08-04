# linode-runner

Terraform module + wrapper scripts that give a Claude agent a throwaway
Linode VM for one PMM QA run — a real box with a real kernel and real
systemd, so the Docker/Ansible setups in `qa-integration/` (which is
**not** modified by anything here) behave exactly as they do on Jenkins/EC2
CI, instead of hitting the "container is not running" limits of a nested
sandbox.

See `.claude/skills/pmm-linode-provisioning/SKILL.md` for the agent-facing
workflow (including the "never code on the box" rule). This README is the
implementation reference.

## Design

- **No shared state.** Each run gets its own `runs/<run_id>/terraform.tfstate`
  and `.terraform/` data dir. Nothing here is meant to outlive one run.
- **No pre-existing SSH key.** `main.tf` generates a fresh ED25519 keypair
  per run (`tls_private_key`); the private key is written to
  `runs/<run_id>/id_ed25519` (0600, gitignored) and never leaves the
  machine that ran `up.sh`.
- **Self-destructing, not reaped.** No external cron/Routine scans the
  account for stale instances. `cloud-init.yaml.tftpl` schedules an on-box
  systemd timer that calls the Linode API on its own tag
  (`pmm-qa-run:<run_id>`) and deletes itself `ttl_hours` (default 24) after
  boot. `extend.sh` reschedules that timer on a live instance if a run needs
  more time — nothing external ever has to guess whether an instance is
  still legitimately in use.
- **Firewall by default.** Every instance gets a `linode_firewall` allowing
  only SSH (22) and the PMM UI (443) inbound (from `var.allowed_ssh_cidr`,
  default open — tighten it if you have a stable egress IP) and dropping
  everything else.
- **Needs a permissive network policy on the controller.** A session with a
  locked-down egress policy (proxied-HTTPS-only) cannot reach the VM over
  SSH at all — confirmed live, and moving SSH to port 443 doesn't help
  either, since that class of policy inspects payloads, not just ports.
  Run `up.sh`/`run.sh` from a session/environment whose network policy
  allows outbound SSH.
- **Git-cloned, never rsynced.** `up.sh` has the box `git clone` a specific
  ref of `percona/pmm-qa` (default `main`) directly from GitHub. It never
  copies this session's own working tree onto the VM — code changes have to
  be committed and pushed to a branch before they can run there, and Claude
  never edits files directly on the box (see the skill's "Never code on the
  Linode VM" section).

## Requirements

- `LINODE_TOKEN` environment variable (a Linode API v4 personal access
  token with `linodes:read_write` and `firewalls:read_write` scopes).
  Never pass it as a `-var` on the command line — `up.sh` forwards it via
  `TF_VAR_linode_token` instead, since it does need to end up templated
  into cloud-init for the self-destruct timer (which has to delete its own
  instance without any external process holding the token). It lands in
  this run's local tfstate the same way the generated SSH key already does
  — both gitignored, both local-only, both irrelevant once the instance is
  gone.
- `terraform` >= 1.5, `jq`, `ssh` (openssh-client). The SessionStart hook
  installs `ssh` if missing; it is not in the base image.
- A network policy on the controller that permits outbound SSH (see above).

## Usage

```bash
export LINODE_TOKEN=...

# 1. Provision. role is free text (test-runner/test-doctor/fb-validator/smoketest/...),
#    run_id must be unique (a Jira key, a PR number, whatever you like).
terraform/linode-runner/up.sh test-runner PMM-15196

# 2. Run whatever you need on it -- server bring-up, then pmm-framework.
terraform/linode-runner/run.sh PMM-15196 -- 'docker network create pmm-qa'
terraform/linode-runner/run.sh PMM-15196 -- \
  'cd pmm-qa/qa-integration/pmm_qa/pmm-framework && ./pmm-framework --database ps=8.4'

# 3. Tear down -- ALWAYS, on every exit path.
terraform/linode-runner/down.sh PMM-15196
```

Testing a fix that isn't on `main` yet? Push it to a branch first, then:

```bash
PMM_QA_REF=my-fix-branch terraform/linode-runner/up.sh fb-validator heal-4376
# ...or on an already-running instance:
terraform/linode-runner/sync.sh heal-4376 my-fix-branch
```

## Safety net

No Routine to enable, no cadence/TTL to confirm before turning anything on
— self-destruct is baked into every instance from the moment it boots.
`extend.sh` is the only manual lever:

```bash
terraform/linode-runner/extend.sh PMM-15196 12   # 12 more hours from now
```

## Sizing

Default plan is `g6-standard-6` (4 CPU / 12 GB) — enough for PMM Server plus
a couple of monitored database containers. Override per run:

```bash
terraform/linode-runner/up.sh test-runner PMM-15196 -var instance_type=g6-standard-8
```
