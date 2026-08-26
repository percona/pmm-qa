#!/bin/bash
# Install - or upgrade - PMM in HA mode on an existing Kubernetes cluster.
#
# One entry point for every platform QA runs HA on:
#   eks        EKS, as created by jenkins-pipelines pmm3-ha-eks
#   openshift  ROSA, as created by jenkins-pipelines pmm3-ha-rosa (kubectl only,
#              no oc binary needed)
#   lke        Linode LKE (PMM-14744)
#
# Acts on whatever KUBECONFIG points at: it never creates a cluster and never
# authenticates to one. `helm upgrade --install` throughout, so re-running with a
# different --image upgrades the release in place, and --charts picks which of the
# two charts a run touches.
#
#   ./install_pmm_ha.sh --platform eks --external-access
#   ./install_pmm_ha.sh --platform lke --image percona/pmm-server:3.9.0
#   ./install_pmm_ha.sh --platform eks --charts deps
#   ./install_pmm_ha.sh --platform eks --charts pmm-ha --image perconalab/pmm-server:3-dev-latest
#   ./install_pmm_ha.sh --platform openshift --chart-branch PMM-HA-GA
#
# With no --image it installs the newest released percona/pmm-server tag, resolved
# from Docker Hub.

set -euo pipefail

PLATFORM="${PLATFORM:-}"
NAMESPACE="${NAMESPACE:-pmm}"
RELEASE="${RELEASE:-pmm-ha}"
DEPS_RELEASE="${DEPS_RELEASE:-pmm-operators}"
CHART_DIR="${CHART_DIR:-}"
# Same contract as k8s/pmm_helper.sh: "latest" is the published chart, anything
# else is a percona-helm-charts branch to clone.
CHART_BRANCH="${CHART_BRANCH:-${PMM_CHART_BRANCH:-latest}}"
CHART_REPO="${CHART_REPO:-https://github.com/percona/percona-helm-charts.git}"
CHART_VERSION="${CHART_VERSION:-}"
DEPS_CHART_VERSION="${DEPS_CHART_VERSION:-}"
IMAGE="${PMM_IMAGE:-}"
# An image or an external-access flag picked up from the environment is ambient -
# a caller exporting PMM_IMAGE for something else should not break a --charts deps
# run - so only an explicit flag is an error in a mode that cannot use it.
IMAGE_FROM_FLAG="false"
EXTERNAL_ACCESS_FROM_FLAG="false"
ADMIN_PASSWORD="${PMM_ADMIN_PASSWORD:-}"
EXTERNAL_ACCESS="${EXTERNAL_ACCESS:-false}"
CHARTS="${CHARTS:-all}"
TIMEOUT="${TIMEOUT:-15m}"
DEBUG_DIR="${DEBUG_DIR:-${PWD}/pmm-ha-debug}"
SUMMARY_FILE="${SUMMARY_FILE:-${PWD}/pmm-ha-summary.env}"
RELEASED_REPOSITORY="${RELEASED_REPOSITORY:-percona/pmm-server}"
# Operators report Ready before their admission webhooks hold a TLS cert, and the
# pmm-ha install then fails against a webhook that cannot serve. Only observed on
# OpenShift, hence the platform default.
WEBHOOK_SETTLE_SECONDS="${WEBHOOK_SETTLE_SECONDS:-}"
EXTRA_SET=()

# pmm3-ha-eks / pmm3-ha-rosa already pass the image split in two, accept it as-is.
if [ -z "$IMAGE" ] && [ -n "${PMM_IMAGE_REPOSITORY:-}" ] && [ -n "${PMM_IMAGE_TAG:-}" ]; then
    IMAGE="${PMM_IMAGE_REPOSITORY}:${PMM_IMAGE_TAG}"
fi

PMM_SERVER_SELECTOR='app.kubernetes.io/component=pmm-server'
HAPROXY_SELECTOR='app.kubernetes.io/name=haproxy'
HAPROXY_SERVICE='pmm-ha-haproxy'
OPERATOR_NAMES=(victoria-metrics-operator altinity-clickhouse-operator pg-operator)

