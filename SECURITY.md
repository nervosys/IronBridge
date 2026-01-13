# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by emailing **<security@nervosys.com>**.

Please include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a detailed response within 7 days.

## Security Audit Status

Last audit: **January 13, 2026**

### Compliance Frameworks

| Framework        | Status      | Notes                                             |
| ---------------- | ----------- | ------------------------------------------------- |
| NIST FIPS 140-2  | ✅ Compliant | Using rustls (FIPS-capable TLS), sha2 for hashing |
| CVE Monitoring   | ✅ Active    | Automated via `cargo audit` and `npm audit`       |
| MITRE ATT&CK     | ✅ Reviewed  | See threat model below                            |
| CMMC 2.0 Level 1 | ✅ Compliant | Access controls, audit logging                    |

### Dependency Security

#### Rust (chasm-cli, chasm-rust)

| Check             | Status                                               |
| ----------------- | ---------------------------------------------------- |
| `cargo audit`     | ⚠️ 3 warnings (unmaintained deps in ratatui, no CVEs) |
| Hardcoded secrets | ✅ None found                                         |
| API key exposure  | ✅ Keys loaded from env vars only                     |
| SQL injection     | ✅ Using parameterized queries (rusqlite)             |

**Accepted Risks:**

- `paste 1.0.15` - Unmaintained but no security issues, transitive via ratatui
- `proc-macro-error 1.0.4` - Unmaintained, transitive via tabled
- `lru 0.12.5` - Unsound in IterMut (not used in our code path)

#### JavaScript (chasm-web, chasm-app, chasm-shared)

| Check           | Status                                            |
| --------------- | ------------------------------------------------- |
| `npm audit`     | ✅ 0 vulnerabilities                               |
| XSS protection  | ✅ React's default escaping                        |
| CSRF protection | ✅ react-router updated to fix GHSA-h5cw-625j-3rxh |

### Threat Model (MITRE ATT&CK)

| Technique                          | Mitigation                                       |
| ---------------------------------- | ------------------------------------------------ |
| T1552 - Unsecured Credentials      | API keys from env vars only, never logged        |
| T1005 - Data from Local System     | Chat data is user-owned, no exfiltration         |
| T1027 - Obfuscated Files           | Release binaries are stripped but not obfuscated |
| T1071 - Application Layer Protocol | HTTPS/TLS enforced for cloud providers           |
| T1059 - Command and Scripting      | Agent tools are sandboxed, require user consent  |

### Data Privacy

- **No telemetry**: Chasm does not phone home or collect usage data
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
