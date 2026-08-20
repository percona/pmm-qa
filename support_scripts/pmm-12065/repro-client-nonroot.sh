#!/usr/bin/env bash
# PMM-12065: follows documentation/docs/install-pmm/install-pmm-client/binary_package.md
# "Without root permissions" + "Register the node" literally, as a non-root user.
# Env in: PMM_VERSION, PMM_SERVER, PMM_PASSWORD
set -u

VER="${PMM_VERSION}"
SRV="${PMM_SERVER}"
PW="${PMM_PASSWORD}"
HOME_DIR="$HOME"
LOG="$HOME_DIR/pmm-agent.log"

echo "### whoami: $(id -un)  home: $HOME_DIR"

cd "$HOME_DIR" || exit 1
rm -rf "pmm-client-$VER" "$LOG"
if [ ! -f "pmm-client-$VER-x86_64.tar.gz" ]; then
  wget -q "https://downloads.percona.com/downloads/pmm3/$VER/binary/tarball/pmm-client-$VER-x86_64.tar.gz" || exit 1
fi
tar xfz "pmm-client-$VER-x86_64.tar.gz"
cd "pmm-client-$VER" || exit 1

# doc step 5+6: install into a dir the unprivileged user owns
export PMM_DIR="$HOME_DIR/pmm-client-$VER"
./install_tarball
# doc step 7
export PATH="$PATH:$PMM_DIR/bin"

# doc step 8: setup, explicitly passing --paths-base / --paths-tempdir
echo "### STEP 8: pmm-agent setup"
pmm-agent setup --config-file="${PMM_DIR}/config/pmm-agent.yaml" \
  --server-address="$SRV" --server-insecure-tls \
  --server-username=admin --server-password="$PW" \
  --paths-tempdir="${PMM_DIR}/tmp" --paths-base="${PMM_DIR}"

echo "### CONFIG AFTER 'pmm-agent setup' (paths should point at \$PMM_DIR)"
grep -E "paths_base|tempdir|exporters_base|nomad_data_dir" "${PMM_DIR}/config/pmm-agent.yaml"

# doc step 9: run the agent
echo "### STEP 9: pmm-agent run (background)"
nohup pmm-agent --config-file="${PMM_DIR}/config/pmm-agent.yaml" >"$LOG" 2>&1 &
for _ in $(seq 1 30); do
  sleep 2
  pmm-admin status >/dev/null 2>&1 && break
done
echo "### pmm-admin status:"; pmm-admin status 2>&1 | head -20
echo "### tmp tree created by the running agent:"
find "${PMM_DIR}/tmp" -maxdepth 2 2>&1 | head -20

echo
echo "############ 'Register the node' step: pmm-admin config ############"
pmm-admin config --server-insecure-tls --server-url="https://admin:${PW}@${SRV}" 2>&1

sleep 15
echo
echo "### CONFIG AFTER 'pmm-admin config'"
grep -E "paths_base|tempdir|exporters_base|nomad_data_dir" "${PMM_DIR}/config/pmm-agent.yaml"
echo
echo "### AGENT LOG (errors/panics)"
grep -E "permission denied|panic|FATAL|no such file or directory|level=error" "$LOG" | tail -30
echo
echo "### pmm-admin list"
pmm-admin list 2>&1 | head -20