usage() {
    echo "Installs or upgrades PMM HA on the cluster KUBECONFIG points at.

        Usage: install_pmm_ha.sh --platform <eks|openshift|lke> [options]

        --platform PLATFORM     required; eks, openshift or lke
        --namespace NS          namespace to install into (default: pmm)
        --release NAME          pmm-ha release name (default: pmm-ha)
        --deps-release NAME     pmm-ha-dependencies release name (default: pmm-operators)
        --chart-branch BRANCH   install the pmm-ha chart from this percona-helm-charts
                                branch, cloned into a temp dir (default: latest, which
                                is the published chart)
        --chart-dir DIR         install from a percona-helm-charts checkout you already
                                have, instead of cloning or using the published repo
        --chart-version VER     published pmm-ha chart version (default: latest)
        --deps-chart-version VER published pmm-ha-dependencies chart version (default:
                                latest). The two charts are versioned separately -
                                pmm-ha is on 1.6.x while the dependencies chart is
                                on 1.0.0 - so one version cannot pin both.
        --image REPO:TAG        PMM Server image; defaults to the newest released
                                ${RELEASED_REPOSITORY} tag on Docker Hub
        --admin-password PW     PMM admin password; generated when a new pmm-secret
                                is created and no password is given
        --external-access       expose HAProxy and wait for PMM to serve on it:
                                an NLB on eks, a LoadBalancer on lke, a Route on openshift
        --set KEY=VALUE         extra --set for the pmm-ha chart; repeatable
        --charts WHICH          which charts to install or upgrade (default: all)
                                  all     pmm-ha-dependencies, then pmm-ha
                                  deps    pmm-ha-dependencies only
                                  pmm-ha  pmm-ha only, on operators already there
        --timeout DURATION      helm and rollout timeout (default: 15m)
        --debug-dir DIR         diagnostics collected on failure (default: ./pmm-ha-debug)
        --summary-file PATH     credentials and URL (default: ./pmm-ha-summary.env)

        Every option also reads an env var: PLATFORM, NAMESPACE, RELEASE,
        DEPS_RELEASE, CHART_DIR, CHART_BRANCH (or PMM_CHART_BRANCH), CHART_REPO, CHART_VERSION, PMM_IMAGE (or
        DEPS_CHART_VERSION, PMM_IMAGE_REPOSITORY + PMM_IMAGE_TAG), PMM_ADMIN_PASSWORD,
        EXTERNAL_ACCESS, CHARTS, TIMEOUT, DEBUG_DIR, SUMMARY_FILE,
        RELEASED_REPOSITORY.
        "
    exit 2
}

while [ $# -gt 0 ]; do
    case "$1" in
        --platform)        PLATFORM="$2"; shift 2 ;;
        --namespace)       NAMESPACE="$2"; shift 2 ;;
        --release)         RELEASE="$2"; shift 2 ;;
        --deps-release)    DEPS_RELEASE="$2"; shift 2 ;;
        --chart-branch)    CHART_BRANCH="$2"; shift 2 ;;
        --chart-dir)       CHART_DIR="$2"; shift 2 ;;
        --chart-version)   CHART_VERSION="$2"; shift 2 ;;
        --deps-chart-version) DEPS_CHART_VERSION="$2"; shift 2 ;;
        --image)           IMAGE="$2"; IMAGE_FROM_FLAG="true"; shift 2 ;;
        --admin-password)  ADMIN_PASSWORD="$2"; shift 2 ;;
        --external-access) EXTERNAL_ACCESS="true"; EXTERNAL_ACCESS_FROM_FLAG="true"; shift ;;
        --set)             EXTRA_SET+=(--set "$2"); shift 2 ;;
        --charts)          CHARTS="$2"; shift 2 ;;
        --timeout)         TIMEOUT="$2"; shift 2 ;;
        --debug-dir)       DEBUG_DIR="$2"; shift 2 ;;
        --summary-file)    SUMMARY_FILE="$2"; shift 2 ;;
        -h|--help)         usage ;;
        *)                 echo "ERROR: unknown option '$1'" >&2; usage ;;
    esac
