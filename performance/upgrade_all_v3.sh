#!/usr/bin/env bash

# Parse arguments like --version 3.1.0 --repo release
while [ $# -gt 0 ]; do
    if [[ $1 == --* ]]; then
        param="${1/--/}"
        declare "$param"="$2"
        shift
    fi
    shift
done

# Set defaults if not provided
export version="${version:-3.7.0}"
export repo="${repo:-testing}"

# Loop through containers with 'client_container' in the name
for i in $(docker ps | grep client_container | awk '{print $NF}'); do

    echo "🔧 Upgrading PMM client on container: ${i}"

    # Enable the specified repo inside the container
    docker exec "${i}" percona-release enable pmm3-client "${repo}"

    # Update package lists
    docker exec "${i}" apt-get update || true
    sleep 30
    # Copy old config file
    docker exec "${i}" sh -c 'cp /usr/local/percona/pmm/config/pmm-agent.yaml /tmp/pmm-agent.yaml.old'
    # Install PMM client
    docker exec "${i}" bash -c "DEBIAN_FRONTEND=noninteractive apt-get install -y pmm-client"

    # Kill existing pmm-agent process if running
    docker exec "${i}" pkill -f pmm-agent || true

    # Copy old config file back
    docker exec "${i}" sh -c 'cp /tmp/pmm-agent.yaml.old /usr/local/percona/pmm/config/pmm-agent.yaml'

    # Restart PMM agent and log to file inside the container
    docker exec "${i}" sh -c 'pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml > /tmp/pmm-agent.log 2>&1 &'

    # Wait for agent to come up
    sleep 10
    
    # Check PMM agent status inside the container
    if docker exec "${i}" pmm-admin status 2>/dev/null | grep -q "pmm-agent"; then
       node_name=$(docker exec "${i}" pmm-admin status | awk -F': ' '/Node name/ {print $2}')
    
       echo "client is upgraded: ${node_name}"

       docker exec "${i}" pmm-admin annotate "client ${node_name} upgraded to ${version}"
    fi

    # Verify the new version
    echo "✅ Verifying installation in container: ${i}"
    docker exec "${i}" pmm-agent --version | grep "${version}"
    docker exec "${i}" pmm-admin status | grep pmm-agent | grep "${version}"
    docker exec "${i}" pmm-admin status | grep pmm-admin | grep "${version}"
    echo ""

done

