# shellcheck shell=bash disable=SC2154 # deb comes from install-databases.sh
# Sourced by install-databases.sh for each valkey line in database-versions.
# Copied from the playbooks' Valkey task: the same repositories and packages.
install_valkey() {
  local version=$1 repository=$2 product
  case "$version" in
    9.1) product=valkey-91 ;;
    # el9's Valkey 8 came from the plain valkey repository.
    8) product=valkey ;;
    *) echo "valkey ${version} is not supported; use 8 or 9.1" >&2; return 1 ;;
  esac
  percona-release enable-only "$product" "$repository"

  if $deb; then
    apt-get update
    apt-get install -y percona-valkey-server percona-valkey-tools
  else
    dnf -y install valkey
  fi
}
