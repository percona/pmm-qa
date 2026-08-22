#!/usr/bin/env bash
# Sourced by session-start.sh (eager) and lint-changed.sh (lazy). Each ensure_*
# is a no-op once the pinned version is present, so it is safe to call from a
# pre-commit gate on every commit.

ACTIONLINT_VERSION="1.7.7"
HADOLINT_VERSION="2.13.1"
RUFF_VERSION="0.15.8"
NPM_GROOVY_LINT_VERSION="15.2.0"

# Refuse to install a downloaded binary whose sha256 is not the one recorded
# beside its version below. A pinned tag is not enough on its own: a release
# asset can be replaced, and these land in /usr/local/bin with sudo. Checksums
# come from the publishers' own files -- actionlint_${V}_checksums.txt and
# hadolint-Linux-${arch}.sha256.
_lint_verify_sha256() {
  local file="$1" want="$2" got
  [ -n "$want" ] || { echo "no checksum recorded for $file" >&2; return 1; }
  got=$(sha256sum "$file" 2>/dev/null | cut -d" " -f1)
  [ "$got" = "$want" ] && return 0
  echo "checksum mismatch for $file: expected $want, got ${got:-none}" >&2
  return 1
}

# A pin only holds if the binary actually on PATH is the pinned one. `command
# -v` alone let any build decide the findings, which is how CI and a local
# session came to disagree about ruff. Returns 0 when $1 --version reports $2.
_lint_version_is() {
  local bin="$1" want="$2" got
  command -v "$bin" >/dev/null 2>&1 || return 1
  got=$("$bin" --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1)
  [ "$got" = "$want" ]
}

# Called when the wrong version is already installed and the pinned one could
# not be fetched. Warns and accepts what is there: a hard failure would make the
# commit gate unusable on a machine without sudo or network, and a gate that
# runs with a near-miss version is worth more than one that refuses to run.
_lint_version_fallback() {
  local bin="$1" want="$2"
  echo "warning: $bin is not the pinned $want and the pinned build could not be installed; using $(command -v "$bin")" >&2
  command -v "$bin" >/dev/null 2>&1
}

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
  _lint_version_is ruff "$RUFF_VERSION" && return 0
  pipx install --force "ruff==${RUFF_VERSION}" >/dev/null 2>&1 \
    || pip3 install --user --break-system-packages "ruff==${RUFF_VERSION}" >/dev/null 2>&1
  _lint_version_is ruff "$RUFF_VERSION" || _lint_version_fallback ruff "$RUFF_VERSION"
}

ensure_actionlint() {
  _lint_version_is actionlint "$ACTIONLINT_VERSION" && return 0
  local arch tmp sha
  case "$(uname -m)" in
    x86_64) arch=amd64 sha=023070a287cd8cccd71515fedc843f1985bf96c436b7effaecce67290e7e0757 ;;
    aarch64 | arm64) arch=arm64 sha=401942f9c24ed71e4fe71b76c7d638f66d8633575c4016efd2977ce7c28317d0 ;;
    *) return 1 ;;
  esac
  tmp="$(mktemp -d)"
  curl -fsSL --connect-timeout 10 --max-time 120 -o "$tmp/actionlint.tar.gz" \
    "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_linux_${arch}.tar.gz" \
    && _lint_verify_sha256 "$tmp/actionlint.tar.gz" "$sha" \
    && tar -xzf "$tmp/actionlint.tar.gz" -C "$tmp" actionlint \
    && sudo install -m0755 "$tmp/actionlint" /usr/local/bin/actionlint
  local rc=$?
  rm -rf "$tmp"
  [ $rc -eq 0 ] && return 0
  _lint_version_fallback actionlint "$ACTIONLINT_VERSION"
}

ensure_hadolint() {
  _lint_version_is hadolint "$HADOLINT_VERSION" && return 0
  local arch tmp sha
  case "$(uname -m)" in
    x86_64) arch=x86_64 sha=f8b05e4c724cdeb84c0dca07e40936c3d875c0af5d120a27c94026a0f370b2cf ;;
    aarch64 | arm64) arch=arm64 sha=ca77a6010454826ab90335095add1b9b84f2d72d44581b6c2dbe08cec46b0165 ;;
    *) return 1 ;;
  esac
  tmp="$(mktemp -d)"
  curl -fsSL --connect-timeout 10 --max-time 120 -o "$tmp/hadolint" \
    "https://github.com/hadolint/hadolint/releases/download/v${HADOLINT_VERSION}/hadolint-Linux-${arch}" \
    && _lint_verify_sha256 "$tmp/hadolint" "$sha" \
    && sudo install -m0755 "$tmp/hadolint" /usr/local/bin/hadolint
  local rc=$?
  rm -rf "$tmp"
  [ $rc -eq 0 ] && return 0
  _lint_version_fallback hadolint "$HADOLINT_VERSION"
}

ensure_npm_groovy_lint() {
  _lint_version_is npm-groovy-lint "$NPM_GROOVY_LINT_VERSION" && return 0
  npm install -g "npm-groovy-lint@${NPM_GROOVY_LINT_VERSION}" >/dev/null 2>&1
  _lint_version_is npm-groovy-lint "$NPM_GROOVY_LINT_VERSION" \
    || _lint_version_fallback npm-groovy-lint "$NPM_GROOVY_LINT_VERSION"
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