done

log() { echo "[pmm-ha] $*"; }
fail() { echo "ERROR: $*" >&2; exit 1; }

# Jenkins booleans arrive as true/1/yes depending on the caller.
normalize_bool() {
    case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
        true|1|yes|y) echo "true" ;;
        *) echo "false" ;;
    esac
}
EXTERNAL_ACCESS="$(normalize_bool "$EXTERNAL_ACCESS")"

case "$CHARTS" in
    all)    INSTALL_DEPS="true";  INSTALL_PMM="true" ;;
    deps)   INSTALL_DEPS="true";  INSTALL_PMM="false" ;;
    pmm-ha) INSTALL_DEPS="false"; INSTALL_PMM="true" ;;
    *) fail "--charts must be all, deps or pmm-ha; got '$CHARTS'." ;;
esac

case "$PLATFORM" in
    eks|lke|openshift) ;;
    "") fail "--platform is required (eks, openshift or lke)." ;;
    *)  fail "unknown platform '$PLATFORM'; expected eks, openshift or lke." ;;
esac

for cmd in kubectl helm openssl; do
    command -v "$cmd" >/dev/null 2>&1 || fail "'$cmd' is not installed."
done
if [ "$EXTERNAL_ACCESS" = "true" ]; then
    command -v curl >/dev/null 2>&1 || fail "'curl' is not installed, needed by --external-access."
fi

if [ "$INSTALL_PMM" = "false" ]; then
    if [ -n "$IMAGE" ]; then
        [ "$IMAGE_FROM_FLAG" = "false" ] || fail "--image applies to the pmm-ha chart, which --charts $CHARTS does not install."
        log "WARNING: ignoring the image from the environment, --charts $CHARTS does not install pmm-ha"
        IMAGE=""
    fi

    if [ "$EXTERNAL_ACCESS" = "true" ]; then
        [ "$EXTERNAL_ACCESS_FROM_FLAG" = "false" ] || fail "--external-access applies to the pmm-ha chart, which --charts $CHARTS does not install."
        log "WARNING: ignoring external access from the environment, --charts $CHARTS does not install pmm-ha"
        EXTERNAL_ACCESS="false"
    fi

    [ -z "$CHART_VERSION" ] || log "WARNING: --chart-version ignored, --charts $CHARTS does not install pmm-ha"
elif [ -n "$IMAGE" ]; then
    [[ "$IMAGE" == *:* ]] || fail "--image must be a repository:tag pair, got '$IMAGE'."
else
    for cmd in curl jq; do
        command -v "$cmd" >/dev/null 2>&1 || fail "'$cmd' is not installed, needed to resolve the latest released image."
    done
fi
if [ "$INSTALL_DEPS" = "false" ] && [ -n "$DEPS_CHART_VERSION" ]; then
    log "WARNING: --deps-chart-version ignored, --charts $CHARTS does not install the dependencies"
fi
if [ -n "$CHART_DIR" ] && [ ! -d "$CHART_DIR/charts/pmm-ha" ]; then
    fail "--chart-dir '$CHART_DIR' does not look like a percona-helm-charts checkout (no charts/pmm-ha)."
fi
if [ "$CHART_BRANCH" != "latest" ]; then
    [ -z "$CHART_DIR" ] || fail "--chart-branch and --chart-dir both name a chart source; pass one."
    command -v git >/dev/null 2>&1 || fail "'git' is not installed, needed to clone --chart-branch '$CHART_BRANCH'."
fi
if [ -z "$WEBHOOK_SETTLE_SECONDS" ]; then
    [ "$PLATFORM" = "openshift" ] && WEBHOOK_SETTLE_SECONDS=60 || WEBHOOK_SETTLE_SECONDS=0
fi

kubectl version -o json >/dev/null 2>&1 || fail "kubectl cannot reach a cluster; check KUBECONFIG."

