## pmm k8s post-release helm tests: the published percona/pmm chart against the released PMM
### needs: helm, kubectl, k8s cluster, default kubeconfig, PMM_SERVER_LATEST (e.g. 3.10.0)
### run by jenkins-pipelines pmm/v3/pmm3-post-release-tests.groovy

cleanup () {
    echo "--------cleanup---------"
    stop_port_forward
    helm list --short | xargs -r helm uninstall --wait --timeout 120s || true
    kubectl delete pod,service,statefulset,configmap,secret,serviceaccount --selector=app.kubernetes.io/name=pmm --force || true
    delete_pvc || true
    echo "------------------------"
}

setup() {
    PROJECT_ROOT=$(dirname "$BATS_TEST_FILENAME")
    source "$PROJECT_ROOT/k8s_helper.sh"
    source "$PROJECT_ROOT/pmm_helper.sh"
    # Post-release checks what users get, so always the published chart.
    export PMM_CHART_BRANCH=latest

    if [[ -z "${PMM_SERVER_LATEST:-}" ]]; then
        fail "PMM_SERVER_LATEST must name the released PMM version, e.g. 3.10.0"
    fi

    kubectl config set-context --current --namespace=default
    setup_pmm_chart_source
    cleanup
}

teardown() {
    echo "-------debug info-------"
    kubectl get pods,pvc || true
    kubectl describe pod --selector=app.kubernetes.io/name=pmm || true
    kubectl get events --sort-by=lastTimestamp || true
    kubectl logs --all-containers --timestamps --tail=200 --selector=app.kubernetes.io/name=pmm || true
    echo "------------------------"

    cleanup
}

# Published versions of a percona chart, newest first: "<chart version> <app version>" per line.
chart_releases() {
    helm search repo "percona/$1" --versions --output json \
        | jq -r --arg name "percona/$1" '.[] | select(.name == $name) | "\(.version) \(.app_version)"'
}

pmm_pod_image() {
    kubectl get pod --selector=app.kubernetes.io/name=pmm -o jsonpath="{.items[*].spec.containers[*].image}"
}

# Polls /v1/server/version through the port-forward until it reports the expected version.
assert_pmm_version() {
    local expected=$1
    local pmm_address admin_pass version=""

    pmm_address=$(get_pmm_addr)
    admin_pass=$(get_pmm_pswd)

    for _ in $(seq 1 60); do
        version=$(curl -sk --user "admin:${admin_pass}" "https://${pmm_address}/v1/server/version" | jq -r '.version // empty' || true)
        version=${version%%-*}
        if [[ "$version" == "$expected" ]]; then
            echo "PMM Server reports ${version}"
            return 0
        fi
        sleep 5
    done

    fail "PMM Server reports '${version}', expected '${expected}'"
}

@test "latest published pmm and pmm-ha charts ship the released PMM version" {
    local chart latest
    for chart in pmm pmm-ha; do
        latest=$(chart_releases "$chart" | head -1)
        echo "percona/${chart} latest chart and app version: ${latest}"
        assert_equal "$(echo "$latest" | awk '{print $2}')" "$PMM_SERVER_LATEST"
    done
}

@test "install the released chart and check it serves the released version" {
    install_pmm_chart pmm-fresh --wait --timeout 10m
    wait_for_pmm

    assert_equal "$(pmm_pod_image)" "percona/pmm-server:${PMM_SERVER_LATEST}"

    start_port_forward
    assert_pmm_version "$PMM_SERVER_LATEST"
}

@test "upgrade from the previous chart release to the latest one" {
    local releases prev_chart prev_app latest_chart
    releases=$(chart_releases pmm)
    latest_chart=$(echo "$releases" | sed -n 1p | awk '{print $1}')
    prev_chart=$(echo "$releases" | sed -n 2p | awk '{print $1}')
    prev_app=$(echo "$releases" | sed -n 2p | awk '{print $2}')

    if [[ -z "$prev_chart" ]]; then
        fail "Need two published percona/pmm chart versions, got: ${releases}"
    fi
    echo "Upgrading chart ${prev_chart} (PMM ${prev_app}) -> ${latest_chart}"

    helm install pmm-upgrade percona/pmm --version "$prev_chart" --wait --timeout 10m
    wait_for_pmm
    start_port_forward
    assert_pmm_version "$prev_app"
    stop_port_forward

    helm upgrade pmm-upgrade percona/pmm --version "$latest_chart" --wait --timeout 10m
    kubectl rollout status statefulset/pmm-upgrade --timeout=10m
    wait_for_pmm

    assert_equal "$(pmm_pod_image)" "percona/pmm-server:${PMM_SERVER_LATEST}"

    start_port_forward
    assert_pmm_version "$PMM_SERVER_LATEST"
}
