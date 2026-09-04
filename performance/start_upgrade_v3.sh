#!/bin/bash
set -Eeuo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <version> <install_repo>" >&2
  echo "Example: $0 3.1.0 release" >&2
  exit 1
fi

export ANSIBLE_HOST_KEY_CHECKING="${ANSIBLE_HOST_KEY_CHECKING:-True}"
export version="$1"
export install_repo="$2"
INVENTORY="${INVENTORY_FILE:-inventory_client_container2}"

echo "Running upgrade with version=$version repo=$install_repo (host_key_checking=$ANSIBLE_HOST_KEY_CHECKING)"
ansible-playbook -i "$INVENTORY" upgrade_client.yml
