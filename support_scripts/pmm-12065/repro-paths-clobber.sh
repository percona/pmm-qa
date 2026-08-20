#!/usr/bin/env bash
# PMM-12065: does `pmm-admin config` (the documented "Register the node" step)
# overwrite paths_base in an existing pmm-agent.yaml with the compiled-in default?
# Env in: PMM_VERSION, PMM_SERVER, PMM_PASSWORD
set -u
VER="${PMM_VERSION}"; SRV="${PMM_SERVER}"; PW="${PMM_PASSWORD}"
SRC="$HOME/src"; export PMM_DIR="$HOME/pmm"; LOG="$HOME/pmm-agent.log"

rm -rf "$SRC" "$PMM_DIR" "$LOG"; mkdir -p "$SRC" "$PMM_DIR"
cd "$SRC" || exit 1
cp "/home/pmmtest/pmm-client-$VER-x86_64.tar.gz" . 2>/dev/null || \
  wget -q "https://downloads.percona.com/downloads/pmm3/$VER/binary/tarball/pmm-client-$VER-x86_64.tar.gz"
tar xfz "pmm-client-$VER-x86_64.tar.gz"
cd "pmm-client-$VER" || exit 1

echo "### install_tarball with PMM_DIR ($PMM_DIR) separate from the extracted dir ($PWD)"
./install_tarball; echo "install_tarball exit=$?"
echo "### exporters installed:"; ls "$PMM_DIR/exporters"
export PATH="$PATH:$PMM_DIR/bin"

pmm-agent setup --config-file="${PMM_DIR}/config/pmm-agent.yaml" \
  --server-address="$SRV" --server-insecure-tls \
  --server-username=admin --server-password="$PW" \
  --paths-tempdir="${PMM_DIR}/tmp" --paths-base="${PMM_DIR}" --force 2>&1 | tail -4
echo "### paths in pmm-agent.yaml AFTER 'pmm-agent setup':"
grep -E "paths_base|tempdir|nomad_data_dir" "${PMM_DIR}/config/pmm-agent.yaml"

nohup pmm-agent --config-file="${PMM_DIR}/config/pmm-agent.yaml" >"$LOG" 2>&1 &
for _ in $(seq 1 30); do sleep 2; pmm-admin status >/dev/null 2>&1 && break; done
echo "### pmm-admin list BEFORE 'pmm-admin config':"; pmm-admin list 2>&1 | tail -5

# URL-encode the password so it survives --server-url parsing
ENCPW="$(python3 -c "import urllib.parse,os;print(urllib.parse.quote(os.environ['PMM_PASSWORD'],safe=''))")"
echo
echo "########## documented 'Register the node' step ##########"
pmm-admin config --server-insecure-tls --force --server-url="https://admin:${ENCPW}@${SRV}" 2>&1
sleep 20
echo
echo "### paths in pmm-agent.yaml AFTER 'pmm-admin config':"
grep -E "paths_base|tempdir|nomad_data_dir" "${PMM_DIR}/config/pmm-agent.yaml"
echo
echo "### agent log, permission/panic lines:"
grep -E "permission denied|panic|FATAL|no such file or directory" "$LOG" | tail -20
echo
echo "### pmm-admin list AFTER:"; pmm-admin list 2>&1 | tail -6
