#!/usr/bin/env bash
# Installs Percona Server for MySQL into a package_tests image, at the version
# percona-server-versions sets for this OS, with the repository, packages and
# steps the playbooks used to install it with. The playbooks now only start it
# and add it to PMM (package_tests/tasks/add_percona_server_to_pmm.yml).
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

entry=$(awk -v os="$os" '$1 == os { print $2, $3 }' "$(dirname "$0")/percona-server-versions")
version=${entry% *}
repository=${entry#* }
if [ -z "$version" ] || [ -z "$repository" ]; then
  echo "percona-server-versions has no version and repository for ${os}" >&2
  exit 1
fi

case "$version" in
  8.0) product=ps-80 ;;
  8.4) product=ps-84-lts ;;
  *) echo "Percona Server ${version} for ${os} is not supported; use 8.0 or 8.4" >&2; exit 1 ;;
esac
echo "Installing Percona Server ${version} (${product} ${repository}) for ${os}"

export PERCONA_TELEMETRY_URL=https://check-dev.percona.com/v1/telemetry/GenericReport

if command -v apt-get >/dev/null; then
  # With no systemd running, postinst would start mysqld and mysqlrouter through
  # their init scripts, and the image would keep servers killed mid-flight.
  # postinst still initializes the data directory, running mysqld itself, and
  # systemd starts both at boot.
  printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d
  chmod +x /usr/sbin/policy-rc.d

  wget -q -O /tmp/percona-release.deb https://repo.percona.com/apt/percona-release_latest.generic_all.deb
  apt-get update
  apt-get install -y /tmp/percona-release.deb
  percona-release enable-only "$product" "$repository"
  apt-get update

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
  apt-get install -y "${packages[@]}"

  apt-get purge -y percona-release
  rm -f /etc/apt/sources.list.d/percona-*.list /usr/sbin/policy-rc.d /tmp/percona-release.deb
  rm -rf /var/lib/apt/lists/*
else
  dnf -y install --nogpgcheck https://repo.percona.com/yum/percona-release-latest.noarch.rpm
  percona-release enable-only "$product" "$repository"

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

  dnf -y remove percona-release
  rm -f /etc/yum.repos.d/percona-*.repo
  dnf clean all
  rm -rf /var/cache/dnf
fi
