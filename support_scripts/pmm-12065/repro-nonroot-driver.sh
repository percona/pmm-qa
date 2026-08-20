#!/usr/bin/env bash
# PMM-12065 driver: run the non-root binary-install reproduction as an unprivileged user.
set -u
PW="${1:?usage: repro-nonroot-driver.sh <pmm-admin-password> [version] [server]}"
VER="${2:-3.9.1}"
SRV="${3:-127.0.0.1:8443}"

id -u pmmtest >/dev/null 2>&1 || useradd -m -s /bin/bash pmmtest
# Reproduce the reporter's host state: /usr/local/percona exists and is root-owned
# (left behind by any earlier packaged pmm-client), so the failing mkdir names
# /usr/local/percona/pmm exactly as in the ticket.
install -d -o root -g root -m 0755 /usr/local/percona

install -m 0755 "$(dirname "$0")/repro-client-nonroot.sh" /home/pmmtest/repro-client-nonroot.sh
chown pmmtest:pmmtest /home/pmmtest/repro-client-nonroot.sh
runuser -u pmmtest -- env PMM_VERSION="$VER" PMM_SERVER="$SRV" PMM_PASSWORD="$PW" \
  bash /home/pmmtest/repro-client-nonroot.sh
