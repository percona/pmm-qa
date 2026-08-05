# A single throwaway Linode VM that a Claude agent (test-runner / test-doctor / fb-validator)
# provisions for the lifetime of one QA run, then destroys via down.sh.
#
# Deliberately NOT a shared remote backend: state lives in
# runs/<run_id>/terraform.tfstate on whichever machine ran up.sh, and nothing
# is expected to outlive that one run. The independent safety net is a
# self-destruct systemd timer baked into cloud-init (see
# cloud-init.yaml.tftpl) -- the instance deletes itself after ttl_hours with
# no external process required. extend.sh reschedules it on a live instance.

# Controllers running behind a proxied-HTTPS-only network policy cannot
# open a raw SSH (port 22) connection -- confirmed live, not a policy
# oversight (see docs.md's "Why HTTPS-exec, not SSH" section). Every
# command runs through a small bearer-token-authenticated HTTPS service
# on the box instead (see cloud-init.yaml.tftpl). root_pass exists only
# because the Linode API requires either it or authorized_keys; it is
# never used to log in.
resource "random_password" "root_pass" {
  length  = 32
  special = true
}

resource "random_password" "exec_token" {
  length  = 40
  special = false
}

resource "random_string" "suffix" {
  length  = 5
  special = false
  upper   = false
}

locals {
  label = substr(
    "pmmqa-${var.role}-${var.run_id}-${random_string.suffix.result}",
    0, 63,
  )
  # Linode firewall labels have a stricter 32-char limit than instance
  # labels (63) -- a separate, more aggressively truncated value, not a
  # prefix on the instance label, which was overflowing it.
  firewall_label = substr(
    "fw-${random_string.suffix.result}-${var.run_id}",
    0, 32,
  )
}

resource "linode_instance" "runner" {
  label     = local.label
  region    = var.region
  type      = var.instance_type
  image     = "linode/ubuntu24.04"
  root_pass = random_password.root_pass.result
  booted    = true
  swap_size = 512

  # The pmm-qa-run tag is also how the self-destruct timer finds its own
  # instance ID at delete time (see cloud-init.yaml.tftpl) -- it must stay
  # unique per run.
  tags = [
    "pmm-qa-ephemeral",
    "pmm-qa-role:${var.role}",
    "pmm-qa-run:${var.run_id}",
  ]

  metadata {
    user_data = base64encode(templatefile("${path.module}/cloud-init.yaml.tftpl", {
      run_id       = var.run_id
      ttl_seconds  = var.ttl_hours * 3600
      linode_token = var.linode_token
      exec_token   = random_password.exec_token.result
    }))
  }
}

resource "linode_firewall" "runner" {
  label = local.firewall_label

  inbound_policy  = "DROP"
  outbound_policy = "ACCEPT"

  # Only the exec-server's port is open. PMM Server itself binds an
  # internal-only port (see docs.md) -- commands to bring it up, query it,
  # and tear it down all go through the exec-server, never a direct
  # connection to PMM's own port.
  inbound {
    label    = "exec"
    action   = "ACCEPT"
    ports    = "443"
    protocol = "TCP"
    ipv4     = [var.allowed_ssh_cidr]
  }

  linodes = [linode_instance.runner.id]
}
