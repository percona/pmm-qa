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

module.exports = { proxyLaunchOptions };
