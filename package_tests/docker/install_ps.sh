# shellcheck shell=bash disable=SC2154 # deb comes from install-databases.sh
# Sourced by install-databases.sh for each ps line in database-versions.
# Copied from the playbooks' Percona Server tasks: the same repository,
# packages and steps they installed it with.
install_ps() {
  local version=$1 repository=$2 product packages
  case "$version" in
    8.0) product=ps-80 ;;
    8.4) product=ps-84-lts ;;
    *) echo "ps ${version} is not supported; use 8.0 or 8.4" >&2; return 1 ;;
  esac
  percona-release enable-only "$product" "$repository"

  if $deb; then
    packages=(
      percona-server-server
      percona-server-test
      percona-server-dbg
      percona-server-source
      percona-server-client
      percona-server-rocksdb
      percona-mysql-router
    )
    if [ "$product" = ps-84-lts ]; then packages+=(percona-server-js); fi
    apt-get update
    apt-get install -y "${packages[@]}"
  else
    local rhel arch
    rhel=$(rpm -E %rhel)
    if [ "$rhel" -eq 8 ]; then
      dnf -y module disable mysql mariadb
    fi
    # 8.0's MyRocks needs gflags, which el9 only has in EPEL.
    if [ "$product" = ps-80 ] && [ "$rhel" -eq 9 ]; then
      arch=$(uname -m)
      dnf -y install --nogpgcheck "https://dl.fedoraproject.org/pub/epel/9/Everything/${arch}/Packages/g/gflags-2.2.2-9.el9.${arch}.rpm"
    fi
    packages=(
      percona-server-server
      percona-mysql-router
      percona-server-client
      percona-server-test
      percona-server-debuginfo
      percona-server-devel
      percona-server-rocksdb
    )
    if [ "$product" = ps-84-lts ]; then packages+=(percona-server-js); fi
    dnf -y install "${packages[@]}"
  fi
}
