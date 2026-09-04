#!/bin/bash

# Check if exactly two arguments are passed
if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <version> <install_repo>"
  echo "Example: $0 3.1.0 release"
  exit 1
fi

# Set input arguments
export ANSIBLE_HOST_KEY_CHECKING=False
export version="$1"
export install_repo="$2"

# Optional: Print for debugging
echo "Running upgrade with version=$version and install_repo=$install_repo"

# Run Ansible playbook
ansible-playbook -i inventory_client_container2 upgrade_client.yml
