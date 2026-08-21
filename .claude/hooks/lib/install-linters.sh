#!/usr/bin/env bash
# Sourced by session-start.sh (eager) and lint-changed.sh (lazy). Every
# ensure_* is a no-op when the tool is already on PATH, so it is safe to call
# from a pre-commit gate on every commit.

ACTIONLINT_VERSION="1.7.7"
HADOLINT_VERSION="2.13.1"

_lint_apt_install() {
  sudo apt-get update -qq >/dev/null 2>&1 || return 1
  sudo apt-get install -y "$@" >/dev/null 2>&1
}

_lint_deb_arch() {
  dpkg --print-architecture 2>/dev/null || echo amd64
}

ensure_shellcheck() {
  command -v shellcheck >/dev/null 2>&1 && return 0
  _lint_apt_install shellcheck
}

ensure_yamllint() {
  command -v yamllint >/dev/null 2>&1 && return 0
  _lint_apt_install yamllint
}

ensure_ruff() {
  command -v ruff >/dev/null 2>&1 && return 0
  pipx install ruff >/dev/null 2>&1 || pip3 install --user --break-system-packages ruff >/dev/null 2>&1
}

ensure_actionlint() {
  command -v actionlint >/dev/null 2>&1 && return 0
  local arch tmp
  case "$(uname -m)" in
    x86_64) arch=amd64 ;;
    aarch64 | arm64) arch=arm64 ;;
    *) return 1 ;;
  esac
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/actionlint.tar.gz" \
    "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_linux_${arch}.tar.gz" \
    && tar -xzf "$tmp/actionlint.tar.gz" -C "$tmp" actionlint \
    && sudo install -m0755 "$tmp/actionlint" /usr/local/bin/actionlint
  local rc=$?
  rm -rf "$tmp"
  return $rc
}

ensure_hadolint() {
  command -v hadolint >/dev/null 2>&1 && return 0
  local arch tmp
  case "$(uname -m)" in
    x86_64) arch=x86_64 ;;
    aarch64 | arm64) arch=arm64 ;;
    *) return 1 ;;
  esac
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/hadolint" \
    "https://github.com/hadolint/hadolint/releases/download/v${HADOLINT_VERSION}/hadolint-Linux-${arch}" \
    && sudo install -m0755 "$tmp/hadolint" /usr/local/bin/hadolint
  local rc=$?
  rm -rf "$tmp"
  return $rc
}

ensure_npm_groovy_lint() {
  command -v npm-groovy-lint >/dev/null 2>&1 && return 0
  npm install -g npm-groovy-lint >/dev/null 2>&1
}

# Playwright workspaces carry their own eslint/tsc; install on first use only.
ensure_node_modules() {
  local dir="$1"
  [ -d "$dir/node_modules" ] && return 0
  (cd "$dir" && npm install >/dev/null 2>&1)
}

ensure_all_linters() {
  local rc=0
  for fn in ensure_shellcheck ensure_yamllint ensure_actionlint ensure_hadolint ensure_ruff; do
    "$fn" || {
      echo "warning: $fn failed" >&2
      rc=1
    }
  done
  return $rc
}