dump_diagnostics() {
    mkdir -p "$DEBUG_DIR"
    log "Collecting diagnostics into $DEBUG_DIR"
    kubectl get pods -n "$NAMESPACE" -o wide >"$DEBUG_DIR/pods.txt" 2>&1 || true
    kubectl get events -n "$NAMESPACE" --sort-by=.metadata.creationTimestamp >"$DEBUG_DIR/events.txt" 2>&1 || true
    kubectl describe pods -n "$NAMESPACE" >"$DEBUG_DIR/describe.txt" 2>&1 || true
    kubectl get statefulset,deployment,svc -n "$NAMESPACE" -o yaml >"$DEBUG_DIR/workloads.yaml" 2>&1 || true

    for pod in $(kubectl get pods -n "$NAMESPACE" --no-headers -o custom-columns=:metadata.name 2>/dev/null); do
        for container in $(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.spec.containers[*].name}' 2>/dev/null); do
            kubectl logs "$pod" -n "$NAMESPACE" -c "$container" --tail=200 >"$DEBUG_DIR/${pod}-${container}.log" 2>&1 || true
        done
    done
}
DIAGNOSTICS_ENABLED="false"

on_exit() {
    local rc=$?

    if [ "$rc" -ne 0 ] && [ "$DIAGNOSTICS_ENABLED" = "true" ]; then
        dump_diagnostics
    fi

    if [ "$rc" -eq 0 ]; then
        rm -rf "${CLONE_DIR:-}" "${PATCH_DIR:-}"
    fi

    exit "$rc"
}
trap on_exit EXIT

# Docker Hub is the source of truth for "released": the newest <major>.<minor>.<patch>
# tag, which skips `latest`, `3` and any suffixed variant.
latest_released_image() {
    local response tag

    response="$(curl -fsSL --retry 3 --retry-delay 5 \
        "https://registry.hub.docker.com/v2/repositories/${RELEASED_REPOSITORY}/tags?page_size=100&ordering=last_updated")" \
        || fail "could not reach Docker Hub to resolve the latest released ${RELEASED_REPOSITORY} tag."

    tag="$(echo "$response" | jq -r '.results[].name' \
        | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -n1 || true)"
    [ -n "$tag" ] || fail "Docker Hub returned no released ${RELEASED_REPOSITORY} tag to install."

    echo "${RELEASED_REPOSITORY}:${tag}"
}

# `helm list` reports the chart as `<name>-<version>`.
release_chart() {
    helm list --namespace "$NAMESPACE" --filter "^${1}$" -o json \
        | tr ',' '\n' | sed -n 's/.*"chart":"\([^"]*\)".*/\1/p'
}

write_summary() {
    {
        echo "platform=$PLATFORM"
        echo "namespace=$NAMESPACE"
        echo "charts=$CHARTS"
        echo "chart_source=$CHART_SOURCE"

        if [ "$INSTALL_DEPS" = "true" ]; then
            echo "deps_release=$DEPS_RELEASE"
            echo "deps_chart=$(release_chart "$DEPS_RELEASE")"
        fi

        if [ "$INSTALL_PMM" = "true" ]; then
            echo "release=$RELEASE"
            echo "chart=$RELEASE_CHART"
            echo "image=$IMAGE"
            echo "url=${PMM_URL:-<no external access>}"
            [ -n "${LINODE_HOST:-}" ] && echo "linode_host=$LINODE_HOST"

            if [ "$SECRET_CREATED" = "true" ]; then
                echo "pmm_admin_password=$ADMIN_PASSWORD"
                echo "postgres_password=$PG_PASSWORD"
                echo "grafana_password=$GF_PASSWORD"
                echo "clickhouse_password=$CH_PASSWORD"
                echo "victoriametrics_password=$VM_PASSWORD"
            else
                echo "pmm_admin_password=<kept from the existing pmm-secret>"
            fi
        fi
    } >"$SUMMARY_FILE"
    chmod 600 "$SUMMARY_FILE"
}

# This API server drops long-lived connections mid-wait ("http2: client connection
# lost"); jenkins-pipelines hit the same thing and added retries in PMM-15367.
retry() {
    local attempts=3 attempt=1

    until "$@"; do
        [ "$attempt" -lt "$attempts" ] || return 1
        log "retrying (${attempt}/${attempts}): $*"
        attempt=$(( attempt + 1 ))
        sleep 10
    done
}

