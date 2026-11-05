## install_pmm_ha.sh option validation
### needs: bash only - every case fails before the script touches a cluster

setup() {
    SCRIPT="$(dirname "$BATS_TEST_FILENAME")/install_pmm_ha.sh"
    # A caller's ambient settings must not decide these cases.
    unset PLATFORM CHART_BRANCH PMM_CHART_BRANCH CHART_DIR CHART_VERSION DEPS_CHART_VERSION \
        DEPS_CHART_BRANCH INSTALL_METHOD ARGOCD_VERSION CLONE_PARENT CHARTS PMM_SECRET_FROM
}

@test "--help lists the install-method, deps-chart-branch, argocd-version and clone-dir options" {
    run "$SCRIPT" --help
    [ "$status" -eq 2 ]
    [[ "$output" == *"--install-method"* ]]
    [[ "$output" == *"--deps-chart-branch"* ]]
    [[ "$output" == *"--argocd-version"* ]]
    [[ "$output" == *"--clone-dir"* ]]
}

@test "--install-method rejects anything but helm or argocd" {
    run "$SCRIPT" --platform eks --install-method bogus
    [ "$status" -eq 1 ]
    [[ "$output" == *"--install-method must be helm or argocd"* ]]
}

@test "argocd refuses a platform other than eks" {
    run "$SCRIPT" --install-method argocd --platform openshift --chart-branch main
    [ "$status" -eq 1 ]
    [[ "$output" == *"argocd install method supports --platform eks only"* ]]
}

@test "argocd refuses --charts" {
    run "$SCRIPT" --install-method argocd --platform eks --chart-branch main --charts deps
    [ "$status" -eq 1 ]
    [[ "$output" == *"--charts is not supported with --install-method argocd"* ]]
}

@test "argocd refuses --chart-dir" {
    run "$SCRIPT" --install-method argocd --platform eks --chart-dir /tmp
    [ "$status" -eq 1 ]
    [[ "$output" == *"--chart-dir is not supported with --install-method argocd"* ]]
}

@test "argocd refuses --chart-version" {
    run "$SCRIPT" --install-method argocd --platform eks --chart-branch main --chart-version 1.8.0
    [ "$status" -eq 1 ]
    [[ "$output" == *"--chart-version is not supported with --install-method argocd"* ]]
}

@test "argocd refuses --deps-chart-version" {
    run "$SCRIPT" --install-method argocd --platform eks --chart-branch main --deps-chart-version 1.2.0
    [ "$status" -eq 1 ]
    [[ "$output" == *"--deps-chart-version is not supported with --install-method argocd"* ]]
}

@test "argocd refuses --pmm-secret-from" {
    run "$SCRIPT" --install-method argocd --platform eks --chart-branch main --pmm-secret-from pmm
    [ "$status" -eq 1 ]
    [[ "$output" == *"--pmm-secret-from is not supported with --install-method argocd"* ]]
}

@test "argocd refuses a missing --chart-branch" {
    run "$SCRIPT" --install-method argocd --platform eks
    [ "$status" -eq 1 ]
    [[ "$output" == *"--chart-branch latest is not supported with --install-method argocd"* ]]
}

@test "argocd refuses --chart-branch latest" {
    run "$SCRIPT" --install-method argocd --platform eks --chart-branch latest
    [ "$status" -eq 1 ]
    [[ "$output" == *"--chart-branch latest is not supported with --install-method argocd"* ]]
}

@test "argocd refuses --deps-chart-branch latest" {
    run "$SCRIPT" --install-method argocd --platform eks --chart-branch main --deps-chart-branch latest
    [ "$status" -eq 1 ]
    [[ "$output" == *"--deps-chart-branch latest is not supported with --install-method argocd"* ]]
}

@test "a different --deps-chart-branch needs a --chart-branch that is a branch" {
    run "$SCRIPT" --platform eks --deps-chart-branch main
    [ "$status" -eq 1 ]
    [[ "$output" == *"both must be branches"* ]]
}

@test "a different --deps-chart-branch cannot be combined with --chart-dir" {
    run "$SCRIPT" --platform eks --chart-dir /tmp --deps-chart-branch main
    [ "$status" -eq 1 ]
    [[ "$output" == *"--deps-chart-branch and --chart-dir"* ]]
}

render() {
    ARGOCD_PRINT_MANIFESTS=1 run "$SCRIPT" --platform eks --install-method argocd \
        --chart-branch KrisBuytaert:PMM-15826-pmm-ha-gitops \
        --deps-chart-branch KrisBuytaert:PMM-15827-pmm-ha-dependencies-enabled \
        --image perconalab/pmm-server:3-dev-latest --set-string pmmEnv.PMM_DEBUG=1 "$@"
}

