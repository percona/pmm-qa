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

# ---- PS setup / orchestration goes here (intentionally not implemented yet) ----
