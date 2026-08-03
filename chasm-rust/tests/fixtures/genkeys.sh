#!/bin/bash
# Regenerates the throwaway SAML test keypair used by the sso.rs unit tests.
# These are test-only credentials with no access to anything; they exist so the
# XML Signature Wrapping regression tests can produce genuinely signed input.
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
W="$(mktemp -d)"
trap 'rm -rf "$W"' EXIT

openssl req -x509 -newkey rsa:2048 -keyout "$W/key.pem" -out "$W/cert.pem" \
    -days 36500 -nodes -subj '/CN=chasm-test-idp' 2>/dev/null
openssl pkcs8 -topk8 -inform PEM -outform DER -in "$W/key.pem" -out "$W/key.der" -nocrypt
openssl x509 -in "$W/cert.pem" -outform DER -out "$W/cert.der"

base64 -w0 "$W/key.der" > "$D/saml_test_key.b64"
base64 -w0 "$W/cert.der" > "$D/saml_test_cert.b64"

# A second, unrelated keypair. Used to prove that a response signed by one IdP
# is rejected when checked against a different IdP's certificate -- i.e. that
# the configured certificate is really the trust anchor. Perturbing a byte of
# the first cert would not test this: it leaves the embedded public key intact.
openssl req -x509 -newkey rsa:2048 -keyout "$W/other.pem" -out "$W/othercert.pem" \
    -days 36500 -nodes -subj '/CN=chasm-other-idp' 2>/dev/null
openssl x509 -in "$W/othercert.pem" -outform DER -out "$W/othercert.der"
base64 -w0 "$W/othercert.der" > "$D/saml_other_cert.b64"

wc -c "$D/saml_test_key.b64" "$D/saml_test_cert.b64" "$D/saml_other_cert.b64"
