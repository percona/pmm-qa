# A single throwaway Linode VM that a Claude agent (test-runner / test-doctor / fb-validator)
# provisions for the lifetime of one QA run, then destroys via down.sh.
#
# Deliberately NOT a shared remote backend: state lives in
# runs/<run_id>/terraform.tfstate on whichever machine ran up.sh, and nothing
# is expected to outlive that one run. The independent safety net is a
# self-destruct systemd timer baked into cloud-init (see
# cloud-init.yaml.tftpl) -- the instance deletes itself after ttl_hours with
# no external process required. extend.sh reschedules it on a live instance.

resource "tls_private_key" "ssh" {
  algorithm = "ED25519"
}

# 0600 by default; never commit this -- see .gitignore.
resource "local_sensitive_file" "ssh_private_key" {
  content         = tls_private_key.ssh.private_key_openssh
  filename        = "${path.module}/runs/${var.run_id}/id_ed25519"
  file_permission = "0600"
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
  # Linode firewall labels cap at 32 chars, well below the instance label's
  # 63 -- truncate independently instead of prefixing "fw-" onto local.label.
  firewall_label = substr(
    "fw-${var.role}-${var.run_id}-${random_string.suffix.result}",
    0, 32,
  )
}

resource "linode_instance" "runner" {
  label           = local.label
  region          = var.region
  type            = var.instance_type
  image           = "linode/ubuntu24.04"
  authorized_keys = [trimspace(tls_private_key.ssh.public_key_openssh)]
  booted          = true
  swap_size       = 512

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
    }))
  }
}

resource "linode_firewall" "runner" {
  label = local.firewall_label

  inbound_policy  = "DROP"
  outbound_policy = "ACCEPT"

  inbound {
    label    = "ssh"
    action   = "ACCEPT"
    ports    = "22"
    protocol = "TCP"
    ipv4     = [var.allowed_ssh_cidr]
  }

  inbound {
    label    = "pmm-ui"
    action   = "ACCEPT"
    ports    = "443"
    protocol = "TCP"
    ipv4     = [var.allowed_ssh_cidr]
  }

  linodes = [linode_instance.runner.id]
}
