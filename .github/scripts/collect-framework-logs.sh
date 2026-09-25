#!/usr/bin/env bash
# collect-framework-logs.sh
#
# Copies the per-setup logs that `pmm-framework --parallel` keeps under
# ${TMPDIR:-/tmp}/pmm-framework-parallel.* into <dest_dir>, so a failed or
# cancelled job can upload them as an artifact. The framework removes that
# directory only when every setup succeeded, so after a failure or a timeout
# it is the only full record of what a setup was doing.
#
# Usage:
#   collect-framework-logs.sh <dest_dir> [VAR_NAME ...]
#
# Each VAR_NAME names an environment variable whose value is replaced with
# *** in the copies, raw and URL-encoded. GitHub masks secrets in the job log
# but not inside artifacts, and artifacts on this public repo are readable by
# anyone.
#
# Under GitHub Actions it also sets the step output `artifact_name`:
# framework-logs_<ARTIFACT_LABEL>_<mktemp suffix>. The suffix keeps the name
# unique when one reusable runner is called several times in a run.
set -euo pipefail

dest=${1:?usage: collect-framework-logs.sh <dest_dir> [VAR_NAME ...]}
shift

shopt -s nullglob
dirs=("${TMPDIR:-/tmp}"/pmm-framework-parallel.*)
if ((${#dirs[@]} == 0)); then
  echo "No pmm-framework parallel logs found; the setup either succeeded or never ran."
  exit 0
fi

mkdir -p "$dest"
suffixes=
for dir in "${dirs[@]}"; do
  cp -r "$dir" "$dest/"
  suffixes+=${suffixes:+-}${dir##*.}
done
chmod -R u+w "$dest"

# A copy that could not be fully redacted must never be uploaded, so the
# artifact name is only published once every file has been rewritten.
if ! python3 - "$dest" "$@" <<'EOF'; then
import os
import sys
from urllib.parse import quote

dest, names = sys.argv[1], sys.argv[2:]
secrets = set()
for name in names:
    value = os.environ.get(name, "")
    if value:
        secrets.update({value, quote(value, safe=""), quote(value)})
# Longest first, so a value never leaves a partially redacted longer form.
secrets = sorted(secrets, key=len, reverse=True)

count = 0
for root, _, files in os.walk(dest):
    for file_name in files:
        path = os.path.join(root, file_name)
        with open(path, encoding="utf-8", errors="surrogateescape") as f:
            text = f.read()
        for secret in secrets:
            text = text.replace(secret, "***")
        with open(path, "w", encoding="utf-8", errors="surrogateescape") as f:
            f.write(text)
        count += 1
print(f"Collected {count} pmm-framework log file(s) into {dest}")
EOF
  rm -rf -- "$dest"
  echo "Redaction failed; removed $dest so nothing unredacted is uploaded." >&2
  exit 1
fi

if [[ -n ${GITHUB_OUTPUT:-} ]]; then
  label=$(printf '%s' "${ARTIFACT_LABEL:-setup}" | tr -c 'A-Za-z0-9._-' '-')
  echo "artifact_name=framework-logs_${label}_${suffixes}" >>"$GITHUB_OUTPUT"
fi
