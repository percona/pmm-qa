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

# Generated here, before the instance even boots, instead of by the box
# itself at cloud-init time -- so run.sh can verify the exec-server's TLS
# certificate against a CA it already knows, rather than skipping
# verification entirely (curl -k). Can't scope dns_names to this specific
# instance's nip.io hostname: the IP doesn't exist yet when this cert has
# to be generated (it's baked into the same user_data the instance boots
# from), and confirmed live that curl's --resolve trick to fake a real
# hostname doesn't help either -- this environment's egress proxy resolves
# the CONNECT target itself, so a made-up hostname just gets a 502 from
# the proxy before curl's own --resolve override ever applies. A "*.nip.io"
# wildcard sidesteps both problems: nip.io is real, publicly resolvable
# DNS (so the proxy's own CONNECT resolution succeeds), and the wildcard
# doesn't need to know the IP in advance. The hostname check this gives up
# is broad (any nip.io subdomain matches), but the chain check is exact --
# this specific run's uniquely generated private key -- which is the part
# that actually stops an unrelated third party from impersonating this
# box.
resource "tls_private_key" "exec" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_self_signed_cert" "exec" {
  private_key_pem = tls_private_key.exec.private_key_pem

  subject {
    common_name = "*.nip.io"
  }
  dns_names = ["*.nip.io"]

  validity_period_hours = var.ttl_hours + 1
  allowed_uses = [
    "key_encipherment",
    "digital_signature",
    "server_auth",
  ]
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
      exec_cert    = tls_self_signed_cert.exec.cert_pem
      exec_key     = tls_private_key.exec.private_key_pem
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
