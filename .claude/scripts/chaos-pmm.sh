#!/usr/bin/env bash
# PMM for a migration on a throwaway CHAOS VM: pmm-server from e2e_tests/docker-compose.yml plus
# databases from pmm-framework on the prebaked images CI pulls. Playwright runs on the VM, so
# cliHelper's `docker exec` reaches the containers; the runner host reaches the UI for MCP.
#
#   chaos-pmm.sh up <run_id> [pmm-framework args...]   # e.g. --database ps=8.4; again on a live VM adds databases
#   chaos-pmm.sh env <run_id>                          # PMM_UI_URL and ADMIN_PASSWORD, for eval on the runner host
#   chaos-pmm.sh test <run_id> [--from <checkout>] <tests/file.test.ts> [--grep regex]
#   chaos-pmm.sh ssh <run_id> <command>
#   chaos-pmm.sh down <run_id>
#
# `test` copies e2e_tests/ from --from (default: this checkout) over the VM's, then runs
# run-migration-single-test.sh there. Never edit files on the VM; it dies with the run.
# Env: DOCKER_VERSION (server image), PMM_ENABLE_NOMAD=1 for Nomad tests (pass --nomad too),
#      CHAOS_VM (chaos-vm.sh; found in the pmm-qa plugin otherwise).
set -euo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
remote=/root/pmm-qa

die() { echo "chaos-pmm: $*" >&2; exit 1; }

find_vm() {
  local c
  for c in "${CHAOS_VM:-}" "${CLAUDE_PLUGIN_ROOT:-/nonexistent}/skills/chaos-docker-provisioning/scripts/chaos-vm.sh" \
    "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/*/*/pmm-qa/skills/chaos-docker-provisioning/scripts/chaos-vm.sh \
    /opt/pmm-ai/plugins/pmm-qa/skills/chaos-docker-provisioning/scripts/chaos-vm.sh; do
    [[ -n $c && -f $c ]] && { echo "$c"; return; }
  done
  die "chaos-vm.sh not found: set CHAOS_VM, or load the pmm-qa plugin"
}
vm=$(find_vm)

on_vm() { bash "$vm" ssh "$id" "$*"; }
q() { printf '%q ' "$@"; }

sync_e2e() {
  local from=$1
  [[ -d $from/e2e_tests ]] || die "no e2e_tests/ under $from"
  on_vm "mkdir -p $remote/.claude/scripts && find $remote/e2e_tests -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} +"
  tar -C "$from" -cz --exclude=e2e_tests/node_modules --exclude=e2e_tests/test-results \
    --exclude=e2e_tests/playwright-report --exclude=e2e_tests/.env e2e_tests \
    | bash "$vm" ssh "$id" "tar -C $remote -xz"
  bash "$vm" put "$id" "$repo/.claude/scripts/run-migration-single-test.sh" "$remote/.claude/scripts/"
  # npm ci only when the lockfile changed: a full install is minutes on every run otherwise.
  on_vm "cd $remote/e2e_tests && sum=\$(sha256sum package-lock.json) && { [ \"\$sum\" = \"\$(cat /root/.e2e-lock 2>/dev/null)\" ] \
    || { npm ci --ignore-scripts --no-audit --no-fund >/dev/null && npx playwright install --with-deps chromium >/dev/null && echo \"\$sum\" > /root/.e2e-lock; }; }"
}

id=${2:-}
[[ -n $id ]] || { sed -n '2,15p' "$0"; exit 2; }

case ${1:-} in
  up)
    shift 2
    if ! bash "$vm" dir "$id" >/dev/null 2>&1; then
      bash "$vm" up "$id"
      on_vm "{ curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs; } >/root/node-install.log 2>&1 || { tail -20 /root/node-install.log; exit 1; }"
      on_vm "openssl rand -base64 18 | tr -d '/+=' > /root/admin_password"
    fi
    sync_e2e "$repo"
    on_vm "set -e; cd $remote; export ADMIN_PASSWORD=\$(cat /root/admin_password) $(q DOCKER_VERSION="${DOCKER_VERSION:-perconalab/pmm-server:3-dev-latest}" PMM_ENABLE_NOMAD="${PMM_ENABLE_NOMAD:-0}")
      docker network inspect pmm-qa >/dev/null 2>&1 || docker network create pmm-qa >/dev/null
      docker compose -f e2e_tests/docker-compose.yml up -d --quiet-pull pmm-server
      timeout 300 bash -c 'until [ \"\$(curl -sk -o /dev/null -w \"%{http_code}\" https://127.0.0.1/v1/server/readyz)\" = 200 ]; do sleep 5; done'
      docker exec pmm-server change-admin-password \"\$ADMIN_PASSWORD\" >/dev/null"
    (($# == 0)) || on_vm "cd $remote/qa-integration/pmm_qa/pmm-framework && ADMIN_PASSWORD=\$(cat /root/admin_password) ./pmm-framework --parallel $(q "$@")"
    ;;
  env)
    echo "export PMM_UI_URL=https://$(cat "$(bash "$vm" dir "$id")/hostname").tp.int.percona.com/"
    echo "export ADMIN_PASSWORD=$(on_vm cat /root/admin_password)"
    ;;
  test)
    shift 2
    from=$repo
    [[ ${1:-} != --from ]] || { from=$(cd "${2:?--from needs a path}" && pwd); shift 2; }
    sync_e2e "$from"
    on_vm "cd $remote && PMM_UI_URL=https://127.0.0.1/ ADMIN_PASSWORD=\$(cat /root/admin_password) bash .claude/scripts/run-migration-single-test.sh $(q "$@")"
    ;;
  ssh)
    shift 2
    on_vm "$@"
    ;;
  down) bash "$vm" down "$id" ;;
  *) sed -n '2,15p' "$0"; exit 2 ;;
esac
