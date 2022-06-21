#!/bin/bash

set -e

INSTALL_DIR=/usr/local/bin
INSTALL_ALL="true"

USER_MODE=${USER_MODE:-"false"}
USE_SUDO=${USE_SUDO:-"false"}

INSTALL_KUBECTL=${INSTALL_KUBECTL:-"false"}
INSTALL_MINIKUBE=${INSTALL_MINIKUBE:-"false"}
INSTALL_KIND=${INSTALL_KIND:-"false"}
INSTALL_HELM=${INSTALL_HELM:-"false"}

runAsRoot() {
  if [ $EUID -ne 0 -a "$USE_SUDO" = "true" ]; then
    sudo "${@}"
  else
    "${@}"
  fi
}

usage()
{
  echo "Script installs k8s tools
        
        Usage: install_k8s_tools.sh [ --kubectl ]
                        [ --minikube ]
                        [ --kind ]
                        [ --helm ]
                        [ --user ]

        Run as root unless you use --sudo or --user mode
        By default installs all tools, unless special tools selected

        --kubectl installs latest kubectl
        --minikube installs latest minikube
        --kind installs latest kind
        --helm installs latest helm

        --user install tool[s] into ~/.local/bin instead of /usr/local/bin
        --sudo use sudo when installing to /usr/local/bin
        "
  exit 2
}

TEMP=$(getopt -n 'install_k8s_tools.sh' -o '' --long 'kubectl,minikube,kind,helm,user,sudo' -- "$@")
if [ $? -ne 0 ]; then
  usage
fi

eval set -- "$TEMP"
unset TEMP

while true; do
  case "$1" in
    --kubectl)
        INSTALL_KUBECTL="true"
        INSTALL_ALL="false"
        shift
        continue
    ;;
    --minikube)
        INSTALL_MINIKUBE="true"
        INSTALL_ALL="false"
        shift
        continue
    ;;
    --kind)
        INSTALL_KIND="true"
        INSTALL_ALL="false"
        shift
        continue
    ;;
    --helm)
        INSTALL_HELM="true"
        INSTALL_ALL="false"
        shift
        continue
    ;;
    --user)
        USER_MODE="true"
        shift
        continue
    ;;
    --sudo) 
        USE_SUDO="true"
        shift
        continue
    ;;
    --) 
        shift
        break
    ;;
    *)
        echo 'Internal error!' >&2
        usage
    ;;
  esac
done

if [[ "$USER_MODE" == "true" && "$USE_SUDO" == "true" ]]; then
    echo "--user mode conflicts with --sudo"
    exit 1
fi

if [ "${USER_MODE}" = "true" ]; then
    # --user should install in ~/.local/bin/
    INSTALL_DIR=~/.local/bin
fi

# create install directory
runAsRoot mkdir -p $INSTALL_DIR

install_bin()
{
    if [ "${USER_MODE}" = "true" ]; then
        mv ./$1 $INSTALL_DIR/$1
    else
        runAsRoot install -o root -g root -m 0755 $1 $INSTALL_DIR
    fi    
}

install_kubectl()
{

    curl -sLO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
    curl -sLO "https://dl.k8s.io/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl.sha256"
    echo "$(cat kubectl.sha256)  kubectl" | sha256sum --check --status || exit 1

    chmod +x kubectl

    install_bin kubectl

    rm kubectl.sha256 kubectl 2>&1 1>/dev/null || true

    echo "kubectl version --client --output=yaml"
    kubectl version --client --output=yaml
}

install_minikube()
{
    curl -sLo minikube https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
    chmod +x minikube

    install_bin minikube

    rm minikube 2>&1 1>/dev/null || true

    echo "minikube version"
    minikube version
}

install_kind()
{
    local release=$(curl --silent "https://api.github.com/repos/kubernetes-sigs/kind/releases/latest" | # Get latest release from GitHub api
    grep '"tag_name":' |                                            # Get tag line
    sed -E 's/.*"([^"]+)".*/\1/')

    curl -sLo ./kind https://kind.sigs.k8s.io/dl/$release/kind-linux-amd64
    chmod +x ./kind

    install_bin kind

    rm kind 2>&1 1>/dev/null || true

    echo "kind version"
    kind version
}

install_helm()
{
    curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
    chmod +x get_helm.sh

    HELM_INSTALL_DIR=$INSTALL_DIR USE_SUDO=$USE_SUDO ./get_helm.sh 2>&1 1>/dev/null
    
    rm get_helm.sh 2>&1 1>/dev/null || true
    
    echo "helm version"
    helm version
}

## --kubectl
if [[ "$INSTALL_KUBECTL" = "true" || "$INSTALL_ALL" == "true" ]]; then
    install_kubectl
fi

## --minikube
if [[ "$INSTALL_MINIKUBE" = "true" || "$INSTALL_ALL" == "true" ]]; then
    install_minikube
fi

## --kind
if [[ "$INSTALL_KIND" = "true" || "$INSTALL_ALL" == "true" ]]; then
    install_kind
fi

## --helm
if [[ "$INSTALL_HELM" = "true" || "$INSTALL_ALL" == "true" ]]; then
    install_helm
fi

exit 0
