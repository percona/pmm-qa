#!/usr/bin/env bash
# PMM-12065: (1) does `pmm-admin config --paths-base=$PMM_DIR` preserve the paths?
#            (2) does the vmagent FATAL panic still happen on a reload that keeps paths?
set -u
SRV="${PMM_SERVER}"; PW="${PMM_PASSWORD}"
export PMM_DIR="$HOME/pmm"; export PATH="$PATH:$PMM_DIR/bin"; LOG="$HOME/pmm-agent.log"

pkill -f "[p]mm-agent --config-file=$HOME" ; sleep 3
echo "### repair the config with an explicit-paths setup"
pmm-agent setup --config-file="${PMM_DIR}/config/pmm-agent.yaml" \
  --server-address="$SRV" --server-insecure-tls --server-username=admin --server-password="$PW" \
  --paths-tempdir="${PMM_DIR}/tmp" --paths-base="${PMM_DIR}" --force >/dev/null 2>&1
grep -E "paths_base|tempdir" "${PMM_DIR}/config/pmm-agent.yaml"

: > "$LOG"
nohup pmm-agent --config-file="${PMM_DIR}/config/pmm-agent.yaml" >"$LOG" 2>&1 &
for _ in $(seq 1 30); do sleep 2; pmm-admin status >/dev/null 2>&1 && break; done
echo "### agents before:"; pmm-admin list 2>&1 | tail -4

ENCPW="$(python3 -c "import urllib.parse,os;print(urllib.parse.quote(os.environ['PMM_PASSWORD'],safe=''))")"
echo
echo "########## pmm-admin config WITH --paths-base (candidate workaround) ##########"
pmm-admin config --server-insecure-tls --force --paths-base="$PMM_DIR" \
  --server-url="https://admin:${ENCPW}@${SRV}" 2>&1 | tail -4
sleep 20
echo
echo "### paths AFTER:"; grep -E "paths_base|tempdir" "${PMM_DIR}/config/pmm-agent.yaml"
echo "### mkdir/permission errors:"; grep -c "permission denied" "$LOG"
echo "### vmagent FATAL panics (isolates the cleanupTmp race):"; grep -c "FATAL: cannot create file" "$LOG"
grep -E "FATAL: cannot create file" "$LOG" | tail -2
echo "### agents after:"; pmm-admin list 2>&1 | tail -4
