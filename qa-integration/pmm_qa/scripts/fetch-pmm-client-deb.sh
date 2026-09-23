#!/bin/bash
# Fetch one verified pmm-client .deb into a host-side cache shared by every
# container, instead of each container downloading the same 180 MB itself.
#
# repo.percona.com publishes the index and the pool file non-atomically: measured
# over 3.5h on a dedicated VM, they disagree ~5% of the time in windows of 6m38s,
# 7m32s and 7m48s, and apt refuses the package for the whole window ("File has
# unexpected size (180478124 != 180478168). Mirror sync in progress?"). Checking
# agreement with a HEAD costs ~6 kB, so waiting beats downloading into a window.
#
# Usage: fetch-pmm-client-deb.sh <component> <codename> [cache_dir] [budget_seconds] [version]
#   COMPONENT is the apt *index* component (main|testing|experimental). GA
#   packages live under main; percona-release calls that same channel "release",
#   and dists/<codename>/release/ does not exist.
#   VERSION pins an exact upstream version (3.9.1); empty takes the highest.
# Stdout: the path of the verified .deb (nothing else — callers capture it)
# Exit: 3 when the index does not publish that package, 1 on any other failure
set -euo pipefail

COMPONENT=${1:?index component (main|testing|experimental) required}
CODENAME=${2:?distro codename (noble|jammy|…) required}
CACHE_DIR=${3:-/tmp/pmm-client-cache}
BUDGET=${4:-1800}
VERSION=${5:-}

BASE=http://repo.percona.com/pmm3-client/apt
ARCH=$(dpkg --print-architecture 2>/dev/null || echo amd64)
DEST_DIR=$CACHE_DIR/$COMPONENT/$CODENAME/$ARCH/${VERSION:-latest}
DEB=$DEST_DIR/pmm-client.deb
LOCK=$CACHE_DIR/.lock-$COMPONENT-$CODENAME-$ARCH-${VERSION:-latest}

mkdir -p "$DEST_DIR" "$CACHE_DIR"

log() { printf '[fetch-pmm-client-deb] %s\n' "$*" >&2; }

resolve_from_index() { # -> "version size sha256 filename", empty on failure
  local pkgs
  pkgs=$(curl -sS --max-time 60 "$BASE/dists/$CODENAME/$COMPONENT/binary-$ARCH/Packages") || return 1
  printf '%s\n' "$pkgs" | awk -v pin="$VERSION" '
    /^Package: pmm-client$/ { inpkg=1; v=s=h=f=""; next }
    inpkg && /^Version: /   { v=$2 }
    inpkg && /^Size: /      { s=$2 }
    inpkg && /^SHA256: /    { h=$2 }
    inpkg && /^Filename: /  { f=$2 }
    inpkg && /^$/           { emit(); inpkg=0 }
    END                     { if (inpkg) emit() }
    function emit() {
      if (!(v && s && h && f)) return
      if (pin != "" && index(v, pin "-") != 1) return
      print v, s, h, f
    }
  ' | sort -rV | head -1
}

served_size() { curl -sSI --max-time 60 "$BASE/$1" | awk 'tolower($1)=="content-length:"{print $2}' | tr -d '\r'; }

fetch_verified() {
  local deadline=$(( $(date +%s) + BUDGET )) attempt=0 no_index_streak=0
  local version size sha file served reason=unknown
  while :; do
    attempt=$((attempt + 1))
    read -r version size sha file < <(resolve_from_index) || true
    if [ -z "${file:-}" ]; then
      reason='no-index'
      no_index_streak=$((no_index_streak + 1))
      log "no pmm-client${VERSION:+ $VERSION} in the $CODENAME/$COMPONENT index (attempt $attempt)"
      if [ "$no_index_streak" -ge 4 ]; then
        deadline=0
      fi
    else
      no_index_streak=0
      served=$(served_size "$file" || true)
      if [ "${served:-}" = "$size" ]; then
        if curl -sS --fail -C - \
          --connect-timeout 30 --speed-limit 51200 --speed-time 120 \
          --max-time "$(( deadline - $(date +%s) ))" \
          -o "$DEB.part" "$BASE/$file"; then
          if echo "$sha  $DEB.part" | sha256sum -c --quiet -; then
            mv "$DEB.part" "$DEB"
            printf '%s\n' "$version" >"$DEST_DIR/version"
            printf '%s\n' "$sha" >"$DEST_DIR/sha256"
            log "cached pmm-client $version ($size bytes) for $CODENAME/$COMPONENT"
            return 0
          fi
          reason='sha-mismatch'
          log "sha256 mismatch after download — the repository changed mid-fetch (attempt $attempt)"
          rm -f "$DEB.part"
        else
          reason='download-failed'
          log "download interrupted at $(stat -c%s "$DEB.part" 2>/dev/null || echo 0)/$size bytes (attempt $attempt)"
        fi
      else
        reason=inconsistent
        log "repository inconsistent: index says $size, server serves ${served:-<none>} (attempt $attempt)"
      fi
    fi

    if [ "$(date +%s)" -ge "$deadline" ]; then
      {
        printf '[fetch-pmm-client-deb] giving up after %ss (last failure: %s).\n\n' "$BUDGET" "$reason"
        case $reason in
          inconsistent | sha-mismatch)
            cat <<'EOF'
  repo.percona.com is serving an index and a payload that disagree, so apt
  cannot install pmm-client. This is an upstream publishing race, not a problem
  with this host or this playbook. Observed windows last 6-8 minutes.
EOF
            ;;
          no-index)
            cat <<EOF
  Could not read pmm-client${VERSION:+ $VERSION} out of the $CODENAME/$COMPONENT
  index. Check that the codename, component and version exist and that the
  repository is reachable — this is not the publishing race.
EOF
            ;;
          *)
            echo "  The package could not be downloaded. See the attempts above."
            ;;
        esac
        printf '\n    url          %s\n' "$BASE/${file:-<unresolved>}"
        printf '    index size   %s\n' "${size:-<unknown>}"
        printf '    served size  %s\n' "${served:-<unknown>}"
        printf '    index sha256 %s\n' "${sha:-<unknown>}"
      } >&2
      # 3 tells callers the package is not published here, not that fetching failed.
      [ "$reason" = no-index ] && return 3
      return 1
    fi
    sleep 15
  done
}

# Several database specs provision in parallel on one host and share this cache,
# so the check-and-fetch has to be one critical section or they race on .part.
exec 9>"$LOCK"
flock 9
# Dev and RC channels republish in place, so a cached package is reused only
# while the index still names it; an unreachable index keeps the cached one.
if [ -s "$DEB" ]; then
  read -r _ _ current_sha _ < <(resolve_from_index) || true
  if [ -n "${current_sha:-}" ] && [ "$current_sha" != "$(cat "$DEST_DIR/sha256" 2>/dev/null)" ]; then
    log "cached pmm-client is no longer the one $CODENAME/$COMPONENT publishes; refetching"
    rm -f "$DEB"
  fi
fi
if [ -s "$DEB" ]; then
  log "reusing cached pmm-client $(cat "$DEST_DIR/version" 2>/dev/null || echo '?') for $CODENAME/$COMPONENT"
else
  fetch_verified
fi
printf '%s\n' "$DEB"
