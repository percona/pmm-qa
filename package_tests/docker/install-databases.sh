#!/usr/bin/env bash
# Installs the databases database-versions lists for this OS into a package_tests
# image, each from Percona's repository at the version and channel given there.
# Each database has an install_<name> function below.
#
# With --list it installs nothing and prints them as <database>-<version>, the
# form the playbooks' enabled_db uses.
#
# Percona's repositories are removed again afterwards, so the playbooks start
# from the same repository state as before.
set -euo pipefail

# shellcheck source=/dev/null
. /etc/os-release
case "$ID" in
  ubuntu) os="ubuntu${VERSION_ID//./}" ;;
  *) os="${ID}${VERSION_ID%%.*}" ;;
esac

databases=$(awk -v os="$os" '$1 == os { print $2, $3, $4 }' "$(dirname "$0")/database-versions")

# An OS with no lines prints nothing: a host the images do not cover has no
# databases to expect.
if [ "${1:-}" = --list ]; then
  [ -z "$databases" ] || awk '{ print $1 "-" $2 }' <<< "$databases"
  exit 0
fi

if [ -z "$databases" ]; then
  echo "database-versions lists no databases for ${os}" >&2
  exit 1
fi

if command -v apt-get >/dev/null; then deb=true; else deb=false; fi

export PERCONA_TELEMETRY_URL=https://check-dev.percona.com/v1/telemetry/GenericReport

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

# Copied from the playbooks' PostgreSQL task and the install_ppg<version>.yml
# it included: the same repository, packages and steps.
install_pg() {
  local version=$1 repository=$2 packages
  case "$version" in
    14|15|16|17|18) ;;
    *) echo "pg ${version} is not supported; use 14 to 18" >&2; return 1 ;;
  esac
  percona-release enable-only "ppg-${version}" "$repository"

  if $deb; then
    packages=(
      percona-postgresql
      "percona-postgresql-${version}"
      percona-postgresql-all
      percona-postgresql-client
      "percona-postgresql-client-${version}"
      percona-postgresql-common
      percona-postgresql-contrib
      percona-postgresql-doc
      "percona-postgresql-doc-${version}"
      "percona-postgresql-plperl-${version}"
      "percona-postgresql-plpython3-${version}"
      "percona-postgresql-pltcl-${version}"
      "percona-postgresql-server-dev-${version}"
      percona-postgresql-server-dev-all
      "percona-postgresql-${version}-dbgsym"
      "percona-postgresql-client-${version}-dbgsym"
      "percona-postgresql-plperl-${version}-dbgsym"
      "percona-postgresql-plpython3-${version}-dbgsym"
      "percona-postgresql-pltcl-${version}-dbgsym"
      postgresql-client-common
      postgresql-common
    )
    apt-get update
    apt-get install -y "${packages[@]}"
  else
    local rhel
    rhel=$(rpm -E %rhel)
    # perl(IPC::Run) is in CodeReady Builder; the playbook ignored a failure here
    # too. el10 has it enabled in Dockerfile.rpm.
    if [ "$rhel" -eq 8 ] || [ "$rhel" -eq 9 ]; then
      { dnf config-manager --set-enabled "ol${rhel}_codeready_builder" && dnf -y install perl-IPC-Run; } || true
    fi
    if [ "$rhel" -eq 8 ]; then
      dnf -y module disable postgresql
    fi
    packages=(
      percona-postgresql-client-common
      percona-postgresql-common
      "percona-postgresql${version}"
      "percona-postgresql${version}-contrib"
      "percona-postgresql${version}-debuginfo"
      "percona-postgresql${version}-devel"
      "percona-postgresql${version}-docs"
      "percona-postgresql${version}-libs"
      "percona-postgresql${version}-llvmjit"
      "percona-postgresql${version}-plpython3"
      "percona-postgresql${version}-plperl"
      "percona-postgresql${version}-pltcl"
      "percona-postgresql${version}-server"
      "percona-postgresql${version}-test"
      "percona-postgresql${version}-contrib-debuginfo"
      "percona-postgresql${version}-debugsource"
      "percona-postgresql${version}-devel-debuginfo"
      "percona-postgresql${version}-libs-debuginfo"
      "percona-postgresql${version}-plperl-debuginfo"
      "percona-postgresql${version}-pltcl-debuginfo"
      "percona-postgresql${version}-plpython3-debuginfo"
      "percona-postgresql${version}-server-debuginfo"
    )
    # As in install_ppg<version>.yml: common-dev for 18, server-dev-all before.
    if [ "$version" -ge 18 ]; then
      packages+=(percona-postgresql-common-dev)
    else
      packages+=(percona-postgresql-server-dev-all)
    fi
    dnf -y install "${packages[@]}"
  fi
}

if $deb; then
  # With no systemd running, postinst would start the servers through their init
  # scripts, and the image would keep them killed mid-flight. Percona Server's
  # postinst still initializes its data directory, running mysqld itself, and
  # systemd starts the servers at boot.
  printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d
  chmod +x /usr/sbin/policy-rc.d
  wget -q -O /tmp/percona-release.deb https://repo.percona.com/apt/percona-release_latest.generic_all.deb
  apt-get update
  apt-get install -y /tmp/percona-release.deb
else
  dnf -y install --nogpgcheck https://repo.percona.com/yum/percona-release-latest.noarch.rpm
fi

while read -r database version repository; do
  if [ -z "$repository" ]; then
    echo "database-versions: ${os} ${database} needs a version and a repository" >&2
    exit 1
  fi
  if ! declare -F "install_${database}" >/dev/null; then
    echo "database-versions: install-databases.sh has no install_${database}" >&2
    exit 1
  fi
  echo "Installing ${database} ${version} from ${repository} for ${os}"
  # stdin is the list being read; a package manager must not consume it.
  "install_${database}" "$version" "$repository" < /dev/null
done <<< "$databases"

if $deb; then
  apt-get purge -y percona-release
  rm -f /etc/apt/sources.list.d/percona-*.list /usr/sbin/policy-rc.d /tmp/percona-release.deb
  rm -rf /var/lib/apt/lists/*
else
  dnf -y remove percona-release
  rm -f /etc/yum.repos.d/percona-*.repo
  dnf clean all
  rm -rf /var/cache/dnf
fi
