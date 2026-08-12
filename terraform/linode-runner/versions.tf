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
# as a -var on the command line or write it into a .tfvars file.
#
# skip_instance_*_poll: don't watch /account/events to confirm instance
# create/delete. The delete poll in particular hard-fails a token without the
# events:read scope ("[401] not authorized to use this endpoint"), which broke
# down.sh under the relay's minimal token. Skipping the poll keeps the required
# scope to linodes + firewall read/write only -- the instance still creates and
# deletes; terraform just doesn't block waiting for the event to land.
provider "linode" {
  skip_instance_ready_poll  = true
  skip_instance_delete_poll = true
}
