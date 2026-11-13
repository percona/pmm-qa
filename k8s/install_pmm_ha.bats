## install_pmm_ha.sh option validation
### needs: bash and openssl; no cluster - the install cases run on fake kubectl, helm and git

setup() {
    SCRIPT="$(dirname "$BATS_TEST_FILENAME")/install_pmm_ha.sh"
    # A caller's ambient settings must not decide these cases.
    unset PLATFORM CHART_BRANCH PMM_CHART_BRANCH CHART_DIR CHART_VERSION DEPS_CHART_VERSION \
        DEPS_CHART_BRANCH INSTALL_METHOD ARGOCD_VERSION CLONE_PARENT CHARTS PMM_SECRET_FROM \
        NAMESPACE RELEASE DEPS_RELEASE CHART_REPO TIMEOUT EXTERNAL_ACCESS PMM_ADMIN_PASSWORD \
        PMM_IMAGE PMM_IMAGE_REPOSITORY PMM_IMAGE_TAG BACKUP_MINIO BACKUP_S3_BUCKET BACKUP_S3_ENDPOINT \
        WEBHOOK_SETTLE_SECONDS ARGOCD_PRINT_MANIFESTS
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

@test "argocd refuses --pmm-secret-from" {
    run "$SCRIPT" --install-method argocd --platform eks --chart-branch main --pmm-secret-from pmm
    [ "$status" -eq 1 ]
    [[ "$output" == *"--pmm-secret-from is not supported with --install-method argocd"* ]]
}

@test "argocd refuses a release name without pmm-ha" {
    run "$SCRIPT" --install-method argocd --platform eks --chart-branch main --release foo
    [ "$status" -eq 1 ]
    [[ "$output" == *"--release must contain pmm-ha with --install-method argocd; got 'foo'"* ]]
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
    for kv in "offlineRender.enabled|true" "tls.secretFormat|kubernetes.io/tls" \
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
assert 'forceString' not in params['offlineRender.enabled']
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

@test "argocd print mode exits before any kubectl call" {
    mkdir -p "$BATS_TEST_TMPDIR/bin"
    printf '#!/bin/bash\ntouch "%s/kubectl-called"\nexit 1\n' "$BATS_TEST_TMPDIR" > "$BATS_TEST_TMPDIR/bin/kubectl"
    chmod +x "$BATS_TEST_TMPDIR/bin/kubectl"
    PATH="$BATS_TEST_TMPDIR/bin:$PATH" render
    [ "$status" -eq 0 ]
    [ ! -e "$BATS_TEST_TMPDIR/kubectl-called" ]
}

# Fakes for a full run: kubectl, helm and git log their arguments to $FAKE/calls,
# every `kubectl apply -f -` keeps its input as $FAKE/apply.N.yaml, and the cluster
# answers as if everything were already ready.
fake_cluster() {
    FAKE="$BATS_TEST_TMPDIR/fake"
    mkdir -p "$FAKE/bin"
    cat > "$FAKE/bin/kubectl" <<'EOF'
#!/bin/bash
# An apply logs once its input is read, after the command piping into it.
if [[ "$*" == *"apply -f -"* ]]; then
    n=$(( $(ls "$FAKE" | grep -c '^apply\.') + 1 ))
    cat > "$FAKE/apply.$n.yaml"
    echo "kubectl $* > apply.$n.yaml" >> "$FAKE/calls"
else
    echo "kubectl $*" >> "$FAKE/calls"
fi
case "$*" in
    *"--dry-run=client"*) echo "# dry-run: $*" ;;
    *"get application "*conditions*) echo '[{"type":"ComparisonError","message":"fake comparison error"}]' ;;
    *"get application "*operationState*) echo "fake operation message" ;;
    *"get application "*) echo "${FAKE_APP_STATUS:-Synced/Healthy}" ;;
    *"get secret "*) exit 1 ;;
    *"get pod -l "*) echo "pod-0 1/1 Running" ;;
    *"get statefulset -n "*"-l "*) echo "statefulset.apps/pmm-ha" ;;
    *"get svc "*) echo "nlb.example.com" ;;
esac
exit 0
EOF
    cat > "$FAKE/bin/helm" <<'EOF'