@test "argocd print mode renders the repos, revisions and chart paths" {
    render --external-access --backup-minio
    [ "$status" -eq 0 ]
    [[ "$output" == *"repoURL: https://github.com/KrisBuytaert/percona-helm-charts.git"* ]]
    [[ "$output" == *"targetRevision: PMM-15826-pmm-ha-gitops"* ]]
    [[ "$output" == *"targetRevision: PMM-15827-pmm-ha-dependencies-enabled"* ]]
    [[ "$output" == *"path: charts/pmm-ha"$'\n'* ]]
    [[ "$output" == *"path: charts/pmm-ha-dependencies"* ]]
    [[ "$output" == *"ServerSideApply=true"* ]]
    [[ "$output" == *"CreateNamespace=true"* ]]
    [[ "$output" == *"SkipDryRunOnMissingResource=true"* ]]
    [[ "$output" == *"limit: 5"* ]]
    [[ "$output" == *"selfHeal: true"* ]]
    [[ "$output" == *"prune: true"* ]]
    [[ "$output" == *"project: default"* ]]
    [[ "$output" == *"project: pmm-ha"* ]]
    [[ "$output" == *"managedFieldsManagers: [pmm-backup]"* ]]
}

@test "argocd print mode renders the helm values" {
    render --external-access --backup-minio
    [ "$status" -eq 0 ]
    for kv in "gitops.enabled|true" "tls.secretFormat|kubernetes.io/tls" \
        "victoriaMetrics.vmagent.scrapeApiserver|false" "secret.create|false" "secret.name|pmm-secret" \
        "haproxy.service.type|LoadBalancer" "centralBackupStorage.enabled|true" \
        "image.repository|perconalab/pmm-server" "image.tag|3-dev-latest" \
        "victoria-metrics-operator.admissionWebhooks.enabled|false"; do
        [[ "$output" == *"- name: '${kv%%|*}'"$'\n'"          value: '${kv#*|}'"* ]]
    done
    [[ "$output" == *"aws-load-balancer-type'"$'\n'"          value: 'nlb'"* ]]
    [[ "$output" == *"aws-load-balancer-scheme'"$'\n'"          value: 'internet-facing'"* ]]
}

@test "argocd print mode without --external-access has no service type" {
    render
    [ "$status" -eq 0 ]
    [[ "$output" != *"haproxy.service"* ]]
    [[ "$output" != *"centralBackupStorage"* ]]
}

@test "argocd print mode output parses as 3 documents with the expected structure" {
    python3 -c 'import yaml' 2>/dev/null || skip "python3 PyYAML not available"
    render --external-access --backup-minio --set pmmClient.image.tag=3
    [ "$status" -eq 0 ]
    printf '%s\n' "$output" > "$BATS_TEST_TMPDIR/out.yaml"
    run python3 -I - "$BATS_TEST_TMPDIR/out.yaml" <<'PY'
import sys, yaml
docs = list(yaml.safe_load_all(open(sys.argv[1])))
assert len(docs) == 3, len(docs)
proj, deps, pmm = docs
assert proj['kind'] == 'AppProject' and proj['metadata']['name'] == 'pmm-ha'
assert proj['spec']['destinations'] == [{'server': 'https://kubernetes.default.svc', 'namespace': 'pmm'}]
assert proj['spec']['clusterResourceWhitelist'] == [{'group': '*', 'kind': '*'}]
assert deps['metadata']['name'] == 'pmm-operators' and pmm['metadata']['name'] == 'pmm-ha'
params = {p['name']: p for p in pmm['spec']['source']['helm']['parameters']}
nlb = params['haproxy.service.annotations.service\\.beta\\.kubernetes\\.io/aws-load-balancer-type']
assert nlb['value'] == 'nlb'
assert params['pmmEnv.PMM_DEBUG']['forceString'] is True
assert params['pmmClient.image.tag']['forceString'] is True
assert params['image.tag']['forceString'] is True
assert 'forceString' not in params['gitops.enabled']
assert 'forceString' not in params['centralBackupStorage.enabled']
assert pmm['spec']['syncPolicy']['retry']['backoff'] == {'duration': '10s', 'factor': 2, 'maxDuration': '3m'}
assert [i['name'] for i in pmm['spec']['ignoreDifferences']] == ['pmm-ha', 'pmm-ha-vmcluster']
assert deps['spec']['source']['helm']['parameters'] == [
    {'name': 'victoria-metrics-operator.admissionWebhooks.enabled', 'value': 'false'}]
PY
    [ "$status" -eq 0 ]
}

@test "argocd print mode output validates with kubeconform" {
    command -v kubeconform >/dev/null 2>&1 || skip "kubeconform not installed"
    render --external-access
    [ "$status" -eq 0 ]
    printf '%s\n' "$output" | kubeconform -ignore-missing-schemas -strict -summary
}
