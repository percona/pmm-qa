#!/usr/bin/env bash
# Merge percona-helm-charts PR #865 (PMM-15149) and PR #868 (PMM-15151) onto PMM-HA-GA.
# Both PRs branch off PMM-HA-GA and touch charts/pmm-ha/templates/{_helpers,vmagent}.yaml,
# so they must be tested together rather than one at a time.
set -euo pipefail

CLONE=${CLONE:-/tmp/percona-helm-charts}
BRANCH=${BRANCH:-PMM-15149-15151-combined}

[ -d "$CLONE/.git" ] || git clone https://github.com/percona/percona-helm-charts "$CLONE"
cd "$CLONE"
git fetch origin PMM-HA-GA:PMM-HA-GA refs/pull/865/head:pr865 refs/pull/868/head:pr868 --force
git checkout -B "$BRANCH" PMM-HA-GA
git merge --no-edit pr865
git merge --no-edit pr868

for c in pmm-ha-dependencies pmm-ha; do
  helm dependency build "charts/$c"
  helm lint "charts/$c"
done
echo "test branch ready: $CLONE ($BRANCH)"
