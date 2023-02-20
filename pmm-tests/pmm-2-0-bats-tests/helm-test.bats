## pmm k8s helm tests
### needs: helm, kubectl, k8s cluster with snapshotclass, default kubeconfig

setup() {

    PROJECT_ROOT=$(dirname "$BATS_TEST_FILENAME")

    echo "file name $BATS_TEST_FILENAME"

    source "$PROJECT_ROOT/k8s_helper.sh"

    # set default image from the repo charts or take it as a parameters from CI
    IMAGE_REPO=${IMAGE_REPO:-"percona/pmm-server"}
    IMAGE_TAG=${IMAGE_TAG:-"2"}
}

teardown() {

    echo "-------debug info-------"

    kubectl get pods
    kubectl describe pod --selector=app.kubernetes.io/name=pmm
    kubectl get events --sort-by=lastTimestamp
    kubectl logs --all-containers --timestamps --selector=app.kubernetes.io/name=pmm
    echo "------------------------"

    echo "--------cleanup---------"
    helm list --short | xargs helm uninstall || true
    kubectl delete pod,service,statefulset,configmap,secret,serviceaccount,volumesnapshot --selector=app.kubernetes.io/name=pmm --force || true
    delete_pvc || true
    rm values.yaml || true
    echo "------------------------"
}

@test "add helm repo" {
    helm repo add percona https://percona.github.io/percona-helm-charts/
}

@test "generate values.yaml" {
    helm show values percona/pmm > values.yaml
}

@test "install/uninstall default chart and check connectivity" {
    helm install pmm \
        --set image.repository=$IMAGE_REPO \
        --set image.tag=$IMAGE_TAG \
        --wait \
        percona/pmm
    wait_for_pmm

    # depends on the driver, but probably local PVC wouldn't be cleaned up
    # and pass would be set only during this first pvc init
    # so always use new name if you want to provision PVC in helm install (pmmX)
    local admin_pass=$(get_pmm_pswd)
    local pmm_address=$(get_pmm_addr)

    #encode pass, as it can have special characters
    local encoded_u_p=$(echo -n admin:${admin_pass} | base64)

    echo "curl -k -H 'Authorization: Basic ...' https://"${pmm_address}"/v1/version"
    #echo admin pass in case there are some issues with it
    echo "pass:${admin_pass}"

    run bash -c "curl -sk -H 'Authorization: Basic ${encoded_u_p}' https://${pmm_address}/v1/version"
    echo $output
    [ "$status" -eq 0 ]
    echo "${output}" | grep "full_version"


    helm uninstall --wait --timeout 60s pmm
    delete_pvc
}

@test "install/uninstall with parameter set in cli" {
    helm install pmm1 \
        --set image.repository=$IMAGE_REPO \
        --set image.tag=$IMAGE_TAG \
        --set-string pmmEnv.ENABLE_DBAAS="1" \
        --set service.type="NodePort" \
        --wait \
        percona/pmm
    wait_for_pmm

    # this returns 1 with k8s>1.24, but will return 2 with k8s<1.24 
    run bash -c "kubectl get sa pmm-service-account -o json | jq  '.secrets|length'"
    [ "$output" = "1" ] || [ "$output" = "2" ]

    helm uninstall --wait --timeout 60s pmm1
    delete_pvc
}

@test "install/uninstall chart with default values from file" {
    helm show values percona/pmm > values.yaml

    sed -i "s|tag: .*|tag: \"$IMAGE_TAG\"|g" values.yaml
    sed -i "s|repository:.*|repository: $IMAGE_REPO|g" values.yaml

    helm install pmm -f values.yaml --wait percona/pmm
    wait_for_pmm

    helm uninstall --wait --timeout 60s pmm
    delete_pvc
}

