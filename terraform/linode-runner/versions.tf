terraform {
  required_version = ">= 1.5.0"

  required_providers {
    linode = {
      source  = "linode/linode"
      version = "~> 2.9"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

# Reads the token from the LINODE_TOKEN environment variable -- never pass it
# as a -var on the command line or write it into a .tfvars file. The token
# needs Linodes + Firewalls read/write AND Events read-only: the provider polls
# /account/events to confirm instance create/delete, so down.sh 401s without
# events:read. (We keep the standard event polling rather than disabling it.)
provider "linode" {}
