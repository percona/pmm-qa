## pmm k8s helm tests
### needs: helm, kubectl, k8s cluster with snapshotclass, default kubeconfig
## add comment #bats test_tags=bats:focus above the test to focus it

# minikube delete && \
#           minikube start && \
#           minikube addons disable storage-provisioner && \
#           kubectl delete storageclass standard && \
#           minikube addons enable csi-hostpath-driver && \
#           minikube addons enable volumesnapshots && \
#           kubectl patch storageclass csi-hostpath-sc -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}' && \
#           kubectl wait --for=condition=Ready node --timeout=90s minikube && \
#           bats helm-test.bats

cleanup () {
    echo "--------cleanup---------"
    helm list --short | xargs helm uninstall || true
    kubectl delete pod,service,statefulset,configmap,secret,serviceaccount,volumesnapshot --selector=app.kubernetes.io/name=pmm --force || true
    delete_pvc || true
    rm values.yaml || true
    echo "------------------------"
}

setup() {
    echo "Running setup"
    PROJECT_ROOT=$(dirname "$BATS_TEST_FILENAME")
    echo "Project root: $PROJECT_ROOT"
    source "$PROJECT_ROOT/k8s_helper.sh"
    source "$PROJECT_ROOT/pmm_helper.sh"
    IMAGE_REPO=${IMAGE_REPO:-"perconalab/pmm-server"}
    IMAGE_TAG=${IMAGE_TAG:-"3-dev-latest"}
    RELEASE_REPO="percona/pmm-server"
    RELEASE_TAG="3"
    kubectl config set-context --current --namespace=default

    cleanup
}

teardown() {
    echo "Running teardown"
    echo "-------debug info-------"
    kubectl get pods
    kubectl describe pod --selector=app.kubernetes.io/name=pmm
    kubectl get events --sort-by=lastTimestamp
    kubectl logs --all-containers --timestamps --selector=app.kubernetes.io/name=pmm
    echo "------------------------"

    cleanup
}

