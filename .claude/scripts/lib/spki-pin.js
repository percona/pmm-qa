"use strict";
// Computes a certificate's SPKI SHA-256 pin (base64) for Chromium's
// --ignore-certificate-errors-spki-list flag -- lets Playwright trust a
// specific self-signed cert without a CA and without ignoreHTTPSErrors'
// blanket "trust anything" behavior.
const { execFileSync } = require("node:child_process");

function spkiPinFromCertFile(certPath) {
  const pubkey = execFileSync("openssl", ["x509", "-in", certPath, "-pubkey", "-noout"]);
  const der = execFileSync("openssl", ["pkey", "-pubin", "-outform", "der"], { input: pubkey });
  const hash = execFileSync("openssl", ["dgst", "-sha256", "-binary"], { input: der });
  return hash.toString("base64");
}

module.exports = { spkiPinFromCertFile };
