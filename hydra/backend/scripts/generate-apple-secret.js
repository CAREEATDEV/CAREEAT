#!/usr/bin/env node
// Generates the Apple "client secret" (a signed JWT) that Supabase needs for
// Sign in with Apple. Run this LOCALLY — your .p8 private key never leaves
// your machine, and this script has zero dependencies (uses Node's built-in
// crypto only).
//
// Usage:
//   node generate-apple-secret.js <path-to-.p8> <TEAM_ID> <KEY_ID> <SERVICES_ID>
//
// Example:
//   node generate-apple-secret.js ./AuthKey_ABC123DEFG.p8 QN65J7X695 ABC123DEFG com.shipply.hydraapp.signin
//
// Paste the printed JWT into Supabase → Authentication → Providers → Apple →
// "Secret Key". It's valid up to 6 months (Apple's max) — rerun this script
// to generate a new one when it expires.

const fs = require('fs');
const crypto = require('crypto');

const [, , keyPath, teamId, keyId, servicesId] = process.argv;

if (!keyPath || !teamId || !keyId || !servicesId) {
  console.error(
    'Usage: node generate-apple-secret.js <path-to-.p8> <TEAM_ID> <KEY_ID> <SERVICES_ID>'
  );
  process.exit(1);
}

const privateKey = fs.readFileSync(keyPath, 'utf8');

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const now = Math.floor(Date.now() / 1000);
const sixMonths = 15777000; // Apple's maximum allowed lifetime

const header = { alg: 'ES256', kid: keyId };
const payload = {
  iss: teamId,
  iat: now,
  exp: now + sixMonths,
  aud: 'https://appleid.apple.com',
  sub: servicesId,
};

const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

// JOSE/JWT ES256 needs the raw (r || s) signature format, not DER — Node
// exposes this via dsaEncoding: 'ieee-p1363' (available Node 13+).
const signature = crypto
  .sign('sha256', Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  })
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');

console.log(`${signingInput}.${signature}`);
