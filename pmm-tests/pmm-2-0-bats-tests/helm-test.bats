## pmm k8s helm tests
### needs: helm, kubectl, k8s cluster, default kubeconfig

setup() {

    PROJECT_ROOT=$(dirname "$BATS_TEST_FILENAME")

    echo "file name $BATS_TEST_FILENAME"

    source "$PROJECT_ROOT/k8s_helper.sh"
}

teardown() {

    echo "cleanup"
    kubectl delete pods,services,statefulsets,configmaps,secrets --selector=app.kubernetes.io/name=pmm --force || true
    delete_pvc || true
    rm values.yaml || true
}

@test "add helm repo" {
    helm repo add percona https://percona.github.io/percona-helm-charts/
}

@test "generate values.yaml" {
    helm show values percona/pmm > values.yaml
}

@test "install/uninstall default chart and check connectivity" {
    helm install pmm percona/pmm
    wait_for_pmm

    # depends on the driver, but probably local PVC wouldn't be cleaned up
    # and pass would be set only during this first pvc init
    # so always use new name if you want to provision PVC in helm install (pmmX)
    local admin_pass=$(get_pmm_pswd)
    local pmm_address=$(get_pmm_addr)

    #encode pass, as it can have special characters
    local encoded_u_p=$(echo -n admin:${admin_pass} | base64)

    echo "curl -k -H 'Authorization: Basic ...' https://"${pmm_address}"/v1/version"
    run bash -c "curl -sk -H 'Authorization: Basic ${encoded_u_p}' https://${pmm_address}/v1/version"
    echo $output
    [ "$status" -eq 0 ]
    echo "${output}" | grep "full_version"

    helm uninstall --wait --timeout 60s pmm
    delete_pvc
}

@test "install/uninstall with parameter set in cli" {
    helm install pmm1 \
        --set-string pmmEnv.ENABLE_DBAAS="1" \
        --set service.type="NodePort" \
        percona/pmm
    wait_for_pmm
    helm uninstall --wait --timeout 60s pmm1
    delete_pvc
}

@test "install/uninstall chart with default values from file" {
    helm show values percona/pmm > values.yaml
    helm install pmm -f values.yaml percona/pmm
    wait_for_pmm

    helm uninstall --wait --timeout 60s pmm
    delete_pvc
}

@test "install/uninstall chart with values from file and update pmm" {
    helm show values percona/pmm > values.yaml
    helm install pmm3 -f values.yaml percona/pmm
    wait_for_pmm

    sed -i "s|tag: .*|tag: \"dev-latest\"|g" values.yaml
    sed -i "s|percona/pmm-server|perconalab/pmm-server|g" values.yaml

    helm upgrade pmm3 -f values.yaml percona/pmm
    sleep 7 # give a chance to update manifest
    wait_for_pmm

    local new_ver=$(kubectl get pod --selector=app.kubernetes.io/name=pmm -o jsonpath="{.items[*].spec.containers[*].image}")

    if [ "$new_ver" != "perconalab/pmm-server:dev-latest" ]; then
        echo "Unexpected version: $new_ver , should be 'perconalab/pmm-server:dev-latest'"
        cat values.yaml
        false
    fi

    helm uninstall --wait --timeout 60s pmm3
    delete_pvc
}
