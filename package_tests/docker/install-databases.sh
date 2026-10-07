#!/usr/bin/env bash
# Installs the databases database-versions lists for this OS into a package_tests
# image, each from Percona's repository at the version and channel given there.
# Each database has an install_<name>.sh beside this script, defining an
# install_<name> function.
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
  installer="$(dirname "$0")/install_${database}.sh"
  if [ ! -f "$installer" ]; then
    echo "database-versions: there is no install_${database}.sh for ${database}" >&2
    exit 1
  fi
  # shellcheck source=/dev/null
  . "$installer"
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
