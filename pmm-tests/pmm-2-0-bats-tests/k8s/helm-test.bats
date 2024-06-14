## pmm k8s helm tests
### needs: helm, kubectl, k8s cluster with snapshotclass, default kubeconfig
## add comment #bats test_tags=bats:focus above the test to focus it

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
    IMAGE_TAG=${IMAGE_TAG:-"dev-latest"}
    RELEASE_REPO="percona/pmm-server"
    RELEASE_TAG="2"

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
        --set-string pmmEnv.ENABLE_DBAAS="1" \
        --set service.type="NodePort" \
        --wait \
        percona/pmm
    wait_for_pmm

    start_port_forward

    result=$(get_env_variable $instance_name "ENABLE_DBAAS")
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

    sed -i '' "s|tag: .*|tag: \"$IMAGE_TAG\"|g" values.yaml
    sed -i '' "s|repository:.*|repository: $IMAGE_REPO|g" values.yaml

    helm install pmm -f values.yaml --wait percona/pmm
    wait_for_pmm
    start_port_forward

    pmm_version=$(get_pmm_version)
    echo "pmm_version is ${pmm_version}"

    helm uninstall --wait --timeout 60s pmm
    delete_pvc
}

@test "install/uninstall chart with values from file and update pmm from last released version" {
    stop_port_forward
    helm show values percona/pmm > values.yaml

    sed -i '' "s|tag: .*|tag: \"$RELEASE_TAG\"|g" values.yaml
    sed -i '' "s|repository:.*|repository: $RELEASE_REPO|g" values.yaml

    helm install pmm3 -f values.yaml --wait percona/pmm
    wait_for_pmm
    start_port_forward

    pmm_version=$(get_pmm_version)
    echo "pmm_version is ${pmm_version}"

    sed -i '' "s|tag: .*|tag: \"$IMAGE_TAG\"|g" values.yaml
    sed -i '' "s|repository:.*|repository: $IMAGE_REPO|g" values.yaml

    helm upgrade pmm3 -f values.yaml percona/pmm
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
