#!/usr/bin/env bash
set -euo pipefail
shopt -s extglob

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

# Declared once, used once. Both shapes below reached a PR and drew a review comment; both are
# `SKILL.md` Port behaviour, simplify shape. Restricted to identifiers this file both declares and uses,
# so a symbol exported for another module is never flagged.
check_single_use_names() {
  local file=$1

  local is_test=0
  [[ $file == *.test.ts ]] && is_test=1

  awk -v file="$file" -v is_test="$is_test" '
    {
      line[NR] = $0

      # One linear pass: count every identifier, and note which ones are mapped. Counting by
      # re-scanning the whole file per declaration is quadratic and takes minutes on this suite.
      rest = $0
      while (match(rest, /[A-Za-z_][A-Za-z0-9_]*/)) {
        seen[substr(rest, RSTART, RLENGTH)]++
        rest = substr(rest, RSTART + RLENGTH)
      }
      if (match($0, /[A-Za-z_][A-Za-z0-9_]*[[:space:]]*\.[[:space:]]*map[[:space:]]*\(/)) {
        target = substr($0, RSTART, RLENGTH)
        sub(/[^A-Za-z0-9_].*$/, "", target)
        mapped[target] = 1
      }
    }
    END {
      for (n = 1; n <= NR; n++) {
        name = ""
        kind = ""
        # An exported symbol is another module`s to use, so it is out of scope for a single-file count.
        if (line[n] ~ /^export/) continue
        if (match(line[n], /^(interface|type)[[:space:]]+[A-Za-z_][A-Za-z0-9_]*/)) {
          kind = (line[n] ~ /^interface/) ? "interface" : "type alias"
          name = line[n]
          sub(/^(interface|type)[[:space:]]+/, "", name)
          sub(/[^A-Za-z0-9_].*$/, "", name)
        } else if (match(line[n], /^([[:space:]][[:space:]])?(const[[:space:]]+)?[A-Za-z_][A-Za-z0-9_]*[[:space:]]*(:[^=]*)?=[[:space:]]*\[/)) {
          # A class field is another module`s to use; only the mapped-once shape is judged here.
          kind = (line[n] ~ /^[[:space:]]/) ? "field array" : "const array"
          name = line[n]
          sub(/^[[:space:]]*(const[[:space:]]+)?/, "", name)
          sub(/[^A-Za-z0-9_].*$/, "", name)
        }
        if (name == "") continue

        uses = seen[name]
        if (uses <= 1 && kind != "field array") {
          printf "%s:%d: %s `%s` is declared and never used - delete it (SKILL.md Port behaviour, simplify shape)\n", file, n, kind, name > "/dev/stderr"
          failed = 1
        } else if (uses == 2 && kind ~ /array/ && mapped[name]) {
          printf "%s:%d: const array `%s` exists only to be mapped once - inline it (SKILL.md Port behaviour, simplify shape)\n", file, n, name > "/dev/stderr"
          failed = 1
        } else if (uses == 2 && is_test && kind != "const array") {
          printf "%s:%d: %s `%s` is referenced once - a data row needs no declared type, `as const` supplies the literal types (SKILL.md Port behaviour, simplify shape)\n", file, n, kind, name > "/dev/stderr"
          failed = 1
        }
      }
      exit failed
    }
  ' "$file" || failures=1
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

# Diff-scoped checks compare against this ref inside the repository that owns each file, so the
# final gate can run control's copy of this script against publish-worktree paths.
base=${MIGRATION_BASE:-origin/main}

repo_root() { git -C "$(dirname "$1")" rev-parse --show-toplevel; }

# Run git from the file's own directory with a bare basename: an absolute MSYS path as a pathspec
# matches nothing on Windows and the diff comes back empty, which reads exactly like a clean file.
added_lines() {
  local dir name
  dir=$(dirname "$1")
  name=$(basename "$1")
  if git -C "$dir" ls-files --error-unmatch "$name" >/dev/null 2>&1; then
    git -C "$dir" diff -U0 "$base" -- "$name" | grep '^+' | grep -v '^+++' | cut -c2- || true
  else
    cat "$1"
  fi
}

count_uses() {
  local dir
  dir=$(repo_root "$2")/e2e_tests
  if command -v rg >/dev/null 2>&1; then
    rg -c --glob '!**/node_modules/**' -- "$1" "$dir" 2>/dev/null | awk -F: '{ s += $NF } END { print s + 0 }'
  else
    grep -rEc --exclude-dir=node_modules -- "$1" "$dir" 2>/dev/null | awk -F: '{ s += $NF } END { print s + 0 }'
  fi
}

# Added lines only: 24 existing spec files carry comments a migration did not write.
check_test_comments() {
  added_lines "$1" | awk -v file="$1" '
    /^[[:space:]]*\/\/ eslint-disable-next-line playwright\/no-skipped-test -- / { next }
    /^[[:space:]]*\/\/ TODO: .*(PMM-[0-9]+|https?:\/\/)/ { next }
    /^[[:space:]]*(\/\/|\/\*|\*)/ || /[[:space:]]\/\/[[:space:]]/ {
      printf "%s: added comment in a migrated test file - delete it (SKILL.md Port behaviour, simplify shape): %s\n", file, $0 > "/dev/stderr"
      failed = 1
    }
    /from[[:space:]]+['"'"'"]\.\.?\// {
      printf "%s: added relative import - use the path aliases: %s\n", file, $0 > "/dev/stderr"
      failed = 1
    }
    END { exit failed }
  ' || failures=1
}

# Outside tests, an added comment that runs over two lines or explains a decision belongs in the PR body.
check_narrative_comments() {
  added_lines "$1" | awk -v file="$1" '
    /^[[:space:]]*(\/\/|#)/ {
      run++
      if (run == 2) { printf "%s: added multi-line comment narrates a decision - move it to the PR body: %s\n", file, $0 > "/dev/stderr"; failed = 1 }
      if ($0 ~ /(because|instead of|rather than|not needed|no need|we do not|we don.t|rejected|copied from|would break|otherwise|so that we)/) {
        printf "%s: added comment explains a decision - move it to the PR body: %s\n", file, $0 > "/dev/stderr"; failed = 1
      }
      next
    }
    { run = 0 }
    END { exit failed }
  ' || failures=1
}

# A method added to a POM, API client, component or helper with one call site across e2e_tests is inlined.
check_new_method_callers() {
  local file=$1 name callers
  while read -r name; do
    [[ -z $name || $name == constructor ]] && continue
    callers=$(count_uses "\.${name}\(" "$file")
    if ((callers <= 1)); then
      echo "$file: new method \`$name\` has $callers call site(s) across e2e_tests - inline it (SKILL.md Port behaviour, simplify shape)" >&2
      failures=1
    fi
  done < <(added_lines "$file" \
    | grep -E '^[[:space:]]{2}(public[[:space:]]+|private[[:space:]]+|protected[[:space:]]+|readonly[[:space:]]+)?(async[[:space:]]+)?[a-zA-Z_][A-Za-z0-9_]*[[:space:]]*(=[[:space:]]*async[[:space:]]*\(|=[[:space:]]*\([^)]*\)[[:space:]]*=>|\([^)]*\)[[:space:]]*(:[^{]*)?\{)' \
    | sed -E 's/^[[:space:]]*(public|private|protected|readonly)?[[:space:]]*(async)?[[:space:]]*//; s/[^A-Za-z0-9_].*$//' | sort -u)
}

# `expect` is already a step; a step wrapping one bare expect doubles the report entry and adds nothing.
check_single_expect_steps() {
  awk '
    /pmmTest[[:space:]]*\.[[:space:]]*step[[:space:]]*\(/ { start = NR; body = 0; next }
    start && NR == start + 1 && /^[[:space:]]*(await[[:space:]]+)?expect/ { body = 1; next }
    start && NR == start + 2 {
      if (body && $0 ~ /^[[:space:]]*\}\)?;?[[:space:]]*$/) {
        printf "%s:%d: pmmTest.step wraps a single expect - drop the step (audit-checklist.md Shape)\n", FILENAME, start > "/dev/stderr"; failed = 1
      }
      start = 0
    }
    END { exit failed }
  ' "$1" || failures=1
}

# Workflow edits: show what each added tag already selects and the nightly counter, so before/after is stated from data.
report_workflow_consumers() {
  local file=$1 tag
  while read -r tag; do
    echo "info: $file: added tag $tag is selected on $(grep -rc -- "$tag" .github/workflows | awk -F: '{ s += $NF } END { print s + 0 }') workflow line(s): $(grep -rl -- "$tag" .github/workflows | tr '\n' ' ')" >&2
  done < <(added_lines "$file" | grep -Eo '@[a-z][a-z0-9-]+' | sort -u)
  if [[ $file == *nightly-e2e-tests-matrix.yml ]]; then
    echo "info: expected_test_jobs is $(grep -Eo 'expected_test_jobs:[[:space:]]*[0-9]+' "$file" | grep -Eo '[0-9]+') and the file has $(grep -c -- '- tags_for_tests:' "$file") test-execution matrix entries" >&2
  fi
}

if ! git -C "$(dirname "$1")" rev-parse --verify -q "$base" >/dev/null 2>&1; then
  echo "error: base ref '$base' not found; fetch it or set MIGRATION_BASE, otherwise the diff-scoped checks would pass on nothing" >&2
  exit 2
fi

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
  if added_lines "$file" | grep -Eq 'waitForTimeout[[:space:]]*\('; then
    echo "$file: added fixed pause - use a web-first assertion or expect.poll (SKILL.md Port behaviour, simplify shape)" >&2
    failures=1
  fi
  if [[ $file == *.test.ts ]]; then
    if added_lines "$file" | grep -Eq '\.(getBy[A-Za-z]+|locator)[[:space:]]*\('; then
      echo "$file: raw locator in a test - make it a page-object property or builder (SKILL.md Port behaviour, simplify shape)" >&2
      failures=1
    fi
    if added_lines "$file" | grep -Eq 'new [A-Z][A-Za-z]*(Dashboard|Page)[[:space:]]*\('; then
      echo "$file: page object instantiated in a test - iterate through the fixture (SKILL.md Port behaviour, simplify shape)" >&2
      failures=1
    fi
    report_matches 'title: the data-row suffix is the one distinguishing value, not a JSON restatement' '\|[[:space:]]*\$?\{"' "$file"
    report_advisory 'title: prefer the one distinguishing value over JSON.stringify(row)' 'JSON[[:space:]]*\.[[:space:]]*stringify' "$file"
    report_advisory 'practices: a locator value awaited into a variable is asserted once and never retries - use a web-first matcher or expect.poll' '=[[:space:]]*await[^;]*\.(textContent|innerText|inputValue|getAttribute|allTextContents|allInnerTexts|isVisible|isHidden|count)[[:space:]]*\(' "$file"
    check_test_comments "$file"
    check_single_expect_steps "$file"
    check_single_use_names "$file"
    check_skip_policy "$file"
  elif [[ $file == *.github/workflows/* ]]; then
    check_narrative_comments "$file"
    report_workflow_consumers "$file"
  else
    report_advisory 'practices: generated CSS class in a locator breaks on the next Grafana bump - find a higher ladder rung' 'css-[a-z0-9]{4,}-|class\*=|-singleValue' "$file"
    check_narrative_comments "$file"
    check_single_use_names "$file"
    if [[ $file == *e2e_tests/@(pages|api|components|helpers)/* ]]; then
      check_new_method_callers "$file"
      if added_lines "$file" | grep -Eq '^[[:space:]]{2}private[[:space:]]'; then
        echo "advisory: $file: new private method - state the reason or fold it into its caller" >&2
      fi
      if added_lines "$file" | grep -Eq '\.waitFor[A-Za-z]*[[:space:]]*\('; then
        echo "advisory: $file: wait inside a page object - waits belong in the test" >&2
      fi
    fi
  fi
done

if ((failures)); then
  exit 1
fi

echo "Migration convention checks passed."
