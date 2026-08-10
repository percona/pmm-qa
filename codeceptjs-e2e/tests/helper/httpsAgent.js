const { Agent } = require('https');

// PMM Server presents a self-signed certificate, so certificate verification has
// to be relaxed for requests aimed at it. Scoping that to this agent keeps the
// rest of the process on normal TLS rules, rather than turning verification off
// for everything via NODE_TLS_REJECT_UNAUTHORIZED=0 — which Node reports as
// "makes TLS connections and HTTPS requests insecure" on every run.
//
// keepAlive is off deliberately. A pooled socket collects one 'error' listener
// per in-flight request, and once more than ten share a TLSSocket Node raises
// MaxListenersExceededWarning. Against a local server the extra handshakes cost
// far less than the noise.
module.exports = new Agent({ rejectUnauthorized: false, keepAlive: false });
