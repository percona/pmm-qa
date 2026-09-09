"use strict";
// Computes a certificate's SPKI SHA-256 pin (base64) for Chromium's
// --ignore-certificate-errors-spki-list flag -- lets Playwright trust a
// specific self-signed cert without a CA and without ignoreHTTPSErrors'
// blanket "trust anything" behavior.
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

function spkiPinFromPem(pem) {
  const pubkey = execFileSync("openssl", ["x509", "-pubkey", "-noout"], { input: pem });
  const der = execFileSync("openssl", ["pkey", "-pubin", "-outform", "der"], { input: pubkey });
  const hash = execFileSync("openssl", ["dgst", "-sha256", "-binary"], { input: der });
  return hash.toString("base64");
}

function spkiPinFromCertFile(certPath) {
  return spkiPinFromPem(fs.readFileSync(certPath));
}

// SPKI pins for every cert in a PEM bundle whose subject matches `filter`.
// Used to trust the environment's TLS-interception CAs (Anthropic egress
// gateway / agent proxy) so Chromium validates MITM'd public sites without
// falling back to ignoreHTTPSErrors' blanket "trust anything".
function spkiPinsFromBundle(bundlePath, filter = /Anthropic/) {
  const pem = fs.readFileSync(bundlePath, "utf8");
  const blocks = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || [];
  const pins = new Set();
  for (const block of blocks) {
    const subject = execFileSync("openssl", ["x509", "-noout", "-subject"], { input: block }).toString();
    if (filter.test(subject)) pins.add(spkiPinFromPem(block));
  }
  return [...pins];
}

module.exports = { spkiPinFromCertFile, spkiPinsFromBundle };
