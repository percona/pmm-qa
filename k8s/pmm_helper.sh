
load "./lib/bats-support/load"  # Load BATS support libraries
load "./lib/bats-assert/load"   # Load BATS assertions

# Set default chart branch - can be overridden by environment variable
PMM_CHART_BRANCH=${PMM_CHART_BRANCH:-"latest"}
PMM_HELM_CHARTS_REPO="https://github.com/percona/percona-helm-charts.git"
# Default to a unique temp directory; allow override via env.
PMM_HELM_CHARTS_DIR="${PMM_HELM_CHARTS_DIR:-$(mktemp -d -t percona-helm-charts.XXXXXX)}"
get_pmm_addr(){
    local node_port=8443
    local node_ip=127.0.0.1
    echo $node_ip:$node_port
}

# Function to setup helm chart source based on branch
setup_pmm_chart_source() {
    echo "Setting up PMM chart source for branch: $PMM_CHART_BRANCH"
    
    if [[ "$PMM_CHART_BRANCH" == "latest" ]]; then
        echo "Using released PMM chart from Percona helm repository"
        helm repo add percona https://percona.github.io/percona-helm-charts/ || true
        helm repo update percona
    else
        echo "Using PMM chart from git branch: $PMM_CHART_BRANCH"
        # Clean up any existing clone
        rm -rf "$PMM_HELM_CHARTS_DIR" || true
        
        # Clone the repository with the specified branch
        git clone -b "$PMM_CHART_BRANCH" --depth 1 "$PMM_HELM_CHARTS_REPO" "$PMM_HELM_CHARTS_DIR"
        
        if [[ ! -d "$PMM_HELM_CHARTS_DIR/charts/pmm" ]]; then
            echo "ERROR: PMM chart not found in branch $PMM_CHART_BRANCH at $PMM_HELM_CHARTS_DIR/charts/pmm"
            return 1
        fi
    fi
}

# Function to get the chart path based on branch setting
get_pmm_chart_path() {
    if [[ "$PMM_CHART_BRANCH" == "latest" ]]; then
        echo "percona/pmm"
    else
        echo "$PMM_HELM_CHARTS_DIR/charts/pmm"
    fi
}

# Function to install PMM helm chart with branch support
install_pmm_chart() {
    local instance_name="$1"
    shift  # Remove first argument, keep the rest
    local additional_args="$@"
    
    setup_pmm_chart_source
    local chart_path=$(get_pmm_chart_path)
    
    echo "Installing PMM chart from: $chart_path"
    echo "Additional args: $additional_args"
    
    helm install "$instance_name" $additional_args "$chart_path"
}

# Function to upgrade PMM helm chart with branch support
upgrade_pmm_chart() {
    local instance_name="$1"
    shift  # Remove first argument, keep the rest
    local additional_args="$@"
    
    setup_pmm_chart_source
    local chart_path=$(get_pmm_chart_path)
    
    echo "Upgrading PMM chart from: $chart_path"
    echo "Additional args: $additional_args"
    
    helm upgrade "$instance_name" $additional_args "$chart_path"
}

# Function to show PMM chart values with branch support
show_pmm_chart_values() {
    local additional_args="$@"
    
    setup_pmm_chart_source
    local chart_path=$(get_pmm_chart_path)
    
    echo "Showing values for PMM chart from: $chart_path"
    
    helm show values $additional_args "$chart_path"
}

# Cleanup function for git-based charts
cleanup_pmm_chart_source() {
    if [[ "$PMM_CHART_BRANCH" != "latest" ]]; then
        echo "Cleaning up cloned helm charts repository"
        rm -rf "$PMM_HELM_CHARTS_DIR" || true
    fi
}

get_pmm_version() {
    # depends on the driver, but probably local PVC wouldn't be cleaned up
    # and pass would be set only during this first pvc init
    # so always use new name if you want to provision PVC in helm install (pmmX)

    admin_pass=$(get_pmm_pswd)
    pmm_address=$(get_pmm_addr)

    # encode pass, as it can have special characters
    encoded_u_p=$(echo -n admin:${admin_pass} | base64)

    echo "curl -k -H 'Authorization: Basic ...' https://"${pmm_address}"/v1/version"
    # echo admin pass in case there are some issues with it
    echo "pass:${admin_pass}"

    run bash -c "curl -sk -H 'Authorization: Basic ${encoded_u_p}' https://${pmm_address}/v1/version | jq .version"
    assert_success

    # Check that the pmm_version string is not empty
    if [[ -z "${output}" ]]; then
        fail "pmm_version is empty"
    fi

    echo $output
}
