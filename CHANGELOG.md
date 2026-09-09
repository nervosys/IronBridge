# Changelog

All notable changes to IronBridge are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims
at [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Releases before 2.0 were made under the project's former name, **Chasm**, and
are published on crates.io as [`chasm-cli`](https://crates.io/crates/chasm-cli).
The `v1.3.3` tag in this repository is the last of that line.

## [Unreleased] — 2.0.1

Published to crates.io as [`ironbridge-cli`](https://crates.io/crates/ironbridge-cli)
2.0.1, on [`ironbridge-sso`](https://crates.io/crates/ironbridge-sso) 0.1.0. The
former name is deprecated: `chasm-cli` 2.0.1 is a final release carrying the
same code and a notice pointing here.

No `v2.*` tag has been cut yet, so the GitHub release artifacts — binaries and
desktop installers — do not exist yet. `release.yml` builds them when a `v*`
tag is pushed.

### Added

- **REST surface completed.** The twelve endpoints the web UI was already
  calling, the five remaining feature areas, `/api/notes`, and GraphQL mounted
  at `/graphql` with database-backed resolvers. The spec (`openapi.yaml`) is now
  127 paths and 170 operations, and a test asserts every documented operation is
  actually routed.
- **Client SDKs.** `ironbridge sdk generate` emits single-file clients for eight
  languages; `generate()` is exhaustive over `SdkLanguage`, so a new language
  fails to compile until it has a template.
- **ironbridge-sso.** Pure-Rust OIDC (authorization code + PKCE) and SAML,
  replacing `samael`. No native dependencies, so the `enterprise` feature builds
  on every platform cargo does.
- **Semantic search and conversation analysis** backed by any OpenAI-compatible
  endpoint, with clearly-labelled heuristic fallback when no key is configured.
- **Agent inbox, datasets, downloads, research, RAG and fine-tuning** served
  from real endpoints instead of fixtures.
- **Desktop app runs the API server in-process**, so it works standalone.
- **Tooling:** a Gradle wrapper for the JetBrains plugin, ESLint for the browser
  extension, and encrypted storage for provider credentials.
- Battery-aware background sync in the mobile app now reads real battery state
  via `expo-battery`, and skips the battery gates on platforms that cannot
  report it rather than assuming a level.
- **Test suites for the five components that had none**: the browser extension
  (41), the mobile app (36), the JetBrains plugin (21), and the Vim (20
  assertions over 8 request paths) and Neovim (24 checks) plugins. The editor
  and browser clients are driven against a stub server, so the request paths are
  asserted rather than assumed.

### Changed

- **Renamed Chasm to IronBridge** (breaking). Crate `ironbridge-cli`, binaries
  `ironbridge` and `ironbridge-mcp`, library `ironbridge`.
- All components now carry a single version number (2.0.1): the Rust crates, the
  seven npm packages, the Tauri bundle and the browser-extension manifest.
- `xcross-ios` was extracted into its own repository.
- The dead REST implementation in `api/handlers.rs`/`api/routes.rs`, which held
  24 `"not yet implemented"` stubs and was never compiled, was deleted.

### Fixed

- `vscode-extension`'s `test:unit`, which turned out to run 64 real tests once
  repaired, and its 29 lint warnings.
- `scripts-ci`, which tested files that do not exist.
- Two generated desktop artifacts that had drifted from their sources.
- Three things the rename broke, plus rustfmt compliance.
- **`cargo publish` could not run at all.** `ironbridge-cli` declared
  `ironbridge-sso` as a bare path dependency, and cargo refuses to publish a
  crate whose dependency carries no version requirement. A release attempt would
  have failed at the upload step, after the binaries were built. The two crates
  must be published in order: `ironbridge-sso` first, then `ironbridge-cli`.
- **The release workflow** linked its changelog at `blob/main/CHANGELOG.md` on a
  repository whose default branch is `master`, called the product "Chat System
  Manager", and had no check that the tag matched the crate version — so a
  `v2.0.1` tag could ship binaries answering `--version` with something else.
  It also never built the desktop installers, so the Tauri app existed only as
  something you could build yourself. All four are fixed; the release now
  carries the `.msi`, `-setup.exe`, `.deb`, `.AppImage` and `.dmg` bundles.
- **Four more components still claiming 1.0.0**: the Firefox manifest, the
  browser-extension popup, the JetBrains `plugin.xml`, and the mobile app's
  Settings screen — which now reads the version from the Expo manifest rather
  than repeating it, so it cannot drift again.
- **Four broken API calls in the editor clients**, all found by the new
  suites. The JetBrains plugin asked for `/api/search/sessions` (the route is
  `/api/sessions/search`) and posted harvests to `/harvest` instead of
  `/api/harvest`; the Vim and Neovim plugins both checked `/health` instead of
  `/api/health`. All four requests 404'd, and every one of these clients renders
  a 404 as an empty result, so search returned nothing, harvest silently did
  nothing, and a healthy server reported itself unreachable.

### Security

Two audit passes landed in this line. In rough order:

- Closed an unauthenticated RCE and command-injection path, and an `/api` auth
  bypass, along with CSV injection and webhook SSRF.
- Authentication: real JWT secret, argon2 password hashing, PBKDF2 raised to
  600k with per-record migration, login throttling, weak-password refusal,
  token revocation on logout, password change and refresh, and the WebSocket
  token moved out of the URL.
- Authorization: open-path prefixes no longer extend past the path separator.
- SSO: replayed and unsolicited SAML responses are rejected; signatures are
  verified against wrapping attacks.
- Webhooks: five ways past the SSRF metadata block were closed.
- SWE tools: `execute_tool` file access is confined to the project directory,
  and the filesystem tools are opt-in like `run_command`.
- GraphQL query depth and complexity are bounded; the last two unbounded list
  limits are capped.
- Hardened the Tauri webview configuration and dropped scripts from static
  extension webviews.
- Dependency advisories remediated, and Expo upgraded from SDK 54 to 57.

[Unreleased]: https://github.com/nervosys/IronBridge/compare/v1.3.3...HEAD
