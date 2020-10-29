#!/bin/bash

### Script to generate kubeconfig file with secerts on ec2-spot instance, --driver=none because we need service exposed for pmm-server.
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root"
   exit 1
fi

### setup minikube and kubectl
curl -Lo /usr/local/bin/minikube https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
chmod +x /usr/local/bin/minikube

curl -Lo https://storage.googleapis.com/kubernetes-release/release/`curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt`/bin/linux/amd64/kubectl
chmod +x ./kubectl
mv ./kubectl /usr/local/bin/kubectl

export CHANGE_MINIKUBE_NONE_USER=true
# sudo su root
# curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
# sudo install minikube-linux-amd64 /usr/local/bin/minikube

alias minikube="/usr/local/bin/minikube"

minikube config set cpus 3
minikube config set memory 4096
minikube config set kubernetes-version 1.16.8


git clone https://github.com/percona-platform/dbaas-controller.git

cd dbaas-controller/

sed -i 's/minikube start/minikube start --driver=none/g' Makefile

sed -i 's+minikube+/usr/local/bin/minikube+g' Makefile

make env-up

mv /root/.kube /root/.minikube $HOME
chown -R $USER $HOME/.kube $HOME/.minikube


export SECRET_NAME=$(/usr/local/bin/kubectl get secrets | grep percona-xtradb-cluster-operator | cut -f1 -d ' ')

export TOKEN=$(/usr/local/bin/kubectl describe secret $SECRET_NAME | grep -E '^token' | cut -f2 -d':' | tr -d " ")

export APISERVER=$(curl http://169.254.169.254/latest/meta-data/public-ipv4):8443

cd ../

mv kubeconfig_sample.yaml kubeconfig.yaml

sed -i "s+{SERVER_INFO}+${APISERVER}+g" kubeconfig.yaml

sed -i "s+{TOKEN}+${TOKEN}+g" kubeconfig.yaml