random_password() {
    # cut, not `head -c`: head closes the pipe early, which trips pipefail.
    openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | cut -c1-24
}

# `kubectl wait -l` fails outright on an empty match, and a pod is not there the
# instant helm returns, so wait for it to exist before waiting for Ready.
wait_for_pods_ready() {
    local selector="$1" what="$2" deadline
    deadline=$(( $(date +%s) + 600 ))

    until kubectl get pod -l "$selector" -n "$NAMESPACE" --no-headers 2>/dev/null | grep -q .; do
        [ "$(date +%s)" -lt "$deadline" ] || fail "no pod matching '$selector' appeared within 10m ($what)."
        sleep 5
    done

    retry kubectl wait --for=condition=ready pod -l "$selector" -n "$NAMESPACE" --timeout="$TIMEOUT"
}

if [ "$CHART_BRANCH" != "latest" ]; then
    CLONE_DIR="$(mktemp -d)"
    log "Cloning $CHART_REPO branch $CHART_BRANCH into $CLONE_DIR"
    git clone --branch "$CHART_BRANCH" --depth 1 "$CHART_REPO" "$CLONE_DIR" \
        || fail "could not clone $CHART_REPO branch '$CHART_BRANCH'."

    [ -d "$CLONE_DIR/charts/pmm-ha" ] \
        || fail "branch '$CHART_BRANCH' of $CHART_REPO has no charts/pmm-ha."
    CHART_DIR="$CLONE_DIR"
fi

if [ "$INSTALL_PMM" = "true" ] && [ -z "$IMAGE" ]; then
    IMAGE="$(latest_released_image)"
    log "No --image given, installing the latest released image: $IMAGE"
fi

DIAGNOSTICS_ENABLED="true"

if [ -n "${CLONE_DIR:-}" ]; then
    CHART_SOURCE="branch:$CHART_BRANCH"
elif [ -n "$CHART_DIR" ]; then
    CHART_SOURCE="dir:$CHART_DIR"
else
    CHART_SOURCE="published"
fi

log "Platform $PLATFORM, namespace $NAMESPACE, charts $CHARTS, chart source $CHART_SOURCE"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

if [ "$PLATFORM" = "openshift" ]; then
    # What `oc adm policy add-scc-to-group` does, in plain RBAC - no oc binary
    # needed. ClusterRoleBindings, not RoleBindings: an SCC is a cluster-scoped
    # resource, so a namespaced binding grants nothing.
    #
    # anyuid covers the PMM Server pods; kube-state-metrics additionally asks for
    # seccomp RuntimeDefault, which anyuid does not allow, and a fixed UID, which
    # restricted-v2 does not allow - nonroot-v2 is the one SCC that permits both.
    for scc in anyuid nonroot-v2; do
        log "Granting $scc to service accounts in $NAMESPACE"
        kubectl create clusterrolebinding "pmm-ha-${scc}-${NAMESPACE}" \
            --clusterrole="system:openshift:scc:${scc}" \
            --group="system:serviceaccounts:${NAMESPACE}" \
            --dry-run=client -o yaml | kubectl apply -f -
    done
fi

DEPS_CHART="percona/pmm-ha-dependencies"
PMM_CHART="percona/pmm-ha"
# Separate: the two charts are released on their own lineages, so one version
# cannot pin both.
DEPS_CHART_ARGS=()
PMM_CHART_ARGS=()
[ -n "$DEPS_CHART_VERSION" ] && DEPS_CHART_ARGS+=(--version "$DEPS_CHART_VERSION")
[ -n "$CHART_VERSION" ] && PMM_CHART_ARGS+=(--version "$CHART_VERSION")

