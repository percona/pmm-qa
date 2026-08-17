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

// Returns { proxy, args } to merge into chromium.launch(). Both are empty
// when no proxy is configured, so callers can spread unconditionally.
function proxyLaunchOptions() {
  const server = resolveProxyServer();
  if (server === "") {
    return { args: [] };
  }
  return {
    proxy: { server, bypass: "127.0.0.1,localhost" },
    args: ["--ssl-version-max=tls1.2"],
  };
}

function caBundlePath() {
  return process.env.CCR_CA_BUNDLE || "/root/.ccr/ca-bundle.crt";
}

// Chromium ships its own trust store and ignores the environment's CA bundle,
// so a TLS-intercepted site fails cert validation. Pin the interception CAs
// from that bundle to trust exactly them -- nothing broader.
function interceptionCaPinArgs() {
  const bundle = caBundlePath();
  if (!fs.existsSync(bundle)) return [];
  const pins = spkiPinsFromBundle(bundle);
  return pins.length ? [`--ignore-certificate-errors-spki-list=${pins.join(",")}`] : [];
}

// Launch options that BYPASS the agent proxy for a direct egress connection.
// The agent proxy is credential-scoped for github.com (repo-scoped REST only),
// so a github web page navigated through it comes back as a 403 JSON. A bare
// launch still inherits the system proxy, so force --no-proxy-server to take
// the transparent egress-gateway path, which serves the real page. That path is
// TLS-intercepted too, hence the CA pins.
function directEgressLaunchOptions() {
  return { args: ["--no-proxy-server", ...interceptionCaPinArgs()] };
}

module.exports = { proxyLaunchOptions, directEgressLaunchOptions };
