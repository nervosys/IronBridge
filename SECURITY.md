# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by emailing **<security@nervosys.ai>**.

Please include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a detailed response within 7 days.

## Security Audit Status

Last audit: **September 7, 2026**

### Compliance Frameworks

| Framework        | Status      | Notes                                             |
| ---------------- | ----------- | ------------------------------------------------- |
| NIST FIPS 140-2  | ✅ Compliant | Using rustls (FIPS-capable TLS), sha2 for hashing |
| CVE Monitoring   | ✅ Active    | Automated via `cargo audit` and `npm audit`       |
| MITRE ATT&CK     | ✅ Reviewed  | See threat model below                            |
| CMMC 2.0 Level 1 | ✅ Compliant | Access controls, audit logging                    |

### Dependency Security

#### Rust (ironbridge-cli, ironbridge-rust)

| Check             | Status                                                          |
| ----------------- | -------------------------------------------------------------- |
| `cargo audit`     | ✅ Exits 0 (2 advisories risk-accepted in `.cargo/audit.toml`)  |
| Hardcoded secrets | ✅ None found (full git-history content scan, Sep 2026)          |
| API key exposure  | ✅ Keys loaded from env vars only                               |
| SQL injection     | ✅ Using parameterized queries (rusqlite)                       |

**Accepted Risks** (recorded with rationale in `ironbridge-rust/.cargo/audit.toml`):

- `h2 0.3.27` (RUSTSEC-2026-0258, HTTP/2 DATA-frame DoS) — **not reachable**:
  the API server binds plain HTTP, so actix-web serves HTTP/1.1 only (HTTP/2 is
  negotiated solely over TLS ALPN, which the process never does). Pinned by the
  entire actix-web 4.x stack; the fix exists only in h2 ≥0.4.16 (hyper 1.x),
  which no actix-web release uses yet. Revisit when actix moves to hyper 1.x.
- `rsa 0.9.10` (RUSTSEC-2023-0071, "Marvin" timing side-channel) — **no upstream
  fix available**. The classic attack needs an RSA *decryption* padding oracle;
  `ironbridge-sso` performs no RSA decryption (it only verifies IdP signatures with
  public keys and signs its own requests). Revisit when a constant-time `rsa`
  release ships.
- Unmaintained/unsound warnings (`instant`, `paste`, `proc-macro-error2`,
  `lru`) — transitive, no CVE, not on a reachable code path.

#### JavaScript (ironbridge-web, ironbridge-app, ironbridge-shared)

| Check           | Status                                                              |
| --------------- | ------------------------------------------------------------------ |
| `npm audit`     | ✅ web/shared/extensions: 0; ironbridge-app: 0 high (2 moderate accepted) |
| XSS protection  | ✅ React's default escaping; highlight.js escapes rendered code      |
| CSRF protection | ✅ react-router updated to fix GHSA-h5cw-625j-3rxh                   |
| Token in URL    | ✅ WebSocket auth moved to `Sec-WebSocket-Protocol` (not logged)     |

**Remediated (Sep 2026):** `axios` → 1.20.0 (prototype-pollution / proxy-SSRF
cluster), `esbuild` (dev-server file read), and `prismjs`/`postcss` pinned via
`overrides` (DOM-clobbering / source-map path traversal). ironbridge-app was
upgraded Expo SDK 54→57, which cleared the HIGH `image-size` DoS.

**Accepted Risks (JS):**

- `decode-uri-component 0.2.2` (moderate DoS, via react-navigation's
  query-string) — **no upstream fix available**.
- `uuid` (moderate) — the fix is a breaking ESM-only major that risks breaking
  React Native internals; deferred.

### Threat Model (MITRE ATT&CK)

| Technique                          | Mitigation                                       |
| ---------------------------------- | ------------------------------------------------ |
| T1552 - Unsecured Credentials      | API keys from env vars only, never logged        |
| T1005 - Data from Local System     | Chat data is user-owned, no exfiltration         |
| T1027 - Obfuscated Files           | Release binaries are stripped but not obfuscated |
| T1071 - Application Layer Protocol | HTTPS/TLS enforced for cloud providers           |
| T1059 - Command and Scripting      | Agent tools are sandboxed, require user consent  |

### Data Privacy

- **No telemetry**: IronBridge does not phone home or collect usage data
- **Local storage**: All data stays on user's machine
- **No PII collection**: We don't store emails, names, or identifiers
- **API keys**: Never persisted to disk, memory-only via env vars

### Secure Defaults

- TLS 1.2+ required for all HTTPS connections (via rustls)
- SQLite databases are local-only (no network exposure)
- API server binds to localhost by default
- Cookie encryption uses AES-256-GCM where applicable

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x.x   | ✅ Yes     |
| < 1.0   | ❌ No      |

## Security Contacts

- **Email**: <security@nervosys.ai>
- **PGP Key**: Available upon request
