#!/bin/bash
# The RHEL-family counterpart of fetch-pmm-client-deb.sh: fetch one verified
# pmm-client .rpm into a host-side cache shared by every container.
#
# Usage: fetch-pmm-client-rpm.sh <component> <el_major> [arch] [cache_dir] [budget_seconds] [version]
#   COMPONENT is the yum channel (release|testing|experimental).
#   VERSION pins an exact upstream version (3.9.1); empty takes the highest.
# Stdout: the path of the verified .rpm (nothing else — callers capture it)
set -euo pipefail

COMPONENT=${1:?yum channel (release|testing|experimental) required}
EL=${2:?el major version (8|9|10) required}
ARCH=${3:-$(uname -m)}
CACHE_DIR=${4:-/tmp/pmm-client-cache}
BUDGET=${5:-900}
VERSION=${6:-}

BASE=https://repo.percona.com/pmm3-client/yum/$COMPONENT/$EL/RPMS/$ARCH
DEST_DIR=$CACHE_DIR/rpm/$COMPONENT/el$EL/$ARCH/${VERSION:-latest}
RPM=$DEST_DIR/pmm-client.rpm
LOCK=$CACHE_DIR/.lock-rpm-$COMPONENT-el$EL-$ARCH-${VERSION:-latest}

mkdir -p "$DEST_DIR" "$CACHE_DIR"

log() { printf '[fetch-pmm-client-rpm] %s\n' "$*" >&2; }

resolve_from_index() { # -> "version sha256 href", empty on failure
  local primary
  primary=$(curl -sS --fail --max-time 60 "$BASE/repodata/repomd.xml" | grep -o 'href="repodata/[^"]*-primary\.xml\.gz"' | cut -d'"' -f2) || return 1
  [ -n "$primary" ] || return 1
  curl -sS --fail --max-time 120 "$BASE/$primary" | gunzip | python3 -c '
import sys, xml.etree.ElementTree as ET
pin = sys.argv[1]
ns = {"c": "http://linux.duke.edu/metadata/common"}
best = None
for p in ET.parse(sys.stdin).getroot().findall("c:package", ns):
    if p.find("c:name", ns).text != "pmm-client":
        continue
    v = p.find("c:version", ns).attrib
    if pin and v["ver"] != pin:
        continue
    c = p.find("c:checksum", ns)
    if c.attrib.get("type") != "sha256":
        continue
    key = tuple(int(x) if x.isdigit() else 0 for x in (v["ver"] + "." + v["rel"].split(".")[0]).split("."))
    if best is None or key > best[0]:
        best = (key, v["ver"] + "-" + v["rel"], c.text, p.find("c:location", ns).attrib["href"])
if best:
    print(best[1], best[2], best[3])
' "$VERSION"
}

fetch_verified() {
  local deadline=$(( $(date +%s) + BUDGET )) attempt=0 version sha href
  while :; do
    attempt=$((attempt + 1))
    read -r version sha href < <(resolve_from_index) || true
    if [ -n "${href:-}" ]; then
      if curl -sS --fail -C - --connect-timeout 30 --speed-limit 51200 --speed-time 120 \
        --max-time "$(( deadline - $(date +%s) ))" -o "$RPM.part" "$BASE/$href"; then
        if echo "$sha  $RPM.part" | sha256sum -c --quiet -; then
          mv "$RPM.part" "$RPM"
          printf '%s\n' "$version" >"$DEST_DIR/version"
          printf '%s\n' "$sha" >"$DEST_DIR/sha256"
          log "cached pmm-client $version for el$EL/$COMPONENT/$ARCH"
          return 0
        fi
        log "sha256 mismatch after download — the repository changed mid-fetch (attempt $attempt)"
        rm -f "$RPM.part"
      else
        log "download interrupted (attempt $attempt)"
      fi
    else
      log "no pmm-client${VERSION:+ $VERSION} in the el$EL/$COMPONENT/$ARCH index (attempt $attempt)"
    fi
    if [ "$(date +%s)" -ge "$deadline" ] || { [ -z "${href:-}" ] && [ "$attempt" -ge 4 ]; }; then
      log "giving up after $attempt attempts: $BASE/${href:-<unresolved>}"
      return 1
    fi
    sleep 15
  done
}

exec 9>"$LOCK"
flock 9
# Dev and RC channels republish in place, so a cached package is reused only
# while the index still names it; an unreachable index keeps the cached one.
if [ -s "$RPM" ]; then
  read -r _ current_sha _ < <(resolve_from_index) || true
  if [ -n "${current_sha:-}" ] && [ "$current_sha" != "$(cat "$DEST_DIR/sha256" 2>/dev/null)" ]; then
    log "cached pmm-client is no longer the one el$EL/$COMPONENT publishes; refetching"
    rm -f "$RPM"
  fi
fi
if [ -s "$RPM" ]; then
  log "reusing cached pmm-client $(cat "$DEST_DIR/version" 2>/dev/null || echo '?') for el$EL/$COMPONENT/$ARCH"
else
  fetch_verified
fi
printf '%s\n' "$RPM"