if [ -n "$CHART_DIR" ]; then
    DEPS_CHART="$CHART_DIR/charts/pmm-ha-dependencies"
    PMM_CHART="$CHART_DIR/charts/pmm-ha"
    DEPS_CHART_ARGS=()   # a checkout carries its own version
    PMM_CHART_ARGS=()
    { [ -n "$CHART_VERSION" ] || [ -n "$DEPS_CHART_VERSION" ]; } && log "WARNING: chart versions ignored, $CHART_SOURCE carries its own"

    helm repo add percona https://percona.github.io/percona-helm-charts/ --force-update
    helm repo add haproxytech https://haproxytech.github.io/helm-charts/ --force-update
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts --force-update
    helm repo add vm https://victoriametrics.github.io/helm-charts/ --force-update
    helm repo add altinity https://helm.altinity.com --force-update
    helm repo update

    [ "$INSTALL_DEPS" = "true" ] && helm dependency update "$DEPS_CHART"
    [ "$INSTALL_PMM" = "true" ] && helm dependency update "$PMM_CHART"
else
    helm repo add percona https://percona.github.io/percona-helm-charts/ --force-update
    helm repo update

    if [ "$INSTALL_PMM" = "true" ] && [ -z "$CHART_VERSION" ]; then
        log "WARNING: no --chart-version, installing the latest published $PMM_CHART"
        helm search repo "$PMM_CHART" || true
    fi
fi

# The chart hard-codes HAProxy's resolver as kube-dns.kube-system and exposes no
# value for it, so OpenShift needs the template itself rewritten - which only
# works from a chart on disk.
if [ "$PLATFORM" = "openshift" ] && [ "$INSTALL_PMM" = "true" ]; then
    PATCH_DIR="$(mktemp -d)"

    if [ -z "$CHART_DIR" ]; then
        log "Pulling $PMM_CHART into $PATCH_DIR to patch its HAProxy resolver"
        helm pull "$PMM_CHART" --untar --untardir "$PATCH_DIR" ${PMM_CHART_ARGS[@]+"${PMM_CHART_ARGS[@]}"}
        PMM_CHART_ARGS=()
    else
        # Patch a copy: --chart-dir may well be someone's working checkout.
        log "Copying $PMM_CHART into $PATCH_DIR to patch its HAProxy resolver"
        cp -R "$PMM_CHART" "$PATCH_DIR/pmm-ha"
    fi

    PMM_CHART="$PATCH_DIR/pmm-ha"

    HAPROXY_CONFIGMAP="$PMM_CHART/templates/haproxy-configmap.yaml"
    [ -f "$HAPROXY_CONFIGMAP" ] || fail "cannot find $HAPROXY_CONFIGMAP to patch the HAProxy resolver."
    sed -i.bak 's/kube-dns.kube-system.svc.cluster.local/dns-default.openshift-dns.svc.cluster.local/g' "$HAPROXY_CONFIGMAP"
    rm -f "${HAPROXY_CONFIGMAP}.bak"
    grep -q 'dns-default.openshift-dns' "$HAPROXY_CONFIGMAP" || fail "the HAProxy resolver patch did not apply; the chart may have changed."
fi

if [ "$INSTALL_DEPS" = "true" ]; then
    log "Installing $DEPS_CHART as $DEPS_RELEASE"
    helm upgrade --install "$DEPS_RELEASE" "$DEPS_CHART" \
        --namespace "$NAMESPACE" \
        --wait --timeout "$TIMEOUT" \
        ${DEPS_CHART_ARGS[@]+"${DEPS_CHART_ARGS[@]}"}

    for operator in "${OPERATOR_NAMES[@]}"; do
        log "Waiting for operator $operator"
        wait_for_pods_ready "app.kubernetes.io/name=$operator" "$operator"
    done

    if [ "$WEBHOOK_SETTLE_SECONDS" -gt 0 ] && [ "$INSTALL_PMM" = "true" ]; then
        log "Letting operator webhooks settle for ${WEBHOOK_SETTLE_SECONDS}s"
        sleep "$WEBHOOK_SETTLE_SECONDS"
    fi
else
    log "Leaving $DEPS_RELEASE alone, --charts $CHARTS"
fi

if [ "$INSTALL_PMM" = "false" ]; then
    write_summary

    kubectl get pods -n "$NAMESPACE" -o wide

    cat <<DEPS_SUMMARY_EOF

