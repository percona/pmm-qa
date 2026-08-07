#!/usr/bin/env bash
# Deploy/restore the pmm-ai-relay Linode from this directory's relay.js.
#
#   ./deploy.sh /path/to/.env [people_dir] [ssh_pubkey_file]
#
# Needs LINODE_TOKEN in the environment. The .env file and the per-person
# JSON files (both from the LastPass "PMM" folder, NEVER committed) are baked
# into cloud-init and the service starts automatically. If a Linode labeled
# pmm-ai-relay exists it is REBUILT (same ID, same IP — this is why the IP
# survives "recreation"); otherwise a new g6-nanode-1 is created in eu-central.
set -euo pipefail

ENV_FILE=${1:?usage: deploy.sh /path/to/.env [people_dir] [ssh_pubkey_file]}
PEOPLE_DIR_IN=${2:-}
PUBKEY_FILE=${3:-}
HERE=$(cd "$(dirname "$0")" && pwd)
LABEL=pmm-ai-relay

b64() { base64 -w0 "$1" 2>/dev/null || base64 "$1"; }

UNIT=$(mktemp)
cat > "$UNIT" <<'EOF'
[Unit]
Description=PMM AI Slack/Jira relay
After=network-online.target

[Service]
EnvironmentFile=/opt/pmm-ai-relay/.env
WorkingDirectory=/opt/pmm-ai-relay
ExecStart=/usr/bin/node relay.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

CLOUD_INIT=$(mktemp)
cat > "$CLOUD_INIT" <<EOF
#cloud-config
write_files:
  - path: /opt/pmm-ai-relay/relay.js
    permissions: "0644"
    encoding: b64
    content: $(b64 "$HERE/relay.js")
  - path: /opt/pmm-ai-relay/.env
    permissions: "0600"
    encoding: b64
    content: $(b64 "$ENV_FILE")
  - path: /etc/systemd/system/pmm-ai-relay.service
    permissions: "0644"
    encoding: b64
    content: $(b64 "$UNIT")
EOF

# per-person files (people_dir arg): restored exactly as they were saved
if [ -n "$PEOPLE_DIR_IN" ]; then
  for f in "$PEOPLE_DIR_IN"/*.json; do
    [ -e "$f" ] || continue
    cat >> "$CLOUD_INIT" <<EOF
  - path: /opt/pmm-ai-relay/people/$(basename "$f")
    permissions: "0600"
    encoding: b64
    content: $(b64 "$f")
EOF
  done
fi

cat >> "$CLOUD_INIT" <<'EOF'
runcmd:
  - mkdir -p /opt/pmm-ai-relay/people
  - curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  - apt-get install -y nodejs
  - cd /opt/pmm-ai-relay && npm install @slack/bolt
  - systemctl daemon-reload
  - systemctl enable --now pmm-ai-relay
EOF

# gzip: Linode caps decoded user_data at 16KB and cloud-init transparently
# handles gzipped input; the embedded relay.js pushes the plain form past the cap
USER_DATA=$(gzip -9 -c "$CLOUD_INIT" | { base64 -w0 2>/dev/null || base64; })
# Keep the team's known root password across rebuilds: export RELAY_ROOT_PASS
# (from the LastPass "PMM" folder) before running. Only generates a fresh one
# when unset — and then you must save the printed value.
ROOT_PASS=${RELAY_ROOT_PASS:-$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 32)}
AUTH_KEYS="[]"
[ -n "$PUBKEY_FILE" ] && AUTH_KEYS=$(jq -Rn --arg k "$(cat "$PUBKEY_FILE")" '[$k]')

API=https://api.linode.com/v4/linode/instances
HDR=(-H "Authorization: Bearer $LINODE_TOKEN" -H "Content-Type: application/json")

ID=$(curl -sS "${HDR[@]}" "$API" | jq -r ".data[] | select(.label==\"$LABEL\") | .id" | head -1)

if [ -n "$ID" ]; then
  echo "Rebuilding existing $LABEL (id $ID — IP is preserved)"
  BODY=$(jq -n --arg pass "$ROOT_PASS" --arg ud "$USER_DATA" --argjson keys "$AUTH_KEYS" \
    '{image:"linode/ubuntu24.04", root_pass:$pass, authorized_keys:$keys, metadata:{user_data:$ud}}')
  curl -sS --fail-with-body -X POST "${HDR[@]}" "$API/$ID/rebuild" -d "$BODY" | jq '{id,label,ipv4,status}'
else
  echo "Creating new $LABEL"
  BODY=$(jq -n --arg pass "$ROOT_PASS" --arg ud "$USER_DATA" --argjson keys "$AUTH_KEYS" \
    '{label:"pmm-ai-relay", type:"g6-nanode-1", region:"eu-central", image:"linode/ubuntu24.04",
      root_pass:$pass, authorized_keys:$keys, backups_enabled:false,
      tags:["pmm-ai","relay","do-not-delete"], metadata:{user_data:$ud}}')
  curl -sS --fail-with-body -X POST "${HDR[@]}" "$API" -d "$BODY" | jq '{id,label,ipv4,status}'
fi

echo "root password (save it): $ROOT_PASS"
rm -f "$UNIT" "$CLOUD_INIT"