# Helper function to trim whitespace
trim() {
    local var="$*"
    # remove leading whitespace characters
    var="${var#"${var%%[![:space:]]*}"}"
    # remove trailing whitespace characters
    var="${var%"${var##*[![:space:]]}"}"
    echo -n "$var"
}

# Function to update values.yaml based on the OS
update_values_yaml() {
    local property=$1
    local value=$2

    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sed -i "s|$property: .*|$property: \"$value\"|g" values.yaml
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|$property: .*|$property: \"$value\"|g" values.yaml
    else
        echo "Unsupported OS: $OSTYPE"
        return 1
    fi
}


@test "add helm repo" {
    helm repo add percona https://percona.github.io/percona-helm-charts/
}

@test "generate values.yaml" {
    helm show values percona/pmm > values.yaml
}

@test "install/uninstall default chart and check connectivity" {
    stop_port_forward
    helm install pmm \
        --set image.repository=$IMAGE_REPO \
        --set image.tag=$IMAGE_TAG \
        --wait \
        percona/pmm

    wait_for_pmm
    start_port_forward

    pmm_version=$(get_pmm_version)
    echo "pmm_version is ${pmm_version}"

    stop_port_forward
    helm uninstall --wait --timeout 60s pmm
    # maybe pmm uninstall has ability to kill pvcs
    # add validation that there is no load balancer, stateful set and containers/pods left
    delete_pvc
}

@test "install/uninstall with parameter set in cli" {
    stop_port_forward
    local instance_name="pmm1"
    helm install $instance_name \
        --set image.repository=$IMAGE_REPO \
        --set image.tag=$IMAGE_TAG \
        --set-string pmmEnv.PMM_ENABLE_ACCESS_CONTROL="1" \
        --set service.type="NodePort" \
        --wait \
        percona/pmm
    wait_for_pmm

    start_port_forward

    result=$(get_env_variable $instance_name "PMM_ENABLE_ACCESS_CONTROL")
    trimmed_result=$(trim "$result")
    assert_equal "$trimmed_result" "1"

    pmm_version=$(get_pmm_version)
    echo "pmm_version is ${pmm_version}"

    stop_port_forward
    # add check that pmm is working and env var was set

    helm uninstall --wait --timeout 60s pmm1
    delete_pvc
}

@test "install/uninstall chart with file" {
    stop_port_forward
    helm show values percona/pmm > values.yaml

    update_values_yaml "tag" "$IMAGE_TAG"
    update_values_yaml "repository" "$IMAGE_REPO"

    helm install pmm2 -f values.yaml --wait percona/pmm
    wait_for_pmm
    start_port_forward

    pmm_version=$(get_pmm_version)
    echo "pmm_version is ${pmm_version}"

    helm uninstall --wait --timeout 60s pmm2
    delete_pvc
}

@test "install last released V3 version, upgrade to V3 and uninstall" {
    stop_port_forward
    helm show values percona/pmm > values.yaml

    update_values_yaml "tag" "$RELEASE_TAG"
    update_values_yaml "repository" "$RELEASE_REPO"

    helm install pmm3 -f values.yaml --wait percona/pmm
    wait_for_pmm
    start_port_forward

    pmm_version=$(get_pmm_version)
    echo "pmm_version is ${pmm_version}"

    update_values_yaml "tag" "$IMAGE_TAG"
    update_values_yaml "repository" "$IMAGE_REPO"

    helm upgrade pmm3 -f values.yaml --set podSecurityContext.runAsGroup=null --set podSecurityContext.fsGroup=null percona/pmm
    sleep 7 # give a chance to update manifest
    wait_for_pmm

    pmm_version=$(get_pmm_version)

    local new_ver=$(kubectl get pod --selector=app.kubernetes.io/name=pmm -o jsonpath="{.items[*].spec.containers[*].image}")

    if [ "$new_ver" != "$IMAGE_REPO:$IMAGE_TAG" ]; then
        echo "Unexpected version: $new_ver , should be '$IMAGE_REPO:$IMAGE_TAG'"
        cat values.yaml
        false
    fi

    stop_port_forward
    helm uninstall --wait --timeout 60s pmm3
    delete_pvc
}

@test "install last released V2 version, upgrade to V3 and uninstall" {
    stop_port_forward
    helm show values --version 1.3.0 percona/pmm > values.yaml

    update_values_yaml "tag" "2"
    update_values_yaml "repository" "percona/pmm-server"

    helm install pmm4 --version 1.3.0 -f values.yaml --wait percona/pmm

    wait_for_pmm
    start_port_forward 443

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

    pmm_version=${output}
    echo "pmm_version is ${pmm_version}"

    stop_port_forward
    start_port_forward

    helm show values percona/pmm > values.yaml

    update_values_yaml "tag" "$IMAGE_TAG"
    update_values_yaml "repository" "$IMAGE_REPO"

    kubectl exec pmm4-0 -- supervisorctl stop all
    kubectl exec pmm4-0 -- chown -R pmm:pmm /srv

    helm upgrade pmm4 --version 1.4.0 -f values.yaml --set podSecurityContext.runAsGroup=null --set podSecurityContext.fsGroup=null percona/pmm
    sleep 7 # give a chance to update manifest
    wait_for_pmm

    pmm_version=$(get_pmm_version)

    local new_ver=$(kubectl get pod --selector=app.kubernetes.io/name=pmm -o jsonpath="{.items[*].spec.containers[*].image}")

    if [ "$new_ver" != "$IMAGE_REPO:$IMAGE_TAG" ]; then
        echo "Unexpected version: $new_ver , should be '$IMAGE_REPO:$IMAGE_TAG'"
        cat values.yaml
        false
    fi

    stop_port_forward
    helm uninstall --wait --timeout 60s pmm4
    delete_pvc
}

@test "install/uninstall chart with namespaceOverride parameter and check connectivity" {
    local namespace="monitoring-pmm5"

    stop_port_forward
    kubectl create namespace $namespace || true
    kubectl config set-context --current --namespace=${namespace}

    helm install pmm5 \
        --set image.repository=$IMAGE_REPO \
        --set image.tag=$IMAGE_TAG \
        --set namespaceOverride=$namespace \
        --wait \
        percona/pmm

    wait_for_pmm
    start_port_forward

    pmm_version=$(get_pmm_version)
    echo "pmm_version is ${pmm_version}"

    run bash -c "kubectl get pods --namespace=${namespace} | grep pmm5-0"
    assert_success
    assert_output --partial "pmm5-0"
    assert_output --partial "Running"

    stop_port_forward
    helm uninstall --wait --timeout 60s pmm5
    # maybe pmm uninstall has ability to kill pvcs
    # add validation that there is no load balancer, stateful set and containers/pods left
    delete_pvc
}
