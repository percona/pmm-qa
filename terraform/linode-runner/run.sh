#!/usr/bin/env bash
# run.sh -- run a command on an already-provisioned runner over the
# HTTPS exec-server (see cloud-init.yaml.tftpl), not SSH. A controller
# behind a proxied-HTTPS-only network policy cannot open a raw SSH
# connection -- confirmed live, not a config oversight -- so every
# command goes through a bearer-token-authenticated HTTPS endpoint on
# port 443 instead. The box must be addressed by its nip.io hostname,
# never the bare IP: this environment's egress proxy only routes
# connections that carry a hostname (SNI/Host), and drops bare-IP
# connections outright -- also confirmed live. Nginx on the box routes by
# that same SNI hostname (see cloud-init.yaml.tftpl's stream-router) to
# either the exec-server or PMM Server on the one port (443) this
# environment's egress reliably carries -- the "exec-" prefix here is
# what picks the exec-server, not PMM's own UI.
#
# Usage:
#   terraform/linode-runner/run.sh <run_id> -- <remote command...>
#
# Examples:
#   run.sh PMM-15196 -- 'docker network create pmm-qa'
#   run.sh PMM-15196 -- 'cd pmm-qa/qa-integration/pmm_qa/pmm-framework && ./pmm-framework --database ps=8.4'
set -euo pipefail

MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_ID="${1:?usage: run.sh <run_id> -- <remote command...>}"
case "$RUN_ID" in
  ''|.|..|*/*)
    echo "invalid run_id '$RUN_ID' -- must be a single path component (no '/', not '.' or '..')" >&2
    exit 1
    ;;
esac
if ! [[ "$RUN_ID" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "invalid run_id '$RUN_ID' -- letters, digits, '.', '_', '-' only" >&2
  exit 1
fi
shift
if [ "${1:-}" = "--" ]; then
  shift
fi
[ "$#" -gt 0 ] || {
  echo "usage: run.sh <run_id> -- <remote command...>" >&2
  exit 1
}

RUN_DIR="$MODULE_DIR/runs/$RUN_ID"
[ -f "$RUN_DIR/ip" ] || {
  echo "No such run_id '$RUN_ID' (expected $RUN_DIR/ip) -- run up.sh first." >&2
  exit 1
}
IP=$(cat "$RUN_DIR/ip")
TOKEN=$(cat "$RUN_DIR/exec_token")
HOST="exec-$(echo "$IP" | tr '.' '-').nip.io"
CMD="$*"

CACERT="$RUN_DIR/exec_cert.pem"
[ -f "$CACERT" ] || {
  echo "run.sh: missing $CACERT -- run_id '$RUN_ID' was provisioned before certificate pinning was added; re-provision it." >&2
  exit 1
}

BODY=$(python3 -c 'import json,sys; print(json.dumps({"cmd": sys.argv[1]}))' "$CMD")

if ! RESP=$(curl -sS -m 620 --cacert "$CACERT" -X POST "https://$HOST/exec" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$BODY"); then
  echo "run.sh: failed to reach exec-server at https://$HOST/exec" >&2
  exit 1
fi

python3 -c '
import json, sys
d = json.loads(sys.argv[1])
sys.stdout.write(d.get("stdout",""))
sys.stderr.write(d.get("stderr",""))
sys.exit(d.get("exit_code", 1))
' "$RESP"
