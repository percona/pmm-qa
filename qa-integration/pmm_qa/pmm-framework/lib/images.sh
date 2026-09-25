#!/usr/bin/env bash
#
# lib/images.sh -- build the prebaked images the setups run, from
# images/<database>/Dockerfile. Only the choice of build args lives here.

# Links each published package to this repository on GitHub.
readonly PREBAKED_SOURCE_LABEL=org.opencontainers.image.source=https://github.com/percona/pmm-qa

# Build pmm-qa/NAME:TAG from the build context DIR (images/<database> unless
# given as a path).
# Usage: build_image NAME:TAG DIR [DOCKER_BUILD_ARGS...]
build_image() {
  local image=$1 context=$2
  shift 2
  [[ $context == /* ]] || context=$FRAMEWORK_DIR/images/$context
  docker build "$@" --label "$PREBAKED_SOURCE_LABEL" -t "pmm-qa/$image" "$context" ||
    die "Building pmm-qa/$image failed."
}

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
  build_image "ps:$version" ps --build-arg "PS_IMAGE=$base" --build-arg "XTRABACKUP_PACKAGE=$xtrabackup"
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
  build_image "mysql:$version" mysql "${stage[@]}"
}

# Build pmm-qa/pxc-proxysql:VERSION, the whole cluster plus ProxySQL in one
# image. 8.4 disabled mysql_native_password, which Percona's proxysql2 still
# needs, so from 8.4 it gets upstream ProxySQL 3 instead.
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
  build_image "pxc-proxysql:$tag" pxc --build-arg "PXC_VERSION=$version" \
    --build-arg "PROXYSQL_PACKAGE=$package" --build-arg "PXC_TARBALL=$tarball"
}

# Build pmm-qa/psmdb:VERSION-olOL, where VERSION is a major such as 8.0 or a
# full patch such as 8.0.26-11. The config it bakes in comes from
# pmm_psmdb-pbm_setup, whose compose files run it.
build_psmdb_image() {
  local tag=$1 version=${1%-ol*} ol=${1##*-ol}
  [[ $ol == 8 || $ol == 9 ]] || die "PSMDB image tag '$tag' must end in -ol8 or -ol9."
  build_image "psmdb:$tag" "$QA_INTEGRATION_ROOT/pmm_psmdb-pbm_setup" -f "$FRAMEWORK_DIR/images/psmdb/Dockerfile" \
    --build-arg "PSMDB_VERSION=$version" --build-arg "OL_VERSION=$ol"
}

build_haproxy_image() {
  [[ $1 == ol9 ]] || die "HAProxy has no prebaked image '$1'; use ol9."
  build_image haproxy:ol9 haproxy
}

build_valkey_image() {
  [[ $1 == 7 || $1 == 8 ]] || die "Valkey $1 has no prebaked image; use 7 or 8."
  build_image "valkey:$1" valkey --build-arg "VALKEY_VERSION=$1"
}

# TAG is <redis_exporter version>-<process-exporter version>.
build_external_image() {
  local tag=$1
  [[ $tag == *-* ]] || die "External image tag '$tag' must be <redis_exporter>-<process-exporter>."
  build_image "external:$tag" external --build-arg "REDIS_EXPORTER_VERSION=${tag%-*}" \
    --build-arg "PROCESS_EXPORTER_VERSION=${tag#*-}"
}

build_pdpgsql_image() {
  [[ $1 =~ ^1[4-8]$ ]] || die "PDPGSQL $1 has no prebaked image; use 14 to 18."
  build_image "pdpgsql:$1" pdpgsql --build-arg "PG_VERSION=$1"
}

build_ssl_pdpgsql_image() {
  [[ $1 =~ ^1[4-7]$ ]] || die "SSL_PDPGSQL $1 has no prebaked image; use 14 to 17."
  build_image "ssl-pdpgsql:$1" pdpgsql/ssl --build-arg "PG_VERSION=$1"
}

build_pgsql_image() {
  [[ $1 =~ ^1[4-8]$ ]] || die "PGSQL $1 has no prebaked image; use 14 to 18."
  build_image "pgsql:$1" pgsql --build-arg "PG_VERSION=$1"
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