@test "install/uninstall chart with values from file and update pmm" {
    helm show values percona/pmm > values.yaml

    sed -i "s|tag: .*|tag: \"$IMAGE_TAG\"|g" values.yaml
    sed -i "s|repository:.*|repository: $IMAGE_REPO|g" values.yaml

    helm install pmm3 -f values.yaml --wait percona/pmm
    wait_for_pmm

    sed -i "s|tag: .*|tag: \"dev-latest\"|g" values.yaml
    sed -i "s|repository:.*|repository: perconalab/pmm-server|g" values.yaml

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

@test "Backup and restore test" {

    cat << EOF | kubectl create -f -
apiVersion: v1
kind: Secret
metadata:
  name: pmm-secret
  labels:
    app.kubernetes.io/name: "pmm"
type: Opaque
data:
# base64 encoded password
# encode some password: `echo -n "admin" | base64`
  PMM_ADMIN_PASSWORD: YWRtaW4=
EOF

    local some_old_version=2.33.0

    helm install pmm4 \
        --set image.tag=$some_old_version \
        --set secret.create=false \
        --set secret.name=pmm-secret \
        --wait \
        percona/pmm
    wait_for_pmm

    local admin_pass=$(get_pmm_pswd)
    local pmm_address=$(get_pmm_addr)
    local encoded_u_p=$(echo -n admin:${admin_pass} | base64)

    ### -------- Backup

    kubectl scale statefulset pmm4 --replicas=0
    kubectl wait --for=jsonpath='{.status.replicas}'=0 statefulset pmm4

    cat << EOF | kubectl create -f -
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: before-upgrade-from-v$some_old_version
  labels:
    app.kubernetes.io/name: "pmm"
spec:
  volumeSnapshotClassName: csi-hostpath-snapclass
  source:
    persistentVolumeClaimName: pmm-storage-pmm4-0
EOF

    kubectl wait --for=jsonpath='{.status.readyToUse}'=true VolumeSnapshot/before-upgrade-from-v$some_old_version --timeout=5m
    kubectl scale statefulset pmm4 --replicas=1

    kubectl get volumesnapshot

    ### -------- Upgrade

    helm upgrade pmm4 \
        --set image.repository=$IMAGE_REPO \
        --set image.tag=$IMAGE_TAG \
        --set secret.create=false \
        --set secret.name=pmm-secret \
        --wait \
        percona/pmm
    wait_for_pmm

    admin_pass=$(get_pmm_pswd)
    pmm_address=$(get_pmm_addr)
    encoded_u_p=$(echo -n admin:${admin_pass} | base64)

    run bash -c "curl -sk -H 'Authorization: Basic ${encoded_u_p}' https://${pmm_address}/v1/version | jq .version"
    echo "New version: $output"
    [ "$status" -eq 0 ]

    [ "${output//\"}" = "$IMAGE_TAG" ] || [ "$IMAGE_TAG" = "2" ]

    helm uninstall --wait --timeout 60s pmm4

    ### -------- Restore

    helm install pmm5 \
        --set image.tag=$some_old_version \
        --set storage.name="pmm-storage-old" \
        --set storage.dataSource.name="before-upgrade-from-v$some_old_version" \
        --set storage.dataSource.kind="VolumeSnapshot" \
        --set storage.dataSource.apiGroup="snapshot.storage.k8s.io" \
        --set secret.create=false \
        --set secret.name=pmm-secret \
        percona/pmm
    wait_for_pmm

    admin_pass=$(get_pmm_pswd)
    pmm_address=$(get_pmm_addr)
    encoded_u_p=$(echo -n admin:${admin_pass} | base64)

    run bash -c "curl -sk -H 'Authorization: Basic ${encoded_u_p}' https://${pmm_address}/v1/version | jq .version"
    echo "Old version: $output"
    [ "$status" -eq 0 ]

    [ "${output//\"}" = "$some_old_version" ]

    helm uninstall --wait --timeout 60s pmm5

    kubectl delete secret pmm-secret
    kubectl delete volumesnapshot --selector=app.kubernetes.io/name=pmm
    kubectl wait --for=delete --selector=app.kubernetes.io/name=pmm volumesnapshot --timeout=5m
    delete_pvc
}
