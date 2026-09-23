#!/usr/bin/env bash
#
# lib/images.sh -- build the prebaked images the docker-backed setups run.
#
# The Dockerfiles are shared with the TypeScript provisioner under
# provisioning/images; only the choice of build args lives here.

PREBAKED_IMAGES_DIR=${PREBAKED_IMAGES_DIR:-$QA_INTEGRATION_ROOT/../provisioning/images}

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
    -t "pmm-qa/ps:$version" "$PREBAKED_IMAGES_DIR" ||
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
    -t "pmm-qa/mysql:$version" "$PREBAKED_IMAGES_DIR" ||
    die "Building pmm-qa/mysql:$version failed."
}

# Build pmm-qa/ENGINE:VERSION unless it is already present.
ensure_image() {
  local engine=$1 version=$2
  if ! docker image inspect "pmm-qa/$engine:$version" >/dev/null 2>&1; then
    "build_${engine}_image" "$version"
  fi
}
