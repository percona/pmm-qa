#!/bin/bash
# Print the actions/cache key for the pmm-client packages a client_version
# installs, or nothing when it does not install from repo.percona.com.
#
# Moving channels (3-dev-latest, pmm3-rc, pmm3-latest) are resolved to the
# build they currently publish, so a key is reused until a new build lands and
# never serves yesterday's package for today's build.
#
# Usage: pmm-client-cache-key.sh <client_version> [codename]
# Stdout: "<component> <version> <key>" or nothing.
set -euo pipefail

CLIENT_VERSION=${1:?client_version required}
CODENAME=${2:-jammy}
BASE=http://repo.percona.com/pmm3-client/apt
ARCH=$(dpkg --print-architecture 2>/dev/null || echo amd64)

case $CLIENT_VERSION in
  3-dev-latest) component=experimental pin= ;;
  pmm3-rc) component=testing pin= ;;
  pmm3-latest) component=main pin= ;;
  3.[0-9]*.[0-9]*) component=main pin=$CLIENT_VERSION ;;
  *) exit 0 ;;
esac

# Dev builds republish the same Version, so the package checksum is what
# tells one nightly build from the next.
read -r version sha < <(curl -sS --fail --retry 3 --max-time 60 "$BASE/dists/$CODENAME/$component/binary-$ARCH/Packages" | awk -v pin="$pin" '
  /^Package: pmm-client$/ { inpkg=1; v=h=""; next }
  inpkg && /^Version: / { v=$2 }
  inpkg && /^SHA256: / { h=$2 }
  inpkg && /^$/ { if (v && h && (pin == "" || index(v, pin "-") == 1)) print v, h; inpkg=0 }
' | sort -V | tail -1) || true

[ -n "${sha:-}" ] || exit 0
printf '%s %s pmm-client-deb-%s-%s-%s\n' "$component" "$version" "$component" "${sha:0:16}" "$ARCH"