#!/bin/bash
echo "helm $*" >> "$FAKE/calls"
[ "$1" != "list" ] || echo '[{"name":"x","chart":"from-helm-list-1.0.0"}]'
if [ "$1 $2" = "search repo" ]; then
    case "$*" in
        *"--version 9.9.9"*) echo '[]' ;;
        *"--version "*) all="$*"; v="${all#*--version }"; echo "[{\"name\":\"$3\",\"version\":\"${v%% *}\",\"app_version\":\"3.0\",\"description\":\"a, b {c}\"}]" ;;
        *"percona/pmm-ha-dependencies"*) echo '[{"name":"percona/pmm-ha-dependencies","version":"1.2.0","app_version":"3.0","description":"a, b {c}"}]' ;;
        *) echo '[{"name":"percona/pmm-ha-dependencies","version":"1.2.0","app_version":"3.0","description":"x, {y}"},{"name":"percona/pmm-ha","version":"1.8.0","app_version":"3.0","description":"a, b {c}"}]' ;;
    esac
fi
exit 0
EOF
    cat > "$FAKE/bin/git" <<'EOF'
#!/bin/bash
echo "git $*" >> "$FAKE/calls"
dir="${!#}"
mkdir -p "$dir/charts/pmm-ha" "$dir/charts/pmm-ha-dependencies"
printf 'apiVersion: v2\nname: pmm-ha\nversion: 1.9.0\n' > "$dir/charts/pmm-ha/Chart.yaml"
printf 'apiVersion: v2\nname: pmm-ha-dependencies\nversion: "1.3.0"\ndependencies:\n  - name: pg-operator\n    version: 2.7.0\n' \
    > "$dir/charts/pmm-ha-dependencies/Chart.yaml"
EOF
    printf '#!/bin/bash\necho "curl $*" >> "$FAKE/calls"\necho 200\n' > "$FAKE/bin/curl"
    chmod +x "$FAKE/bin/"*
    export FAKE PATH="$FAKE/bin:$PATH" TMPDIR="$BATS_TEST_TMPDIR"
    export SUMMARY_FILE="$BATS_TEST_TMPDIR/summary.env" DEBUG_DIR="$BATS_TEST_TMPDIR/debug"
}

# A bare `! cmd` fails a bats test only on its last line.
refute() {
    if "$@"; then return 1; fi
}

# Line number of the first call matching a fixed string, failing when there is none.
call_line() {
    local n
    n="$(grep -nF -- "$1" "$FAKE/calls" | head -1 | cut -d: -f1)"
    [ -n "$n" ] || { echo "no call matching: $1" >&2; return 1; }
    echo "$n"
}

argocd_install() {
    run "$SCRIPT" --platform eks --install-method argocd \
        --chart-branch KrisBuytaert:PMM-15826-pmm-ha-gitops \
        --deps-chart-branch KrisBuytaert:PMM-15827-pmm-ha-dependencies-enabled \
        --image perconalab/pmm-server:3-dev-latest --external-access \
        --clone-dir "$BATS_TEST_TMPDIR/clones" "$@"
}

@test "argocd install applies Argo CD, the secrets, then the dependencies and pmm-ha Applications" {
    fake_cluster
    argocd_install
    echo "$output"
    [ "$status" -eq 0 ]

    argocd_line="$(call_line "kubectl apply -n argocd --server-side --force-conflicts -f https://raw.githubusercontent.com/argoproj/argo-cd/v3.5.6/manifests/install.yaml")"
    secret_line="$(call_line "kubectl create secret generic pmm-secret")"
    tls_line="$(call_line "kubectl create secret tls haproxy-tls-secret")"
    deps_line="$(call_line "kubectl -n argocd get application pmm-operators")"
    pmm_line="$(call_line "kubectl -n argocd get application pmm-ha")"
    operator_line="$(call_line "app.kubernetes.io/name=pg-operator")"
    [ "$argocd_line" -lt "$secret_line" ]
    [ "$secret_line" -lt "$tls_line" ]
    [ "$tls_line" -lt "$deps_line" ]
    [ "$deps_line" -lt "$operator_line" ]
    [ "$operator_line" -lt "$pmm_line" ]

    refute grep -q "^kubectl patch" "$FAKE/calls"
    refute grep -q "^helm upgrade" "$FAKE/calls"
    grep -q "PMM_CLICKHOUSE_DATASOURCE_PASSWORD=" "$FAKE/calls"
    refute grep -q "PG_PASSWORD=\|GF_PASSWORD=" "$FAKE/calls"
    grep -q "^curl .*https://nlb.example.com/v1/readyz" "$FAKE/calls"
}

