#!/usr/bin/env bash
# Syntax-check migration shell scripts. Run after editing any .cursor/scripts/*.sh file.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for script in "$SCRIPT_DIR"/*.sh; do
  [[ -f "$script" ]] || continue
  if grep -q $'\r' "$script" 2>/dev/null; then
    echo "ERROR: CRLF line endings in $script (use LF only; see .gitattributes)" >&2
    exit 1
  fi
  bash -n "$script"
  echo "OK: $script"
done

echo "All migration scripts passed bash -n."
