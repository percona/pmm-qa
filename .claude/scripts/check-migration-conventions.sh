#!/usr/bin/env bash
set -euo pipefail

if (($# == 0)); then
  echo "Usage: $0 <changed-migration-file> [...]" >&2
  exit 2
fi

failures=0

# Patterns below are POSIX ERE. Prefer ripgrep, fall back to grep -E, and refuse to run rather
# than report a pass that checked nothing: a missing matcher used to exit 0 through `|| true`.
if command -v rg >/dev/null 2>&1; then
  search() { rg -n --with-filename "$1" -- "$2"; }
elif echo | grep -Eq '[[:space:]]*' 2>/dev/null; then
  search() { grep -En --with-filename -- "$1" "$2"; }
else
  echo "error: neither rg nor a working grep -E is available; cannot check conventions" >&2
  exit 2
fi

report_matches() {
  local label=$1
  local pattern=$2
  local file=$3
  local matches

  matches=$(search "$pattern" "$file" || true)
  if [[ -n $matches ]]; then
    printf '%s\n' "$matches" | sed "s#^#$label: #" >&2
    failures=1
  fi
}

# Reported but not fatal: the pattern is discouraged rather than banned, and predates this check
# in enough places that failing on it would block migrations over lines they did not write.
report_advisory() {
  local label=$1
  local pattern=$2
  local file=$3
  local matches

  matches=$(search "$pattern" "$file" || true)
  if [[ -n $matches ]]; then
    printf '%s\n' "$matches" | sed "s#^#advisory: $label: #" >&2
  fi
}

# Two call shapes, two rules. The unconditional `pmmTest.skip('<title>', fn)` is a migrated
# xScenario and carries a TODO naming the ticket that would reactivate it. The conditional
# `pmmTest.skip(<condition>, '<reason>')` has no ticket to name, so demanding a TODO there only
# produces invented filler. Classify by the first argument: a string literal means unconditional.
check_skip_policy() {
  local file=$1

  awk '
    { line[NR] = $0 }
    END {
      for (n = 1; n <= NR; n++) {
        if (line[n] !~ /pmmTest[[:space:]]*\.[[:space:]]*skip[[:space:]]*\(/) continue

        first = line[n]
        sub(/.*pmmTest[[:space:]]*\.[[:space:]]*skip[[:space:]]*\(/, "", first)
        if (first ~ /^[[:space:]]*$/ && n < NR) first = line[n + 1]
        sub(/^[[:space:]]+/, "", first)

        if (first !~ /^["'"'"'`]/) continue

        if (line[n - 1] !~ /^[[:space:]]*\/\/ eslint-disable-next-line playwright\/no-skipped-test -- .+/) {
          printf "%s:%d: unconditional pmmTest.skip requires the eslint-disable-next-line comment from mappings.md Skip policy\n", FILENAME, n > "/dev/stderr"
          failed = 1
        }
        if (line[n - 2] !~ /^[[:space:]]*\/\/ TODO: .+/) {
          printf "%s:%d: unconditional pmmTest.skip requires a TODO naming the reactivation condition (mappings.md Skip policy)\n", FILENAME, n > "/dev/stderr"
          failed = 1
        } else if (line[n - 2] !~ /(PMM-[0-9]+|https?:\/\/)/) {
          printf "%s:%d: the TODO above pmmTest.skip must reference a ticket (PMM-nnn or a URL), not free text\n", FILENAME, n > "/dev/stderr"
          failed = 1
        }
      }
      exit failed
    }
  ' "$file" || failures=1
}

for file in "$@"; do
  if [[ ! -f $file ]]; then
    echo "$file: changed migration file not found" >&2
    failures=1
    continue
  fi

  report_matches 'SafeOmission requires parseInt(versionPart)' 'parseInt[[:space:]]*\([^,()]+,[[:space:]]*10[[:space:]]*\)' "$file"
  report_matches 'practices: use toHaveCSS instead of getComputedStyle' 'getComputedStyle' "$file"
  report_advisory 'practices: prefer narrowing the locator over nth/first/last' '\.(nth[[:space:]]*\(|first[[:space:]]*\(\)|last[[:space:]]*\(\))' "$file"
  report_matches 'practices: use a web-first assertion, not a manual predicate' 'expect[[:space:]]*\([[:space:]]*await[^)]*\.(isVisible|isHidden|isEnabled|isDisabled|isChecked|count)[[:space:]]*\(' "$file"
  report_matches 'practices: page.accessibility was removed in Playwright 1.57' 'page[[:space:]]*\.[[:space:]]*accessibility' "$file"
  report_matches 'practices: backgroundPages() is deprecated' 'backgroundPages[[:space:]]*\(' "$file"
  if [[ $file == */e2e_tests/helpers/* || $file == e2e_tests/helpers/* ]]; then
    report_matches 'helpers must not hide expect()' 'expect[[:space:]]*\(' "$file"
  fi
  check_skip_policy "$file"
done

if ((failures)); then
  exit 1
fi

echo "Migration convention checks passed."
