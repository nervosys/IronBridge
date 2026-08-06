# chasm-sso

Enterprise single sign-on for Chasm — OIDC and SAML, with **no native
dependencies**.

## Why

The existing enterprise SSO path uses [`samael`](https://crates.io/crates/samael),
which wraps the C library `xmlsec1`. That works, and on Linux it is the more
conservative choice. It also pulls in libxml2, OpenSSL, and an autotools helper
(`xmlsec1-config`) with no Windows equivalent, which makes a self-hosted Windows
build effectively impossible — see `chasm-rust/docs/api/rest.md` for the full
three-layer dependency chain and where it stops.

This crate is pure Rust. It builds anywhere `cargo` does.

## Use OIDC if you possibly can

```rust
let client = OidcClient::new(config, metadata, jwks)?;

let request = client.begin();            // redirect the user to request.authorization_url
// ...store request.state / nonce / verifier in the session...

OidcClient::check_state(&stored_state, &returned_state)?;
let identity = client.verify_id_token(&id_token, &stored_nonce)?;
```

ID tokens are JWTs, so signature verification is `jsonwebtoken` — a mature,
widely-used implementation. **This crate contributes no cryptography of its own
to the OIDC path.** Entra, Okta, Ping, Google and Auth0 all speak OIDC.

Supported: authorization code flow with PKCE (S256), RS/PS/ES signatures,
discovery, JWKS.

Refused, deliberately:

- `alg: none` and HMAC algorithms. Accepting HS256 alongside RS256 is the
  algorithm-confusion attack — an attacker signs with the RSA *public* key as
  an HMAC secret. Only asymmetric verification, ever.
- A `kid` that isn't published. No falling back to "try every key".
- A missing `kid` when more than one key could apply. Ambiguity is refused.
- Keys marked `use: enc`.
- ID tokens with no `nonce`, or a `nonce` that doesn't match the request.

## SAML, if you must

```rust
let identity = saml::verify_response(&saml_response_b64, &config, Utc::now())?;
```

Supported: HTTP-POST binding, exclusive canonicalization (with
`InclusiveNamespaces PrefixList`), enveloped-signature transform, RSA-SHA256/384/512,
SHA-256/384/512 digests, same-document `#id` references.

Refused: SHA-1, XPath and XSLT transforms, external references, multiple
signatures in one document, duplicate `ID` attributes, assertions with no
`Conditions`.

Refusing is safe. A provider using an unsupported construct fails to log in
visibly, rather than being accepted on weaker terms.

### The security property

`verify_and_extract_signed` returns **only the signed element**, canonicalised.
The caller never sees the original document.

That is structural defence against XML Signature Wrapping, not a check for it.
The attack works by wrapping a genuinely signed assertion somewhere the verifier
won't look while putting a forgery where it will: the signature validates
against the real fragment, then the claims get read from the forged one. If
there is no original document to re-read, there is nothing to be confused by.

`tests/saml_wrapping.rs` mounts these attacks with real RSA keys and real
signatures — a wrapped assertion, a forged assertion preceding the signed one,
a duplicated `ID`, post-signature tampering, wrong issuer, wrong audience,
expired. The suite also verifies a legitimate assertion, so the rejections
cannot pass vacuously: an implementation that rejected everything would fail
that test.

## Status, honestly

The OIDC path leans entirely on `jsonwebtoken` and I would deploy it.

**The SAML path is a hand-written XML signature verifier and has not been
adversarially reviewed.** xmlsec1 has two decades of attention behind it; this
has a test file. The mitigations are structural and the profile is narrow, but
those are arguments for *why it should be sound*, not evidence that it is.

Before trusting it in production:

- Differential-test against xmlsec1 on Linux across a corpus of real IdP
  responses. Any disagreement is a bug here until proven otherwise.
- Fuzz the canonicaliser.
- Have someone who does this professionally read `saml/c14n.rs` and
  `saml/signature.rs`.

If you have a Linux deployment and no Windows constraint, `samael` over xmlsec1
remains the more conservative choice, and choosing it is not a defeat.

## Licence

AGPL-3.0-only, with commercial dual-licensing — same terms as the rest of Chasm.
