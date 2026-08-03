#!/bin/bash

set -euo pipefail

#############################################
# Configuration
#############################################

CLUSTER_LABEL="pmm-ha-shruti-install-ha-3aug"
REGION="ap-west"              # Change if required
K8S_VERSION="1.36"
NODE_TYPE="g6-standard-4"
NODE_COUNT=7

#KUBECONFIG_FILE="$HOME/.kube/pmm-ha-lke-config"

#############################################
# Prerequisite Checks
#############################################

echo "Checking prerequisites..."

for cmd in linode-cli jq kubectl base64; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "ERROR: '$cmd' is not installed."
        exit 1
    fi
done

echo "All required tools found."
echo

#############################################
# Create Cluster
#############################################
echo "Creating Kubernetes cluster..."

linode-cli lke cluster-create \
    --label "$CLUSTER_LABEL" \
    --region "$REGION" \
    --k8s_version "$K8S_VERSION" \
    --node_pools.type "$NODE_TYPE" \
    --node_pools.count "$NODE_COUNT"

echo
echo "Cluster creation request submitted."
echo

#############################################
# Retrieve Cluster ID
#############################################

echo "It takes some time to Create cluster and add nodes. Please wait..."
echo "Retrieving Cluster ID..."
sleep 120

CLUSTER_ID=""
while [ -z "$CLUSTER_ID" ] || [ "$CLUSTER_ID" = "null" ]; do
    CLUSTER_ID=$(linode-cli lke clusters-list --json | jq -r --arg label "$CLUSTER_LABEL" '.[] | select(.label | contains($label)) | .id')
    
    if [ -z "$CLUSTER_ID" ] || [ "$CLUSTER_ID" = "null" ]; then
        echo "Waiting for cluster to appear..."
        sleep 10
        CLUSTER_ID="" # Reset to ensure the loop expression evaluates correctly next turn
    fi
done

echo "Cluster ID: $CLUSTER_ID"

#############################################
# Wait Until Ready
#############################################

echo "Waiting for cluster to become READY..."

[ $(linode-cli lke pools-list "$CLUSTER_ID" --json | jq '.[] | .nodes[] | select(.status == "ready")' | jq -s 'length') -eq $NODE_COUNT ] && echo "Cluster is READY"
sleep 90
#############################################
# Download & Export kubeconfig
#############################################
# Create the directory if it doesn't exist
unset KUBECONFIG
rm -f ~/.kube/config
mkdir -p /tmp/HA-linode

# Download kubeconfig
linode-cli lke kubeconfig-view "$CLUSTER_ID" --json \
| jq -r '.[0].kubeconfig' \
| base64 --decode > /tmp/HA-linode/kubeconfig.yaml

# Export KUBECONFIG
export KUBECONFIG=/tmp/HA-linode/kubeconfig.yaml
#cp /Users/shruti/Scripts/HA-linode/kubeconfig.yaml ~/.kube/config
#chmod 600 ~/.kube/config
echo "KUBECONFIG exported: $KUBECONFIG"

if [ -f /tmp/HA-linode/kubeconfig.yaml ]; then
    export KUBECONFIG=/tmp/HA-linode/kubeconfig.yaml
    echo "Kubeconfig downloaded successfully."
else
    echo "ERROR: Failed to download kubeconfig."
    exit 1
fi
#############################################
# Verify Cluster
#############################################

echo "Current Context:"
kubectl config current-context

echo
echo "Worker Nodes:"
kubectl get nodes

echo
echo "System Pods:"
kubectl get pods -A

#############################################
# Finished
#############################################

echo
echo "======================================="
echo "Linode Kubernetes Cluster is Ready!"
echo "Cluster ID : $CLUSTER_ID"
echo "Kubeconfig : $KUBECONFIG"
echo "======================================="
echo
echo "Cluster is ready for PMM HA Installation using Helm."

sleep 60

######################################
#Install PMM HA dependencies
######################################
# 1. Create PMM Namespace on LKE

kubectl create namespace pmm

#2. Install PMM HA dependencies - Install operators

helm repo add percona https://percona.github.io/percona-helm-charts/ --force-update
helm repo update


helm install pmm-operators percona/pmm-ha-dependencies --namespace pmm

# Wait for all operators to be ready (typically 2-3 minutes)
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/name=victoria-metrics-operator \
  -n pmm --timeout=300s
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/name=altinity-clickhouse-operator \
  -n pmm --timeout=300s
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/name=pg-operator \
  -n pmm --timeout=300s
echo "PMM dependencies installed successfully!"
# check pods
kubectl get pods -n pmm

# Create secret

kubectl create secret generic pmm-secret \
  --from-literal=PMM_ADMIN_PASSWORD="admin" \
  --from-literal=PMM_CLICKHOUSE_USER="clickhouse_pmm" \
  --from-literal=PMM_CLICKHOUSE_PASSWORD="clickhouse-password" \
  --from-literal=VMAGENT_remoteWrite_basicAuth_username="victoriametrics_pmm" \
  --from-literal=VMAGENT_remoteWrite_basicAuth_password="vm-password" \
  --from-literal=PG_PASSWORD="postgres-password" \
  --from-literal=GF_PASSWORD="grafana-password" \
  --namespace pmm
echo " PMM Secrets created successfully!"
sleep 60


#####################################
#Install PMM HA
#####################################

helm install pmm-ha percona/pmm-ha --namespace pmm

# Wait for deployment to complete

kubectl wait --for=condition=ready \
  $(kubectl get pods -n pmm -o name | grep pmm-ha-haproxy) \
  -n pmm --timeout=15m

kubectl get pods -n pmm
echo " HAPPY HELMING!!!!"

#####################################
# External access - LOAD BALANCER
#####################################
kubectl patch svc pmm-ha-haproxy \
  -n pmm \
  -p '{"spec":{"type":"LoadBalancer"}}'

while true; do EXTERNAL_IP=$(kubectl get svc pmm-ha-haproxy -n pmm -o jsonpath='{.status.loadBalancer.ingress[0].ip}'); if [[ -n "$EXTERNAL_IP" ]]; then break; fi; echo "Waiting for LoadBalancer..."; sleep 15; done
echo "External IP: ${EXTERNAL_IP}"
echo "PMM HA is available at:"
echo "https://${EXTERNAL_IP}"

###################################
#Get Events and logs
####################################
mkdir -p /tmp/helm-debug
kubectl get pods -n pmm -o wide > /tmp/helm-debug/pods.txt || true
kubectl get events -n pmm --sort-by=.metadata.creationTimestamp > /tmp/helm-debug/events.txt || true
echo "Pod logs and events at /tmp/helm-debug"
