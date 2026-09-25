#!/usr/bin/env bash
#
# lib/images.sh -- build the prebaked images the docker-backed setups run.
#
# The Dockerfiles are shared with the TypeScript provisioner under
# provisioning/images; only the choice of build args lives here.

PREBAKED_IMAGES_DIR=${PREBAKED_IMAGES_DIR:-$QA_INTEGRATION_ROOT/../provisioning/images}
# Links each published package to this repository on GitHub.
readonly PREBAKED_SOURCE_LABEL=org.opencontainers.image.source=https://github.com/percona/pmm-qa

# Build pmm-qa/ps:VERSION.
build_ps_image() {
  local version=$1 base xtrabackup
  case $version in
    5.7) base=percona/percona-server:5.7 xtrabackup=percona-xtrabackup-24 ;;
    8.0) base=percona/percona-server:8.0.46 xtrabackup=percona-xtrabackup-80 ;;
    8.4) base=percona/percona-server:8.4.10 xtrabackup=percona-xtrabackup-84 ;;
    # No XtraBackup is published for 9.7, so setup_ps refuses BACKUP=true there.
    9.7) base=percona/percona-server:9.7.1-1.1 xtrabackup='' ;;
    *) die "PS $version has no prebaked image; use 5.7, 8.0, 8.4 or 9.7." ;;
  esac
  docker build -f "$PREBAKED_IMAGES_DIR/engines/ps/Dockerfile" \
    --build-arg "PS_IMAGE=$base" --build-arg "XTRABACKUP_PACKAGE=$xtrabackup" \
    --label "$PREBAKED_SOURCE_LABEL" -t "pmm-qa/ps:$version" "$PREBAKED_IMAGES_DIR" ||
    die "Building pmm-qa/ps:$version failed."
}

# Build pmm-qa/mysql:VERSION. 5.7 has its own stage because mysql:5.7 is
# Oracle Linux 7 with no EPEL sysbench.
build_mysql_image() {
  local version=$1
  local -a stage=(--target mysql-epel --build-arg "MYSQL_IMAGE=mysql:$version")
  case $version in
    5.7) stage=(--target mysql-57) ;;
    8.0 | 8.4 | 9.7) ;;
    *) die "MySQL $version has no prebaked image; use 5.7, 8.0, 8.4 or 9.7." ;;
  esac
  docker build -f "$PREBAKED_IMAGES_DIR/engines/mysql/Dockerfile" "${stage[@]}" \
    --label "$PREBAKED_SOURCE_LABEL" -t "pmm-qa/mysql:$version" "$PREBAKED_IMAGES_DIR" ||
    die "Building pmm-qa/mysql:$version failed."
}

# Build pmm-qa/pxc-proxysql:VERSION, the whole cluster plus ProxySQL in one
# image (images/pxc). 8.4 disabled mysql_native_password, which Percona's
# proxysql2 still needs, so from 8.4 it gets upstream ProxySQL 3 instead.
#
# A PXC TARBALL is built into its own tag, VERSION-tb<first 8 hex of the URL's
# sha256>, so a pre-release never replaces the packaged image.
build_pxc_proxysql_image() {
  local version=$1 tarball=${2:-} package='' tag=$1
  case $version in
    5.7 | 8.0) ;;
    8.4 | 9.7) package=https://github.com/sysown/proxysql/releases/download/v3.0.11/proxysql-3.0.11-1-almalinux9.x86_64.rpm ;;
    *) die "PXC $version has no prebaked image; use 5.7, 8.0, 8.4 or 9.7." ;;
  esac
  if [[ -n $tarball ]]; then
    tag=$(pxc_proxysql_tag "$version" "$tarball")
  fi
  docker build -f "$FRAMEWORK_DIR/images/pxc/Dockerfile" \
    --build-arg "PXC_VERSION=$version" --build-arg "PROXYSQL_PACKAGE=$package" \
    --build-arg "PXC_TARBALL=$tarball" \
    --label "$PREBAKED_SOURCE_LABEL" -t "pmm-qa/pxc-proxysql:$tag" "$FRAMEWORK_DIR/images/pxc" ||
    die "Building pmm-qa/pxc-proxysql:$tag failed."
}

