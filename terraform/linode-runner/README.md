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
- **HTTPS-exec, not SSH.** Raw SSH (port 22) is unreachable from a cloud
  Claude Code session at *any* network access level — confirmed live: the
  platform's own security proxy is HTTP/HTTPS-only, and that's true
  regardless of the environment's configured access level (None / Trusted
  / Full / Custom). Moving that admin channel to a non-443 port doesn't
  work either — also confirmed live: the `CONNECT` tunnel itself succeeds,
  but the TLS handshake gets reset right after the ClientHello, as if
  something inspects traffic per-port and kills anything on a port that
  doesn't look like standard port-443 HTTPS, even through an established
  tunnel. So every instance runs a small bearer-token-authenticated HTTPS
  service on port 443 instead (`cloud-init.yaml.tftpl` installs it,
  `run.sh` talks to it) — the one port that reliably carries real traffic
  out of this kind of environment. `root_pass` (a random value, generated
  per run, never used to log in) exists only because the Linode API
  requires either it or `authorized_keys` at creation time.
- **Addressed by hostname, never a bare IP.** The same proxy drops
  connections to a raw IP address outright — it needs a hostname (SNI/Host)
  to route on, confirmed live. `run.sh`/`up.sh` always address the box as
  `<ip-with-dashes>.nip.io`, which resolves to the instance's own IP with
  zero DNS setup required.
- **PMM Server binds an internal-only port.** Since host port 443 is
  already the exec-server's, PMM Server itself binds `8443:8443` instead
  of the usual `443:8443` (see `.claude/skills/pmm-linode-provisioning/SKILL.md`
  step 2). Client containers on the same `pmm-qa` docker network are
  unaffected — they reach it by container hostname regardless of the host
  port mapping. The real cost: the controller's own browser (Playwright/
  Chromium, for UI evidence) has no external port to reach PMM's UI on
  today — an open gap, not silently worked around; see the
  skill's step 4.
- **Self-destructing, not reaped.** No external cron/Routine scans the
  account for stale instances. `cloud-init.yaml.tftpl` schedules an on-box
  systemd timer that calls the Linode API on its own tag
  (`pmm-qa-run:<run_id>`) and deletes itself `ttl_hours` (default 24) after
  boot. `extend.sh` reschedules that timer on a live instance if a run needs
  more time — nothing external ever has to guess whether an instance is
  still legitimately in use.
- **Firewall by default.** Every instance gets a `linode_firewall` allowing
  only the exec-server's port (443) inbound (from `var.allowed_ssh_cidr` —
  named for historical reasons, nothing here uses SSH anymore — default
  open, tighten it if you have a stable egress IP) and dropping everything
  else.
- **Git-cloned, never rsynced.** `up.sh` has the box `git clone` a specific
  ref of `percona/pmm-qa` (default `main`) directly from GitHub. It never
  copies this session's own working tree onto the VM — code changes have to
  be committed and pushed to a branch before they can run there, and Claude
  never edits files directly on the box (see the skill's "Never code on the
  Linode VM" section).

## Requirements

- `LINODE_TOKEN` environment variable (a Linode API v4 personal access
  token with `linodes:read_write` and `firewalls:read_write` scopes).
  Never pass it as a `-var` on the command line — `up.sh`/`down.sh` forward
  it via `TF_VAR_linode_token` instead, since it does need to end up
  templated into cloud-init for the self-destruct timer (which has to
  delete its own instance without any external process holding the token).
  It lands in this run's local tfstate, same as the generated exec token
  and root password already do — all gitignored, all local-only, all
  irrelevant once the instance is gone.
- `terraform` >= 1.5. No `ssh`/`openssh-client` needed anymore.
- No special network policy needed on the controller — this works from
  the **default** proxied-HTTPS environment (see "HTTPS-exec, not SSH"
  above); that's an improvement over the old SSH-based version of this
  module, which needed a permissive network policy that most environments
  don't have.

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
