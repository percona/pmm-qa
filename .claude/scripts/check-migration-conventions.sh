#!/usr/bin/env bash
set -euo pipefail

if (($# == 0)); then
  echo "Usage: $0 <changed-migration-file> [...]" >&2
  exit 2
fi

failures=0

report_matches() {
  local label=$1
  local pattern=$2
  local file=$3
  local matches

  matches=$(rg -n --with-filename --pcre2 "$pattern" -- "$file" || true)
  if [[ -n $matches ]]; then
    printf '%s\n' "$matches" | sed "s#^#$label: #" >&2
    failures=1
  fi
}

check_skip_policy() {
  local file=$1

  awk '
    /pmmTest[[:space:]]*\.[[:space:]]*skip[[:space:]]*\(/ {
      if (previous2 !~ /^[[:space:]]*\/\/ TODO: .+/ || previous1 !~ /^[[:space:]]*\/\/ eslint-disable-next-line playwright\/no-skipped-test -- .+/) {
        printf "%s:%d: pmmTest.skip requires the TODO and eslint-disable-next-line comments from mappings.md Skip policy\n", FILENAME, FNR > "/dev/stderr"
        failed = 1
      }
    }
    { previous2 = previous1; previous1 = $0 }
    END { exit failed }
  ' "$file" || failures=1
}

for file in "$@"; do
  if [[ ! -f $file ]]; then
    echo "$file: changed migration file not found" >&2
    failures=1
    continue
  fi

  report_matches 'SafeOmission requires parseInt(versionPart)' 'parseInt[[:space:]]*\([^,()]+,[[:space:]]*10[[:space:]]*\)' "$file"
  if [[ $file == */e2e_tests/helpers/* || $file == e2e_tests/helpers/* ]]; then
    report_matches 'helpers must not hide expect()' 'expect[[:space:]]*\(' "$file"
  fi
  check_skip_policy "$file"
done

if ((failures)); then
  exit 1
fi

echo "Migration convention checks passed."
