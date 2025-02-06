wait_for_pmm(){
    sleep 5
    kubectl wait --for=condition=Ready --selector=app.kubernetes.io/name=pmm pod --timeout=5m
}

delete_pvc(){
    kubectl delete pvc --selector=app.kubernetes.io/name=pmm
    kubectl wait --for=delete --selector=app.kubernetes.io/name=pmm pvc --timeout=5m
}

get_pmm_pswd(){
    kubectl get secret pmm-secret -o jsonpath='{.data.PMM_ADMIN_PASSWORD}' | base64 --decode
}

# Function to start port forwarding
start_port_forward(){
    local inner_port=${1:-8443}  # Set to first argument or default to 8443
    POD_NAME=$(kubectl get pods -n default -l app.kubernetes.io/name=pmm -o jsonpath='{.items[0].metadata.name}')
    
    kubectl port-forward "$POD_NAME" 8443:"${inner_port}" -n default &  
    PORT_FORWARD_PID=$!
    
    echo $PORT_FORWARD_PID > port_forward.pid
    sleep 5 # Give port forwarding some time to set up
}


# Function to stop port forwarding
stop_port_forward(){
    if [ -f port_forward.pid ]; then
        PORT_FORWARD_PID=$(cat port_forward.pid)
        kill $PORT_FORWARD_PID || true
        rm port_forward.pid
    fi
}

# Retrieves the value of a specified environment variable from the first pod of a given Kubernetes instance.
get_env_variable(){
    local instance_name=$1
    local env_var=$2
    local pod_name=$(kubectl get pods -l app.kubernetes.io/instance=$instance_name -o jsonpath='{.items[0].metadata.name}')
    kubectl exec -it $pod_name -- printenv $env_var
}

