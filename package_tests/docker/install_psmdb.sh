# shellcheck shell=bash disable=SC2154 # deb comes from install-databases.sh
# Sourced by install-databases.sh for each psmdb line in database-versions.
# Copied from the playbooks' PSMDB task and the install half of the
# install_setup_psmdb.yml it downloaded from Percona-QA/psmdb-testing: the same
# packages. The replica set setup stays in the playbook.
install_psmdb() {
  local version=$1 repository=$2
  case "$version" in
    6.0|7.0|8.0|8.3) ;;
    *) echo "psmdb ${version} is not supported; use 6.0, 7.0, 8.0 or 8.3" >&2; return 1 ;;
  esac
  percona-release enable-only "psmdb-${version/./}" "$repository"

  local packages=(
    percona-server-mongodb
    percona-server-mongodb-server
    percona-server-mongodb-mongos
    percona-server-mongodb-tools
    percona-mongodb-mongosh
  )
  if $deb; then
    apt-get update
    apt-get install -y "${packages[@]}"
  else
    dnf -y install "${packages[@]}"
  fi
  # The test scripts call mongo, which mongosh replaced in 6.0.
  ln -sf /usr/bin/mongosh /usr/bin/mongo
}