=================== PMM HA DEPENDENCIES READY ==============
 Platform   : $PLATFORM
 Namespace  : $NAMESPACE
 Release    : $DEPS_RELEASE ($(release_chart "$DEPS_RELEASE"))
 Summary    : $SUMMARY_FILE
============================================================
DEPS_SUMMARY_EOF

    exit 0
fi

# Rotating these on an existing cluster would break PG, ClickHouse and VM, which
# still hold the old ones - so an existing secret is kept, never overwritten.
SECRET_CREATED="false"
if kubectl get secret pmm-secret -n "$NAMESPACE" >/dev/null 2>&1; then
    log "Keeping the pmm-secret already in $NAMESPACE"
    [ -n "$ADMIN_PASSWORD" ] && log "WARNING: --admin-password ignored, pmm-secret already exists"
    ADMIN_PASSWORD=""
else
    [ -n "$ADMIN_PASSWORD" ] || ADMIN_PASSWORD="$(random_password)"
    PG_PASSWORD="$(random_password)"
    GF_PASSWORD="$(random_password)"
    CH_PASSWORD="$(random_password)"
    VM_PASSWORD="$(random_password)"

    kubectl create secret generic pmm-secret -n "$NAMESPACE" \
        --from-literal=PMM_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
        --from-literal=GF_SECURITY_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
        --from-literal=PG_PASSWORD="$PG_PASSWORD" \
        --from-literal=GF_PASSWORD="$GF_PASSWORD" \
        --from-literal=PMM_CLICKHOUSE_USER="clickhouse_pmm" \
        --from-literal=PMM_CLICKHOUSE_PASSWORD="$CH_PASSWORD" \
        --from-literal=VMAGENT_remoteWrite_basicAuth_username="victoriametrics_pmm" \
        --from-literal=VMAGENT_remoteWrite_basicAuth_password="$VM_PASSWORD" \
        --dry-run=client -o yaml | kubectl apply -f -
    SECRET_CREATED="true"
    log "Created pmm-secret in $NAMESPACE"
fi

# OpenShift already runs a node-exporter on host port 9100, so the bundled
# DaemonSet stays Pending forever and --wait would never return. The chart's own
# openshift mode scrapes the platform one instead. Placed before EXTRA_SET so
# --set still wins.
PLATFORM_SET=()
if [ "$PLATFORM" = "openshift" ]; then
    PLATFORM_SET+=(--set nodeExporter.mode=openshift --set prometheus-node-exporter.enabled=false)
fi

log "Installing $PMM_CHART as $RELEASE on image $IMAGE"
helm upgrade --install "$RELEASE" "$PMM_CHART" \
    --namespace "$NAMESPACE" \
    --set secret.create=false \
    --set secret.name=pmm-secret \
    --wait --timeout "$TIMEOUT" \
    --set "image.repository=${IMAGE%:*}" \
    --set "image.tag=${IMAGE##*:}" \
    ${PMM_CHART_ARGS[@]+"${PMM_CHART_ARGS[@]}"} ${PLATFORM_SET[@]+"${PLATFORM_SET[@]}"} ${EXTRA_SET[@]+"${EXTRA_SET[@]}"}

# Resolved by label rather than named: the StatefulSet is named after the release.
log "Waiting for the PMM Server StatefulSet to roll out"
STATEFULSET=""
STS_DEADLINE=$(( $(date +%s) + 300 ))
until STATEFULSET="$(kubectl get statefulset -n "$NAMESPACE" -l "$PMM_SERVER_SELECTOR" -o name | head -1)"; [ -n "$STATEFULSET" ]; do
    [ "$(date +%s)" -lt "$STS_DEADLINE" ] || fail "no StatefulSet matching '$PMM_SERVER_SELECTOR' appeared within 5m."
    sleep 10
done
retry kubectl rollout status "$STATEFULSET" -n "$NAMESPACE" --timeout="$TIMEOUT"

# HAProxy's readiness gates on those backends, so it is waited on second: a stuck
# server then surfaces as the rollout above, not as an opaque HAProxy timeout.
log "Waiting for HAProxy"
wait_for_pods_ready "$HAPROXY_SELECTOR" "HAProxy"

