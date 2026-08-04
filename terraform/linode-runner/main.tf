# A single throwaway Linode VM that a Claude agent (test-runner / test-healer)
# provisions for the lifetime of one QA run, then destroys via down.sh.
#
# Deliberately NOT a shared remote backend: state lives in
# runs/<run_id>/terraform.tfstate on whichever machine ran up.sh, and nothing
# is expected to outlive that one run. The independent safety net is
# reap.sh, which talks to the Linode API directly (tags + creation time),
# not to this state.

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
}

resource "linode_instance" "runner" {
  label           = local.label
  region          = var.region
  type            = var.instance_type
  image           = "linode/ubuntu24.04"
  authorized_keys = [trimspace(tls_private_key.ssh.public_key_openssh)]
  booted          = true
  swap_size       = 512

  # Tags are the reaper's only source of truth -- keep the ttl-hours tag in
  # sync with variables.tf's ttl_hours default/override.
  tags = [
    "pmm-qa-ephemeral",
    "pmm-qa-role:${var.role}",
    "pmm-qa-run:${var.run_id}",
    "pmm-qa-ttl-hours:${var.ttl_hours}",
  ]

  metadata {
    user_data = base64encode(file("${path.module}/cloud-init.yaml"))
  }
}

resource "linode_firewall" "runner" {
  label = "fw-${local.label}"

  inbound_policy  = "DROP"
  outbound_policy = "ACCEPT"

  # Only 443 is open. Many session controllers driving this module (Claude
  # Code Remote sessions) can only egress on port 443 themselves -- so SSH
  # and the PMM UI both ride this one port, demultiplexed on-box by sslh
  # (see cloud-init.yaml). Nothing on the box needs a separate externally
  # reachable port: pmm-agent registration happens over the local Docker
  # network, not the public IP.
  inbound {
    label    = "sslh"
    action   = "ACCEPT"
    ports    = "443"
    protocol = "TCP"
    ipv4     = [var.allowed_ssh_cidr]
  }

  linodes = [linode_instance.runner.id]
}