@test "argocd install applies the dependencies Application alone, then the AppProject and pmm-ha Application" {
    fake_cluster
    argocd_install
    [ "$status" -eq 0 ]

    apps="$(grep -l '^kind: Application$' "$FAKE"/apply.*.yaml)"
    [ "$(echo "$apps" | wc -l)" -eq 2 ]
    deps_file="$(echo "$apps" | head -1)"
    pmm_file="$(echo "$apps" | tail -1)"
    [ "$(grep -c '^kind: ' "$deps_file")" -eq 1 ]
    grep -q "^  name: 'pmm-operators'$" "$deps_file"
    grep -q "path: charts/pmm-ha-dependencies$" "$deps_file"
    [ "$(grep -c '^kind: ' "$pmm_file")" -eq 2 ]
    grep -q '^kind: AppProject$' "$pmm_file"
    grep -q "^  name: 'pmm-ha'$" "$pmm_file"
    refute grep -q "pmm-operators" "$pmm_file"
}

@test "argocd install writes the argocd summary keys" {
    fake_cluster
    argocd_install
    [ "$status" -eq 0 ]

    deps_clone="$(sed -n 's/^git clone .*PMM-15827-pmm-ha-dependencies-enabled .* //p' "$FAKE/calls")"
    [ -n "$deps_clone" ]
    grep -qxF "helm dependency update $deps_clone/charts/pmm-ha-dependencies" "$FAKE/calls"
    grep -qx "install_method=argocd" "$SUMMARY_FILE"
    grep -qx "argocd_version=v3.5.6" "$SUMMARY_FILE"
    grep -qx "argocd_apps=pmm-operators,pmm-ha" "$SUMMARY_FILE"
    grep -qxF "deps_chart_dir=$deps_clone/charts/pmm-ha-dependencies" "$SUMMARY_FILE"
    grep -qx "deps_chart=pmm-ha-dependencies-1.3.0" "$SUMMARY_FILE"
    grep -qx "chart=pmm-ha-1.9.0" "$SUMMARY_FILE"
    grep -qx "url=https://nlb.example.com" "$SUMMARY_FILE"
    grep -q "^clickhouse_datasource_password=." "$SUMMARY_FILE"
    refute grep -q "^postgres_password=\|^grafana_password=" "$SUMMARY_FILE"
}

@test "argocd install reports the Application status, conditions and operation when it never gets healthy" {
    fake_cluster
    FAKE_APP_STATUS="OutOfSync/Missing" TIMEOUT=0s argocd_install
    [ "$status" -eq 1 ]
    [[ "$output" == *"Application pmm-operators last status: OutOfSync/Missing"* ]]
    [[ "$output" == *"fake comparison error"* ]]
    [[ "$output" == *"fake operation message"* ]]
    [[ "$output" == *"Application pmm-operators was not Synced and Healthy within 0s"* ]]
    grep -q "^kubectl get applications,appprojects -n argocd -o yaml" "$FAKE/calls"
    [ -e "$DEBUG_DIR/argocd-applications.yaml" ]
    refute grep -q "get application pmm-ha" "$FAKE/calls"
}

@test "argocd refuses a --timeout it cannot count down" {
    run "$SCRIPT" --install-method argocd --platform eks --chart-branch main --timeout 15
    [ "$status" -eq 1 ]
    [[ "$output" == *"--timeout must be like 15m"* ]]
}

@test "helm install still runs helm upgrade and patches the eks Service, without Argo CD" {
    fake_cluster
    run "$SCRIPT" --platform eks --chart-branch main \
        --image perconalab/pmm-server:3-dev-latest --external-access
    echo "$output"
    [ "$status" -eq 0 ]
    grep -q "^helm upgrade --install pmm-operators " "$FAKE/calls"
    grep -q "^helm upgrade --install pmm-ha " "$FAKE/calls"
    grep -q "^kubectl patch svc pmm-ha-haproxy" "$FAKE/calls"
    refute grep -q "argocd\|haproxy-tls-secret\|PMM_CLICKHOUSE_DATASOURCE_PASSWORD" "$FAKE/calls"
    grep -q "PG_PASSWORD=" "$FAKE/calls"
    refute grep -q "^install_method=\|^argocd" "$SUMMARY_FILE"
    grep -q "^postgres_password=." "$SUMMARY_FILE"
    grep -qx "chart=from-helm-list-1.0.0" "$SUMMARY_FILE"
}

released_render() {
    fake_cluster
    ARGOCD_PRINT_MANIFESTS=1 run "$SCRIPT" --platform eks --install-method argocd \
        --image perconalab/pmm-server:3-dev-latest "$@"
}

@test "argocd print mode with no chart branch renders the released charts" {
    released_render
    [ "$status" -eq 0 ]
    [[ "$output" == *"repoURL: https://percona.github.io/percona-helm-charts/"* ]]
    [[ "$output" == *"chart: pmm-ha"$'\n'"    targetRevision: 1.8.0"* ]]
    [[ "$output" == *"chart: pmm-ha-dependencies"$'\n'"    targetRevision: 1.2.0"* ]]
    [[ "$output" != *"path: charts/"* ]]
}

