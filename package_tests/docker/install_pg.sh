# shellcheck shell=bash disable=SC2154 # deb comes from install-databases.sh
# Sourced by install-databases.sh for each pg line in database-versions.
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
