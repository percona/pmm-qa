#!/usr/bin/env bash
# Dispatches the repo's linters over a list of files, one linter per file kind.
# Shared by the PreToolUse commit gate and .github/workflows/lint.yml so both
# enforce exactly the same commands.
#
# Usage: lint-changed.sh <file> [<file>...]
# Paths may be absolute or relative to the repo root. Exits non-zero on the
# first failing linter group; every group still runs so one commit reports all
# of its problems.
set -uo pipefail

# $0 -- not CLAUDE_PROJECT_DIR: in a multi-repo cloud session that variable
# points at the parent of the clones, not at pmm-qa.
QA_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=.claude/hooks/lib/install-linters.sh
. "$QA_ROOT/.claude/hooks/lib/install-linters.sh"

cd "$QA_ROOT" || exit 1

rc=0
fail() {
  echo "  FAIL: $1" >&2
  rc=1
}

# Normalise to repo-relative paths and drop anything already deleted.
files=()
for arg in "$@"; do
  case "$arg" in
    "$QA_ROOT"/*) arg="${arg#"$QA_ROOT"/}" ;;
  esac
  [ -f "$arg" ] && files+=("$arg")
done
[ ${#files[@]} -eq 0 ] && exit 0

select_files() {
  local pattern="$1" f
  for f in "${files[@]}"; do
    printf '%s\n' "$f" | grep -qE "$pattern" && printf '%s\n' "$f"
  done
}

mapfile -t ts_files < <(select_files '\.ts$')
mapfile -t yaml_files < <(select_files '\.ya?ml$')
mapfile -t workflow_files < <(select_files '^\.github/workflows/.*\.ya?ml$')
mapfile -t sh_files < <(select_files '\.sh$')
mapfile -t py_files < <(select_files '\.py$')
mapfile -t tf_files < <(select_files '\.tf$')
mapfile -t docker_files < <(select_files '(^|/)Dockerfile[^/]*$')
mapfile -t compose_files < <(select_files '(^|/)(docker-)?compose[^/]*\.ya?ml$')
mapfile -t groovy_files < <(select_files '\.groovy$')

# TypeScript: each Playwright workspace owns its eslint + tsconfig, so lint the
# whole workspace rather than the individual files.
if [ ${#ts_files[@]} -gt 0 ]; then
  workspaces=$(printf '%s\n' "${ts_files[@]}" | cut -d/ -f1 | sort -u)
  for ws in $workspaces; do
    [ -f "$ws/package.json" ] || continue
    grep -q '"lint"' "$ws/package.json" || continue
    echo "==> npm run lint ($ws)"
    ensure_node_modules "$QA_ROOT/$ws" || fail "npm install in $ws"
    (cd "$ws" && npm run --silent lint) || fail "eslint/tsc in $ws"
  done
fi

if [ ${#yaml_files[@]} -gt 0 ]; then
  echo "==> yamllint"
  ensure_yamllint || fail "yamllint not installed"
  yamllint --strict "${yaml_files[@]}" || fail "yamllint"
fi

if [ ${#workflow_files[@]} -gt 0 ]; then
  echo "==> actionlint"
  ensure_actionlint || fail "actionlint not installed"
  actionlint "${workflow_files[@]}" || fail "actionlint"
fi

if [ ${#sh_files[@]} -gt 0 ]; then
  echo "==> shellcheck"
  ensure_shellcheck || fail "shellcheck not installed"
  shellcheck -S warning "${sh_files[@]}" || fail "shellcheck"
fi

if [ ${#py_files[@]} -gt 0 ]; then
  echo "==> ruff"
  ensure_ruff || fail "ruff not installed"
  ruff check "${py_files[@]}" || fail "ruff"
fi

if [ ${#tf_files[@]} -gt 0 ]; then
  echo "==> terraform fmt"
  if command -v terraform >/dev/null 2>&1; then
    for dir in $(printf '%s\n' "${tf_files[@]}" | xargs -n1 dirname | sort -u); do
      terraform fmt -check -recursive "$dir" || fail "terraform fmt: $dir"
    done
  else
    fail "terraform not installed"
  fi
fi

if [ ${#docker_files[@]} -gt 0 ]; then
  echo "==> hadolint"
  ensure_hadolint || fail "hadolint not installed"
  hadolint --failure-threshold error "${docker_files[@]}" || fail "hadolint"
fi

if [ ${#compose_files[@]} -gt 0 ]; then
  echo "==> docker compose config"
  if docker compose version >/dev/null 2>&1; then
    for f in "${compose_files[@]}"; do
      (cd "$(dirname "$f")" && docker compose -f "$(basename "$f")" config -q) || fail "docker compose config: $f"
    done
  else
    echo "  skipped: docker compose unavailable" >&2
  fi
fi

if [ ${#groovy_files[@]} -gt 0 ]; then
  echo "==> npm-groovy-lint"
  ensure_npm_groovy_lint || fail "npm-groovy-lint not installed"
  npm-groovy-lint --failon error --files "$(printf '%s,' "${groovy_files[@]}" | sed 's/,$//')" || fail "npm-groovy-lint"
fi

exit $rc