# Build pmm-qa/psmdb:VERSION-olOL (images/psmdb), where VERSION is a major
# such as 8.0 or a full patch such as 8.0.26-11.
build_psmdb_image() {
  local tag=$1 version=${1%-ol*} ol=${1##*-ol}
  [[ $ol == 8 || $ol == 9 ]] || die "PSMDB image tag '$tag' must end in -ol8 or -ol9."
  docker build -f "$FRAMEWORK_DIR/images/psmdb/Dockerfile" \
    --build-arg "PSMDB_VERSION=$version" --build-arg "OL_VERSION=$ol" \
    --label "$PREBAKED_SOURCE_LABEL" -t "pmm-qa/psmdb:$tag" "$QA_INTEGRATION_ROOT/pmm_psmdb-pbm_setup" ||
    die "Building pmm-qa/psmdb:$tag failed."
}

# Build pmm-qa/haproxy:ol9 (images/haproxy).
build_haproxy_image() {
  [[ $1 == ol9 ]] || die "HAProxy has no prebaked image '$1'; use ol9."
  docker build --label "$PREBAKED_SOURCE_LABEL" -t pmm-qa/haproxy:ol9 "$FRAMEWORK_DIR/images/haproxy" ||
    die 'Building pmm-qa/haproxy:ol9 failed.'
}

# Build pmm-qa/valkey:VERSION (images/valkey).
build_valkey_image() {
  [[ $1 == 7 || $1 == 8 ]] || die "Valkey $1 has no prebaked image; use 7 or 8."
  docker build --build-arg "VALKEY_VERSION=$1" --label "$PREBAKED_SOURCE_LABEL" -t "pmm-qa/valkey:$1" \
    "$FRAMEWORK_DIR/images/valkey" || die "Building pmm-qa/valkey:$1 failed."
}

# Build pmm-qa/external:TAG (images/external), TAG being
# <redis_exporter version>-<process-exporter version>.
build_external_image() {
  local tag=$1
  [[ $tag == *-* ]] || die "External image tag '$tag' must be <redis_exporter>-<process-exporter>."
  docker build --build-arg "REDIS_EXPORTER_VERSION=${tag%-*}" --build-arg "PROCESS_EXPORTER_VERSION=${tag#*-}" \
    --label "$PREBAKED_SOURCE_LABEL" -t "pmm-qa/external:$tag" "$FRAMEWORK_DIR/images/external" ||
    die "Building pmm-qa/external:$tag failed."
}

# Build pmm-qa/pdpgsql:VERSION (images/pdpgsql).
build_pdpgsql_image() {
  [[ $1 =~ ^1[4-8]$ ]] || die "PDPGSQL $1 has no prebaked image; use 14 to 18."
  docker build --build-arg "PG_VERSION=$1" --label "$PREBAKED_SOURCE_LABEL" -t "pmm-qa/pdpgsql:$1" \
    "$FRAMEWORK_DIR/images/pdpgsql" || die "Building pmm-qa/pdpgsql:$1 failed."
}

# Build pmm-qa/pgsql:VERSION (images/pgsql).
build_pgsql_image() {
  [[ $1 =~ ^1[4-8]$ ]] || die "PGSQL $1 has no prebaked image; use 14 to 18."
  docker build -f "$FRAMEWORK_DIR/images/pgsql/Dockerfile" --build-arg "PG_VERSION=$1" \
    --label "$PREBAKED_SOURCE_LABEL" -t "pmm-qa/pgsql:$1" "$QA_INTEGRATION_ROOT/pmm_qa" || die "Building pmm-qa/pgsql:$1 failed."
}

# Build pmm-qa/ssl-pdpgsql:VERSION (images/ssl-pdpgsql).
build_ssl_pdpgsql_image() {
  [[ $1 =~ ^1[4-7]$ ]] || die "SSL_PDPGSQL $1 has no prebaked image; use 14 to 17."
  docker build -f "$FRAMEWORK_DIR/images/ssl-pdpgsql/Dockerfile" --build-arg "PG_VERSION=$1" \
    --label "$PREBAKED_SOURCE_LABEL" -t "pmm-qa/ssl-pdpgsql:$1" "$QA_INTEGRATION_ROOT/pmm_qa/tls-ssl-setup" ||
    die "Building pmm-qa/ssl-pdpgsql:$1 failed."
}

# Stdout: the pmm-qa/pxc-proxysql tag for VERSION and an optional TARBALL URL
pxc_proxysql_tag() {
  if [[ -n ${2:-} ]]; then
    printf '%s-tb%s' "$1" "$(printf '%s' "$2" | sha256sum | cut -c1-8)"
  else
    printf '%s' "$1"
  fi
}

# Where .github/workflows/build-prebaked-images.yml publishes. Set it empty to
# always build locally, e.g. to try a Dockerfile change.
PREBAKED_REGISTRY=${PREBAKED_REGISTRY-ghcr.io/percona/pmm-qa}

# Make pmm-qa/ENGINE:TAG present: keep a local copy, else pull the published
# one, else build it. The engine's builder gets BUILD_ARGS, or just TAG when
# there are none.
# Usage: ensure_image ENGINE TAG [BUILD_ARGS...]
ensure_image() {
  local engine=$1 tag=$2 published
  shift 2
  (($# > 0)) || set -- "$tag"
  docker image inspect "pmm-qa/$engine:$tag" >/dev/null 2>&1 && return 0
  published=$PREBAKED_REGISTRY/$engine:$tag
  if [[ -n $PREBAKED_REGISTRY ]] && docker pull --quiet "$published" >/dev/null 2>&1; then
    must docker tag "$published" "pmm-qa/$engine:$tag"
    return 0
  fi
  "build_${engine//-/_}_image" "$@"
}
