"use strict";
// Chromium launch options for environments where outbound HTTPS is forced
// through an intercepting egress proxy (Claude Code cloud sessions set
// HTTPS_PROXY to a local agent proxy; see /root/.ccr/README.md).
//
// Two things are needed there, and neither is Playwright's default:
//
//  1. `proxy` -- Chromium does not read HTTPS_PROXY from the environment, so
//     without this every navigation fails outright.
//
//  2. `--ssl-version-max=tls1.2` -- the interception proxy resets the
//     connection partway through Chromium's TLS 1.3 handshake. Confirmed from
//     a netlog: CONNECT succeeds ("HTTP/1.1 200 Connection Established"), then
//     the ClientHello (~1.7 KB, ECH enabled) draws a TCP reset --
//     SSL_HANDSHAKE_ERROR net_error -101, os_error 104 -- surfacing as
//     ERR_CONNECTION_RESET. Capping at TLS 1.2 produces a hello the proxy
//     handles. Disabling ECH/post-quantum key agreement alone does not help.
//
//     This caps only the browser-to-proxy leg inside the sandbox; the proxy
//     negotiates its own upstream TLS independently. It is a workaround for a
//     proxy-side limitation, not a preference -- drop it once the proxy
//     handles a TLS 1.3 hello.
//
// The proxy's CA is already in the trust store browsers read, so no extra
// certificate handling is required: a self-signed PMM cert reaches Chromium
// re-signed by that trusted CA. The PMM SPKI pin the callers pass stays
// meaningful for the direct, no-proxy path.
//
// Precedence: PW_PROXY_SERVER > HTTPS_PROXY > https_proxy. Set
// PW_PROXY_SERVER='' to force a direct connection.

const fs = require("node:fs");
const { spkiPinsFromBundle } = require("./spki-pin");

function resolveProxyServer() {
  const explicit = process.env.PW_PROXY_SERVER;
  if (explicit !== undefined) {
    return explicit.trim();
  }
  return (process.env.HTTPS_PROXY || process.env.https_proxy || "").trim();
}

function caBundlePath() {
  return process.env.CCR_CA_BUNDLE || "/root/.ccr/ca-bundle.crt";
}

// Chromium ships its own trust store and ignores the environment's CA bundle,
// so a TLS-intercepted site fails cert validation. Pin the interception CAs
// from that bundle to trust exactly them -- nothing broader.
function interceptionCaPins() {
  const bundle = caBundlePath();
  return fs.existsSync(bundle) ? spkiPinsFromBundle(bundle) : [];
}

// A single --ignore-certificate-errors-spki-list flag combining the caller's
// own pins (e.g. a pinned PMM cert) with the interception CA pins. Chromium
// keeps only the LAST occurrence of the flag, so every pin must go in one --
// two separate flags would silently drop the earlier set.
function spkiListArgs(extraPins = []) {
  const pins = [...new Set([...extraPins, ...interceptionCaPins()].filter(Boolean))];
  return pins.length ? [`--ignore-certificate-errors-spki-list=${pins.join(",")}`] : [];
}

// Returns { proxy, args } to merge into chromium.launch(). Pass any caller pins
// (e.g. a pinned PMM cert) as opts.spkiPins so they combine with the
// interception CA pins into the single flag above.
function proxyLaunchOptions({ spkiPins = [] } = {}) {
  const server = resolveProxyServer();
  if (server === "") {
    return { args: spkiListArgs(spkiPins) };
  }
  return {
    proxy: { server, bypass: "127.0.0.1,localhost" },
    args: ["--ssl-version-max=tls1.2", ...spkiListArgs(spkiPins)],
  };
}

// Launch options that BYPASS the agent proxy for a direct egress connection.
// The agent proxy is credential-scoped for github.com (repo-scoped REST only),
// so a github web page navigated through it comes back as a 403 JSON. A bare
// launch still inherits the system proxy, so force --no-proxy-server to take
// the transparent egress-gateway path, which serves the real page. That path is
// TLS-intercepted too, hence the CA pins.
function directEgressLaunchOptions({ spkiPins = [] } = {}) {
  return { args: ["--no-proxy-server", ...spkiListArgs(spkiPins)] };
}

module.exports = { proxyLaunchOptions, directEgressLaunchOptions };
