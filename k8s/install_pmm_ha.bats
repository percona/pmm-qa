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
