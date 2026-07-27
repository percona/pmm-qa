#!/usr/bin/env bash
#
# percona_server_for_mysql/setup.sh
#
# Consumes the variables parsed/exported by ../qa_framework (or passed via the
# environment) and prepares the Percona Server for MySQL configuration.
#
# Input variables (from the environment):
#   DATABASE        expected: ps
#   DB_VERSION      8.0 | 8.4 | 5.7            (default: 8.4)
#   SETUP_TYPE      single | replication | gr  (default: single; empty => single)
#   NODES_COUNT     number of nodes            (default: single=1, replication=2, gr=3)
#   QUERY_SOURCE    perfschema | slowlog       (default: perfschema)
#
set -euo pipefail

# ---- Read inputs with PS defaults ----
DATABASE="${DATABASE:-ps}"
DB_VERSION="${DB_VERSION:-8.4}"
[[ -z "$DB_VERSION" ]] && DB_VERSION="8.4"
SETUP_TYPE="${SETUP_TYPE:-single}"
[[ -z "$SETUP_TYPE" ]] && SETUP_TYPE="single"
QUERY_SOURCE="${QUERY_SOURCE:-perfschema}"

# ---- Validate ----
case "$DATABASE" in
  ps|PS) ;;
  *) echo "Error: this setup handles DATABASE=ps, got '$DATABASE'" >&2; exit 1 ;;
esac
case "$SETUP_TYPE" in
  single|replication|gr) ;;
  *) echo "Error: SETUP_TYPE must be single|replication|gr, got '$SETUP_TYPE'" >&2; exit 1 ;;
esac

# ---- Node count defaults / minimums (mirrors percona-server-setup.yml) ----
default_nodes() {
  case "$SETUP_TYPE" in
    gr)          echo 3 ;;
    replication) echo 2 ;;
    *)           echo 1 ;;
  esac
}
NODES_COUNT="${NODES_COUNT:-$(default_nodes)}"
if [[ "$SETUP_TYPE" == "gr" && "$NODES_COUNT" -lt 3 ]]; then NODES_COUNT=3; fi
if [[ "$SETUP_TYPE" == "replication" && "$NODES_COUNT" -lt 2 ]]; then NODES_COUNT=2; fi

export DATABASE DB_VERSION SETUP_TYPE NODES_COUNT QUERY_SOURCE

# ---- Image location on GHCR (pushed by the build workflow) ----
IMAGE_REGISTRY="${IMAGE_REGISTRY:-ghcr.io}"
IMAGE_OWNER="${IMAGE_OWNER:-percona}"
IMAGE_REPO="${IMAGE_REPO:-percona-server-mysql}"
IMAGE_TAG="${IMAGE_TAG:-$DB_VERSION}"          # workflow tags the image with the db_version
IMAGE="${IMAGE_REGISTRY}/${IMAGE_OWNER}/${IMAGE_REPO}:${IMAGE_TAG}"

# ---- Summary ----
echo "=== Percona Server for MySQL setup ==="
echo "  DATABASE=$DATABASE"
echo "  DB_VERSION=$DB_VERSION"
echo "  SETUP_TYPE=$SETUP_TYPE"
echo "  NODES_COUNT=$NODES_COUNT"
echo "  QUERY_SOURCE=$QUERY_SOURCE"
echo "  IMAGE=$IMAGE"
echo "======================================"

# ---- Pull the image built and pushed to GHCR ----
command -v docker >/dev/null 2>&1 || { echo "Error: docker not found" >&2; exit 1; }

echo "Pulling image $IMAGE ..."
if ! docker pull "$IMAGE"; then
  echo "Error: failed to pull $IMAGE." >&2
  echo "If the package is private, log in first, e.g.:" >&2
  echo "  echo \$GHCR_TOKEN | docker login ghcr.io -u <username> --password-stdin" >&2
  exit 1
fi
echo "Image ready: $IMAGE"

# ---- Topology / container settings ----
NETWORK="${NETWORK:-pmm-qa}"
VER_TAG="${DB_VERSION//./_}"                                  # 8.0 -> 8_0
# Container name format (matches qa-integration):
#   ps_pmm[_<setup_type>]_<ps_version>_<node>
#   - single (or empty) setup type omits the setup segment
SETUP_SEG=""
if [[ -n "$SETUP_TYPE" && "$SETUP_TYPE" != "single" ]]; then
  SETUP_SEG="_${SETUP_TYPE}"
fi
CONTAINER_PREFIX="${CONTAINER_PREFIX:-ps_pmm${SETUP_SEG}_${VER_TAG}_}"
PRIMARY_HOST="${CONTAINER_PREFIX}1"
ROOT_PASSWORD="${ROOT_PASSWORD:-GRgrO9301RuF}"
REPL_USER="${REPL_USER:-repl_user}"
REPL_PASSWORD="${REPL_PASSWORD:-GRgrO9301RuF}"
HOST_PORT_BASE="${HOST_PORT_BASE:-3306}"                     # node i -> HOST_PORT_BASE + (i-1)
MYSQL_PORT="${MYSQL_PORT:-3306}"                             # in-container mysql port
GROUP_SEEDS_PORT="${GROUP_SEEDS_PORT:-34061}"
SERVER_ID_START="${SERVER_ID_START:-1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENDER_DIR="${RENDER_DIR:-$(mktemp -d)}"                     # rendered per-node configs live here