PMM_URL=""
EXTERNAL_HOST=""
if [ "$EXTERNAL_ACCESS" = "true" ]; then
    case "$PLATFORM" in
        eks)
            kubectl patch svc "$HAPROXY_SERVICE" -n "$NAMESPACE" --type=merge -p '{
                "metadata": {
                    "annotations": {
                        "service.beta.kubernetes.io/aws-load-balancer-type": "nlb",
                        "service.beta.kubernetes.io/aws-load-balancer-scheme": "internet-facing"
                    }
                },
                "spec": { "type": "LoadBalancer" }
            }'
            INGRESS_PATH='{.status.loadBalancer.ingress[0].hostname}'
            ;;
        lke)
            kubectl patch svc "$HAPROXY_SERVICE" -n "$NAMESPACE" --type=merge -p '{"spec":{"type":"LoadBalancer"}}'
            INGRESS_PATH='{.status.loadBalancer.ingress[0].ip}'
            ;;
        openshift)
            kubectl apply -f - <<ROUTE_EOF
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: pmm-ha-route
  namespace: ${NAMESPACE}
  labels:
    app: pmm-ha
spec:
  to:
    kind: Service
    name: ${HAPROXY_SERVICE}
    weight: 100
  port:
    targetPort: https
  tls:
    termination: passthrough
    insecureEdgeTerminationPolicy: Redirect
  wildcardPolicy: None
ROUTE_EOF
            INGRESS_PATH=''
            ;;
    esac

    log "Waiting for the external address"
    HOST_DEADLINE=$(( $(date +%s) + 600 ))
    until [ -n "$EXTERNAL_HOST" ]; do
        if [ "$PLATFORM" = "openshift" ]; then
            EXTERNAL_HOST="$(kubectl get route pmm-ha-route -n "$NAMESPACE" -o jsonpath='{.spec.host}' 2>/dev/null || true)"
        else
            EXTERNAL_HOST="$(kubectl get svc "$HAPROXY_SERVICE" -n "$NAMESPACE" -o jsonpath="$INGRESS_PATH" 2>/dev/null || true)"
        fi
        [ -n "$EXTERNAL_HOST" ] && break
        [ "$(date +%s)" -lt "$HOST_DEADLINE" ] || fail "no external address was assigned within 10m."
        sleep 15
    done

    # Linode's per-IP rDNS name, for anything that refuses raw-IP HTTPS.
    if [ "$PLATFORM" = "lke" ]; then
        LINODE_HOST="$(echo "$EXTERNAL_HOST" | tr '.' '-').ip.linodeusercontent.com"
        log "Linode rDNS hostname: $LINODE_HOST"
    fi

    PMM_URL="https://${EXTERNAL_HOST}"

    # Pods Ready does not mean the front end serves; an exact 200 does. `curl -f`
    # would accept a redirect, so the code is compared instead.
    log "Waiting for PMM to answer 200 on ${PMM_URL}/v1/readyz"
    READYZ_DEADLINE=$(( $(date +%s) + 600 ))
    until [ "$(curl -k -sS -m 10 -o /dev/null -w '%{http_code}' "${PMM_URL}/v1/readyz" 2>/dev/null)" = "200" ]; do
        [ "$(date +%s)" -lt "$READYZ_DEADLINE" ] || fail "PMM did not answer 200 on ${PMM_URL}/v1/readyz within 10m."
        sleep 10
    done
    log "PMM is serving on $PMM_URL"
fi

RELEASE_CHART="$(release_chart "$RELEASE")"
write_summary

kubectl get pods -n "$NAMESPACE" -o wide

cat <<SUMMARY_EOF

======================= PMM HA READY =======================
 Platform   : $PLATFORM
 Namespace  : $NAMESPACE
 Release    : $RELEASE ($RELEASE_CHART)
 Image      : $IMAGE
 URL        : ${PMM_URL:-<no external access; pass --external-access>}
 Summary    : $SUMMARY_FILE (credentials, mode 600)
============================================================
SUMMARY_EOF
