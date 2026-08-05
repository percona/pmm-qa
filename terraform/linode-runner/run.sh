#!/usr/bin/env bash
# run.sh -- run a command on an already-provisioned runner over the
# HTTPS exec-server (see cloud-init.yaml.tftpl), not SSH. A controller
# behind a proxied-HTTPS-only network policy cannot open a raw SSH
# connection -- confirmed live, not a config oversight -- so every
# command goes through a bearer-token-authenticated HTTPS endpoint on
# port 443 instead. The box must be addressed by its nip.io hostname,
# never the bare IP: this environment's egress proxy only routes
# connections that carry a hostname (SNI/Host), and drops bare-IP
# connections outright -- also confirmed live.
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
HOST="$(echo "$IP" | tr '.' '-').nip.io"
CMD="$*"

BODY=$(python3 -c 'import json,sys; print(json.dumps({"cmd": sys.argv[1]}))' "$CMD")

if ! RESP=$(curl -k -sS -m 620 -X POST "https://$HOST/exec" \
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
