wait_for_pmm()
{
    sleep 5
    kubectl wait --for=condition=Ready --selector=app.kubernetes.io/name=pmm pod --timeout=5m
}

delete_pvc()
{
    kubectl delete pvc --selector=app.kubernetes.io/name=pmm
    kubectl wait --for=delete --selector=app.kubernetes.io/name=pmm pvc --timeout=5m
}

get_pmm_pswd()
{
    kubectl get secret pmm-secret -o jsonpath='{.data.PMM_ADMIN_PASSWORD}' | base64 --decode
}

get_pmm_addr()
{
    local node_port=$(kubectl get --namespace default -o jsonpath="{.spec.ports[0].nodePort}" services monitoring-service)
    local node_ip=$(kubectl get nodes --namespace default -o jsonpath="{.items[0].status.addresses[0].address}")
    echo $node_ip:$node_port
}