docker network create "$NETWORK" >/dev/null 2>&1 || true

# ---- Pick the config template for this setup type / version ----
#   single       -> my.cnf (no placeholders)
#   replication  -> my-async-replication[-57].cnf.j2
#   gr           -> my-group-replication[-57].cnf.j2
select_template() {
  local suffix=""
  [[ "$DB_VERSION" == 5.7* ]] && suffix="-57"
  case "$SETUP_TYPE" in
    replication) echo "$SCRIPT_DIR/my-async-replication${suffix}.cnf" ;;
    gr)          echo "$SCRIPT_DIR/my-group-replication${suffix}.cnf" ;;
    *)           echo "$SCRIPT_DIR/my.cnf" ;;
  esac
}

# ---- Render a template for one node (primary = item 1, replicas = 2..N) ----
render_template() {
  local template="$1" idx="$2" out="$3"
  local sid=$(( SERVER_ID_START + idx - 1 ))

  # Build the group-replication seeds list: prefix1:port,prefix2:port,...
  local seeds="" i
  for i in $(seq 1 "$NODES_COUNT"); do
    seeds+="${CONTAINER_PREFIX}${i}:${GROUP_SEEDS_PORT}"
    [[ "$i" -lt "$NODES_COUNT" ]] && seeds+=","
  done

  # 1) Resolve the {% if item != 1 %} ... {% endif %} block (replica-only settings).
  #    Only the {% endif %} that closes this block is consumed; inline {% endif %}
  #    (e.g. the {% if not loop.last %},{% endif %} in the seeds line) is left alone.
  awk -v idx="$idx" '
    /{% if item != 1 %}/     { in_block=1; if (idx==1) skip=1; next }
    in_block && /{% endif %}/ { in_block=0; skip=0; next }
    { if (!skip) print }
  ' "$template" > "${out}.tmp"

  # 2) Replace the group_seeds {% for %} line, then simple placeholders
  sed -i \
    -e "s#loose-group_replication_group_seeds='.*'#loose-group_replication_group_seeds='${seeds}'#" \
    -e "s/{{ *server_id_start + item - 1 *}}/${sid}/g" \
    -e "s/{{ *item *}}/${idx}/g" \
    -e "s/{{ *mysql_listen_port *}}/${MYSQL_PORT}/g" \
    -e "s#{{ *container_prefix *}}#${CONTAINER_PREFIX}#g" \
    -e "s/{{ *group_seeds_port *}}/${GROUP_SEEDS_PORT}/g" \
    "${out}.tmp"
  mv "${out}.tmp" "$out"
}

TEMPLATE="$(select_template)"
if [[ ! -f "$TEMPLATE" ]]; then
  echo "Error: config template not found: $TEMPLATE" >&2
  exit 1
fi
echo "Using config template: $TEMPLATE"

# ---- Start the nodes (primary first so replicas/GR members can find it) ----
start_node() {
  local idx="$1"
  local name="${CONTAINER_PREFIX}${idx}"
  local host_port=$(( HOST_PORT_BASE + idx - 1 ))

  # Render this node's config and mount it; entrypoint uses it verbatim.
  local rendered="${RENDER_DIR}/${name}.cnf"
  render_template "$TEMPLATE" "$idx" "$rendered"
  local cfg_args=(-v "${rendered}:/tmp/custom.cnf:ro" -e MYSQL_CFG_FILE=/tmp/custom.cnf)

  echo "Starting node ${idx}/${NODES_COUNT}: ${name} (host port ${host_port})"
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker run -d --name "$name" --network "$NETWORK" \
    --privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
    "${cfg_args[@]}" \
    -e SETUP_TYPE="$SETUP_TYPE" \
    -e CONTAINER_PREFIX="$CONTAINER_PREFIX" \
    -e NODE_INDEX="$idx" \
    -e NODES_COUNT="$NODES_COUNT" \
    -e SERVER_ID="$idx" \
    -e PRIMARY_HOST="$PRIMARY_HOST" \
    -e ROOT_PASSWORD="$ROOT_PASSWORD" \
    -e REPL_USER="$REPL_USER" \
    -e REPL_PASSWORD="$REPL_PASSWORD" \
    -p "${host_port}:3306" \
    "$IMAGE" >/dev/null
}

for (( idx=1; idx<=NODES_COUNT; idx++ )); do
  start_node "$idx"
done

echo
echo "Started ${NODES_COUNT} node(s) on network '${NETWORK}'."
echo "Per-node setup log:  docker exec ${PRIMARY_HOST} cat /var/log/ps-node-setup.log"
echo "Connect to primary:  docker exec -it ${PRIMARY_HOST} mysql -uroot -p${ROOT_PASSWORD}"
