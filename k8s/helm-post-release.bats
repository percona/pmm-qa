## pmm k8s post-release helm tests: the published percona/pmm chart against the released PMM
### needs: helm, kubectl, k8s cluster, default kubeconfig, PMM_SERVER_LATEST (e.g. 3.10.0),
### PMM_SERVER_PREVIOUS (e.g. 3.9.1) for the upgrade
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

@test "PMM-T2411 - latest published pmm and pmm-ha charts ship the released PMM version" {
    local chart latest
    for chart in pmm pmm-ha; do
        latest=$(chart_releases "$chart" | head -1)
        echo "percona/${chart} latest chart and app version: ${latest}"
        assert_equal "$(echo "$latest" | awk '{print $2}')" "$PMM_SERVER_LATEST"
    done
}

@test "PMM-T1320 - install the released chart and check it serves the released version" {
    install_pmm_chart pmm-fresh --wait --timeout 10m
    wait_for_pmm

    assert_equal "$(pmm_pod_image)" "percona/pmm-server:${PMM_SERVER_LATEST}"

    start_port_forward
    assert_pmm_version "$PMM_SERVER_LATEST"
}

@test "PMM-T2412 - upgrade from the previous release's chart to the latest one" {
    if [[ -z "${PMM_SERVER_PREVIOUS:-}" ]]; then
        fail "PMM_SERVER_PREVIOUS must name the release before PMM_SERVER_LATEST, e.g. 3.9.1"
    fi

    # By app version, not position: a chart-only release reuses the PMM version.
    local prev_chart latest_chart
    prev_chart=$(chart_for_app pmm "$PMM_SERVER_PREVIOUS")
    latest_chart=$(chart_for_app pmm "$PMM_SERVER_LATEST")
    if [[ -z "$prev_chart" || -z "$latest_chart" ]]; then
        fail "No published percona/pmm chart for PMM ${PMM_SERVER_PREVIOUS} ('${prev_chart}') or ${PMM_SERVER_LATEST} ('${latest_chart}')"
    fi
    echo "Upgrading chart ${prev_chart} (PMM ${PMM_SERVER_PREVIOUS}) -> ${latest_chart} (PMM ${PMM_SERVER_LATEST})"

    helm install pmm-upgrade percona/pmm --version "$prev_chart" -f "$PMM_TELEMETRY_VALUES" --wait --timeout 10m
    wait_for_pmm
    assert_equal "$(pmm_pod_image)" "percona/pmm-server:${PMM_SERVER_PREVIOUS}"
    start_port_forward
    assert_pmm_version "$PMM_SERVER_PREVIOUS"
    stop_port_forward

    helm upgrade pmm-upgrade percona/pmm --version "$latest_chart" -f "$PMM_TELEMETRY_VALUES" --wait --timeout 10m
    kubectl rollout status statefulset/pmm-upgrade --timeout=10m
    wait_for_pmm

    assert_equal "$(pmm_pod_image)" "percona/pmm-server:${PMM_SERVER_LATEST}"

    start_port_forward
    assert_pmm_version "$PMM_SERVER_LATEST"
}
