#!/usr/bin/env bash
#
# lib/images.sh -- build the prebaked images the setups run, from
# images/<database>/Dockerfile. Only the choice of build args lives here.

# Links each published package to this repository on GitHub.
readonly PREBAKED_SOURCE_LABEL=org.opencontainers.image.source=https://github.com/percona/pmm-qa

# Tools baked into the images. Dockerfile ARGs have no defaults: each builder
# passes every ARG its Dockerfile declares (tests/dispatch.bats checks).
readonly SYSBENCH_VERSION=1.0.20
readonly PBM_VERSION=2.9.1-1
readonly MGODATAGEN_VERSION=0.11.2

# DIR is images/<DIR> unless absolute.
# Usage: build_image NAME:TAG DIR [DOCKER_BUILD_ARGS...]
build_image() {
  local image=$1 context=$2
  shift 2
  [[ $context == /* ]] || context=$FRAMEWORK_DIR/images/$context
  docker build "$@" --label "$PREBAKED_SOURCE_LABEL" -t "pmm-qa/$image" "$context" ||
    die "Building pmm-qa/$image failed."
}

# Usage: has_image TYPE VERSION -- dies unless the catalogue offers VERSION
has_image() {
  database_version_exists "$1" "$2" || die "$1 $2 has no prebaked image; use one of: ${DB_VERSIONS[$1]}."
}

build_ps_image() {
  local version=$1 xtrabackup=percona-xtrabackup-${1/./}
  has_image PS "$version"
  [[ $version != 5.7 ]] || xtrabackup=percona-xtrabackup-24
  build_image "ps:$version" ps --build-arg "PS_IMAGE=percona/percona-server:$version" \
    --build-arg "XTRABACKUP_PACKAGE=$xtrabackup" --build-arg "SYSBENCH_VERSION=$SYSBENCH_VERSION"
}

# mysql:5.7 is Oracle Linux 7 with no EPEL sysbench, hence its own stage.
build_mysql_image() {
  local version=$1 stage=mysql-epel
  has_image MYSQL "$version"
  [[ $version != 5.7 ]] || stage=mysql-57
  build_image "mysql:$version" mysql --target "$stage" --build-arg "MYSQL_IMAGE=mysql:$version" \
    --build-arg "SYSBENCH_VERSION=$SYSBENCH_VERSION"
}

# 8.4 dropped mysql_native_password, which Percona's proxysql2 needs, so 8.4+
# gets upstream ProxySQL 3. A TARBALL gets its own tag so a pre-release never
# replaces the packaged image.
build_pxc_proxysql_image() {
  local version=$1 tarball=${2:-} package='' tag=$1
  has_image PXC "$version"
  case $version in
    5.7 | 8.0) ;;
    *) package=https://github.com/sysown/proxysql/releases/download/v3.0.11/proxysql-3.0.11-1-almalinux9.$(uname -m).rpm ;;
  esac
  if [[ -n $tarball ]]; then
    tag=$(pxc_proxysql_tag "$version" "$tarball")
  fi
  build_image "pxc-proxysql:$tag" pxc-proxysql --build-arg "PXC_VERSION=$version" \
    --build-arg "PROXYSQL_PACKAGE=$package" --build-arg "PXC_TARBALL=$tarball"
}

# TAG is VERSION-olOL; VERSION is a major (8.0) or a full patch (8.0.26-11).
build_psmdb_image() {
  local tag=$1 version=${1%-ol*} ol=${1##*-ol}
  [[ $ol == 8 || $ol == 9 ]] || die "PSMDB image tag '$tag' must end in -ol8 or -ol9."
  build_image "psmdb:$tag" "$QA_INTEGRATION_ROOT/pmm_psmdb-pbm_setup" -f "$FRAMEWORK_DIR/images/psmdb/Dockerfile" \
    --build-arg "PSMDB_VERSION=$version" --build-arg "OL_VERSION=$ol" \
    --build-arg "PBM_VERSION=$PBM_VERSION" --build-arg "MGODATAGEN_VERSION=$MGODATAGEN_VERSION"
}

build_haproxy_image() {
  [[ $1 == latest ]] || die "HAProxy has no prebaked image '$1'; use latest."
  build_image haproxy:latest haproxy
}

# The KDC the PSMDB replica set compose file runs as kerberos/local.
build_kerberos_image() {
  [[ $1 == latest ]] || die "Kerberos has no prebaked image '$1'; use latest."
  build_image kerberos:latest kerberos
}

build_valkey_image() {
  has_image VALKEY "$1"
  build_image "valkey:$1" valkey --build-arg "VALKEY_VERSION=$1"
}

# <redis_exporter version>-<process-exporter version>
readonly EXTERNAL_TAG=1.58.0-0.7.10

build_external_image() {
  local tag=$1
  [[ $tag == *-* ]] || die "External image tag '$tag' must be <redis_exporter>-<process-exporter>."
  build_image "external:$tag" external --build-arg "REDIS_EXPORTER_VERSION=${tag%-*}" \
    --build-arg "PROCESS_EXPORTER_VERSION=${tag#*-}"
}

build_pdpgsql_image() {
  has_image PDPGSQL "$1"
  build_image "pdpgsql:$1" pdpgsql --build-arg "PG_VERSION=$1"
}

build_ssl_pdpgsql_image() {
  has_image SSL_PDPGSQL "$1"
  build_image "ssl-pdpgsql:$1" ssl-pdpgsql --build-arg "PG_VERSION=$1"
}

build_pgsql_image() {
  has_image PGSQL "$1"
  build_image "pgsql:$1" pgsql --build-arg "PG_VERSION=$1"
}

# Stdout: the tags build-prebaked-images.yml publishes for ENGINE, one per line
image_tags() {
  local type version
  case $1 in
    ps | mysql | pgsql | pdpgsql | valkey) type=${1^^} ;;
    pxc-proxysql) type=PXC ;;
    ssl-pdpgsql) type=SSL_PDPGSQL ;;
    psmdb)
      for version in ${DB_VERSIONS[PSMDB]}; do
        printf '%s-ol8\n%s-ol9\n' "$version" "$version"
      done
      return
      ;;
    haproxy | kerberos) echo latest; return ;;
    external) echo "$EXTERNAL_TAG"; return ;;
    *) die "No prebaked image for '$1'." ;;
  esac
  tr ' ' '\n' <<<"${DB_VERSIONS[$type]}"
}

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

# Local copy, else pull, else build. PREBAKED_PULL=always pulls over a local
# copy, keeping it if the pull fails. The builder gets BUILD_ARGS, or TAG.
# Usage: ensure_image ENGINE TAG [BUILD_ARGS...]
ensure_image() {
  local engine=$1 tag=$2 published output local_copy=false
  shift 2
  (($# > 0)) || set -- "$tag"
  [[ $tag != 5.7 || $(uname -m) == x86_64 ]] || die "$engine 5.7 has no arm64 build; use 8.0 or newer."
  if docker image inspect "pmm-qa/$engine:$tag" >/dev/null 2>&1; then
    local_copy=true
    [[ ${PREBAKED_PULL:-} == always ]] || return 0
  fi
  if [[ -n $PREBAKED_REGISTRY ]]; then
    published=$PREBAKED_REGISTRY/$engine:$tag
    if output=$(timeout 600 docker pull --quiet "$published" 2>&1); then
      must docker tag "$published" "pmm-qa/$engine:$tag"
      return 0
    fi
    # Any failure lands here, not just a missing image, so say which.
    log_warn "Could not pull $published: ${output##*$'\n'}"
  fi
  [[ $local_copy == false ]] || return 0
  "build_${engine//-/_}_image" "$@"
}
