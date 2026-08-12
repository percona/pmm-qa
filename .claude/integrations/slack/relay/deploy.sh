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
LABEL=${RELAY_LABEL:-pmm-ai-relay}
# relay.js is pulled from the pmm-qa clone on the box (see runcmd), NOT baked
# into cloud-init -- it outgrew Linode's 16KB user_data cap. REF picks the ref
# that clone checks out (default main; set PMM_QA_REF to test a branch).
REF=${PMM_QA_REF:-main}

b64() { base64 < "$1" | tr -d '\n'; }  # single line on both GNU (-w0) and BSD base64

UNIT=$(mktemp)
cat > "$UNIT" <<'EOF'
[Unit]
Description=PMM AI Slack/Jira relay
After=network-online.target

[Service]
# HOME is unset for systemd services; the Linode Terraform provider (run by
# /provision -> up.sh) needs it to resolve its config path, so pin it to root's.
Environment=HOME=/root
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
  - mkdir -p /opt/pmm-ai-relay/people /opt/pmm-ai-relay/tls /etc/letsencrypt/renewal-hooks/deploy
  - curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  - apt-get install -y nodejs certbot git unzip
  # terraform + the pmm-qa module so /linode/provision + /linode/destroy can run linode-runner
  # here (the LINODE_TOKEN stays on this box, never in the shared Claude env)
  - curl -fsSL https://releases.hashicorp.com/terraform/1.9.8/terraform_1.9.8_linux_amd64.zip -o /tmp/tf.zip && unzip -o /tmp/tf.zip -d /usr/local/bin && rm -f /tmp/tf.zip
  - git clone --depth 1 --branch __PMM_QA_REF__ https://github.com/percona/pmm-qa.git /opt/pmm-qa || git clone --depth 1 https://github.com/percona/pmm-qa.git /opt/pmm-qa
  # relay.js comes from the clone (not baked -- keeps user_data under 16KB)
  - cp /opt/pmm-qa/.claude/integrations/slack/relay/relay.js /opt/pmm-ai-relay/relay.js
  # Derive this box's OWN hostname (Linode rDNS <ip-dashes>.ip.linodeusercontent.com)
  # so the same image works for any relay IP -- not pinned to one reserved IP.
  # One shell block so $HOST persists; certbot validates over public HTTP-01.
  - |
    PUBIP=$(curl -fsS --max-time 15 https://api.ipify.org || ip -4 -o addr show scope global | awk '{print $4}' | cut -d/ -f1 | head -1)
    HOST="$(echo "$PUBIP" | tr '.' '-').ip.linodeusercontent.com"
    echo "relay host: $HOST ($PUBIP)"
    openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -keyout /opt/pmm-ai-relay/tls/key.pem -out /opt/pmm-ai-relay/tls/cert.pem -subj "/CN=$HOST" -addext "subjectAltName=DNS:$HOST,IP:$PUBIP"
    certbot certonly --standalone --non-interactive --agree-tos -m davi.travaglia@percona.com -d "$HOST" --http-01-port 80 || echo "LE issuance failed - relay stays on self-signed"
    if [ -f "/etc/letsencrypt/live/$HOST/fullchain.pem" ]; then cp "/etc/letsencrypt/live/$HOST/fullchain.pem" /opt/pmm-ai-relay/tls/cert.pem; cp "/etc/letsencrypt/live/$HOST/privkey.pem" /opt/pmm-ai-relay/tls/key.pem; fi
    printf '#!/bin/sh\ncp /etc/letsencrypt/live/%s/fullchain.pem /opt/pmm-ai-relay/tls/cert.pem\ncp /etc/letsencrypt/live/%s/privkey.pem /opt/pmm-ai-relay/tls/key.pem\nsystemctl restart pmm-ai-relay\n' "$HOST" "$HOST" > /etc/letsencrypt/renewal-hooks/deploy/relay.sh
    chmod +x /etc/letsencrypt/renewal-hooks/deploy/relay.sh
    if grep -q '^REPLY_BASE_URL=' /opt/pmm-ai-relay/.env; then sed -i "s#^REPLY_BASE_URL=.*#REPLY_BASE_URL=https://$HOST#" /opt/pmm-ai-relay/.env; else echo "REPLY_BASE_URL=https://$HOST" >> /opt/pmm-ai-relay/.env; fi
  - cd /opt/pmm-ai-relay && npm install @slack/bolt
  - systemctl daemon-reload
  - systemctl enable --now pmm-ai-relay
EOF

# Bake the chosen ref into the runcmd clone (heredoc above is single-quoted).
sed -i "s|__PMM_QA_REF__|$REF|g" "$CLOUD_INIT"

# gzip: Linode caps decoded user_data at 16KB and cloud-init transparently
# handles gzipped input. relay.js is fetched from the clone (not baked) to stay
# under that cap; only .env + the unit are baked here.
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
  BODY=$(jq -n --arg pass "$ROOT_PASS" --arg ud "$USER_DATA" --argjson keys "$AUTH_KEYS" --arg label "$LABEL" \
    '{label:$label, type:"g6-nanode-1", region:"eu-central", image:"linode/ubuntu24.04",
      root_pass:$pass, authorized_keys:$keys, backups_enabled:false,
      tags:["pmm-ai","relay"], metadata:{user_data:$ud}}')
  curl -sS --fail-with-body -X POST "${HDR[@]}" "$API" -d "$BODY" | jq '{id,label,ipv4,status}'
fi

echo "root password (save it): $ROOT_PASS"
rm -f "$UNIT" "$CLOUD_INIT"