@test "argocd print mode pins --chart-version" {
    released_render --chart-version 1.6.1
    [ "$status" -eq 0 ]
    [[ "$output" == *"targetRevision: 1.6.1"* ]]
    [[ "$output" == *"targetRevision: 1.2.0"* ]]
}

@test "a chart version is refused with a chart branch" {
    run "$SCRIPT" --install-method argocd --platform eks --chart-branch main --chart-version 1.8.0
    [ "$status" -eq 1 ]
    [[ "$output" == *"--chart-version applies to the released chart only"* ]]
}

@test "a deps chart version is refused with a deps chart branch" {
    run "$SCRIPT" --install-method argocd --platform eks --chart-branch main --deps-chart-version 1.2.0
    [ "$status" -eq 1 ]
    [[ "$output" == *"--deps-chart-version applies to the released chart only"* ]]
}

@test "an unpublished chart version fails before any cluster change" {
    fake_cluster
    run "$SCRIPT" --platform eks --install-method argocd --image perconalab/pmm-server:3-dev-latest \
        --chart-version 9.9.9
    [ "$status" -eq 1 ]
    [[ "$output" == *"pmm-ha 9.9.9 is not published"* ]]
    refute grep -q "apply" "$FAKE/calls"
}

@test "argocd print mode with mixed sources renders a Helm repository and a Git source" {
    released_render --deps-chart-branch latest --chart-branch KrisBuytaert:PMM-15826-pmm-ha-gitops
    [ "$status" -eq 0 ]
    [[ "$output" == *"chart: pmm-ha-dependencies"$'\n'"    targetRevision: 1.2.0"* ]]
    [[ "$output" == *"repoURL: https://github.com/KrisBuytaert/percona-helm-charts.git"$'\n'"    targetRevision: PMM-15826-pmm-ha-gitops"$'\n'"    path: charts/pmm-ha"$'\n'* ]]
}

@test "argocd print mode allows the Helm repository in the AppProject" {
    released_render
    [ "$status" -eq 0 ]
    [[ "$output" == *"sourceRepos:"$'\n'"    - 'https://percona.github.io/percona-helm-charts/'"$'\n'"  destinations:"* ]]
    released_render --deps-chart-branch latest --chart-branch KrisBuytaert:PMM-15826-pmm-ha-gitops
    [ "$status" -eq 0 ]
    [[ "$output" == *"    - 'https://github.com/KrisBuytaert/percona-helm-charts.git'"$'\n'"    - 'https://percona.github.io/percona-helm-charts/'"$'\n'"  destinations:"* ]]
}

@test "argocd install writes the chart source keys" {
    fake_cluster
    run "$SCRIPT" --platform eks --install-method argocd --image perconalab/pmm-server:3-dev-latest \
        --clone-dir "$BATS_TEST_TMPDIR/clones"
    [ "$status" -eq 0 ]
    call_line "helm pull percona/pmm-ha-dependencies --version 1.2.0 --untar"
    grep -qx "chart_source=released" "$SUMMARY_FILE"
    grep -qx "chart_version=1.8.0" "$SUMMARY_FILE"
    grep -qx "deps_chart_source=released" "$SUMMARY_FILE"
    grep -qx "deps_chart_version=1.2.0" "$SUMMARY_FILE"
    pulled="$(sed -n 's/^helm pull .* --untardir //p' "$FAKE/calls")"
    [ -n "$pulled" ]
    grep -qxF "deps_chart_dir=$pulled/pmm-ha-dependencies" "$SUMMARY_FILE"
    refute grep -q "^git clone" "$FAKE/calls"
}

@test "argocd install with a Git pmm-ha and released dependencies says so in the summary" {
    fake_cluster
    run "$SCRIPT" --platform eks --install-method argocd --image perconalab/pmm-server:3-dev-latest \
        --chart-branch KrisBuytaert:PMM-15826-pmm-ha-gitops --deps-chart-branch latest \
        --clone-dir "$BATS_TEST_TMPDIR/clones"
    [ "$status" -eq 0 ]
    [[ "$output" == *"chart source branch:PMM-15826-pmm-ha-gitops, dependencies released 1.2.0"* ]]
    [[ "$output" != *"branch:latest"* ]]
    grep -qx "chart_source=branch:PMM-15826-pmm-ha-gitops, dependencies released 1.2.0" "$SUMMARY_FILE"
    grep -qx "deps_chart_source=released" "$SUMMARY_FILE"
    grep -qx "deps_chart_version=1.2.0" "$SUMMARY_FILE"
    refute grep -q "^git clone .* latest " "$FAKE/calls"
}
