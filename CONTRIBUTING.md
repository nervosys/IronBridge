# Contributing to IronBridge

Thanks for your interest. This file covers what you need to build the tree, what
has to pass before a pull request can land, and the terms contributions are
accepted under.

## Contributor License Agreement

Every contribution requires a signed [CLA](CLA.md). IronBridge is dual-licensed
(`AGPL-3.0-only OR LicenseRef-IronBridge-Commercial`), and the CLA is what lets
Nervosys offer the commercial option. Sign it once and it covers all your
future contributions.

By contributing you affirm the work is yours to give, and you grant Nervosys
LLC a perpetual, irrevocable licence to use it, including in proprietary
products.

## Code of Conduct

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Layout

| Directory | What it is | Toolchain |
| --- | --- | --- |
| `ironbridge-rust/` | Core library, CLI, API server, MCP server | Rust 1.75+ |
| `ironbridge-sso/` | Pure-Rust OIDC and SAML, used by the above | Rust 1.75+ |
| `ironbridge-shared/` | Shared TypeScript types | Node 20+ |
| `ironbridge-web/` | React web application | Node 20+ |
| `ironbridge-app/` | React Native (Expo) mobile app | Node 20+ |
| `ironbridge-desktop/` | Tauri desktop application | Node 20+ and Rust |
| `vscode-extension/`, `browser-extension/`, `jetbrains-plugin/`, `vim-plugin/`, `neovim-plugin/` | Editor and browser integrations | Node 20+ / JDK 21 |
| `website/` | Documentation site | Node 20+ |

## Building and testing

### Rust

```bash
cd ironbridge-rust
cargo build
cargo test                      # 1121 tests
cargo test --features enterprise # 1187 tests; needs no native dependencies
cargo fmt --check
cargo clippy --all-targets -- -D warnings
```

All four must pass. `cargo clippy` is run with `-D warnings`, so a new warning
is a failure.

### TypeScript and JavaScript

**Build `ironbridge-shared` first.** It is a `file:` dependency of
`ironbridge-web` and `ironbridge-app`, and its `dist/` is committed, so a stale
or unbuilt `dist/` makes type errors appear in packages you did not touch:

```bash
cd ironbridge-shared && npm ci && npm run build && npm run typecheck && npm test
```

Then, per package:

```bash
cd ironbridge-web        && npm ci && npm run lint && npm test && npm run build
cd ironbridge-app        && npm ci && npx tsc --noEmit && npm test
cd ironbridge-desktop    && npm ci && npm run build      # produces MSI/NSIS bundles
cd vscode-extension      && npm ci && npm run lint && npm run compile && npm run test:unit
cd browser-extension     && npm ci && npm run lint && npm test
cd website               && npm ci && npm run lint && npm run build
```

The desktop app is a Rust crate as well; `cd ironbridge-desktop && cargo test`
covers the embedded API server.

If `@ironbridge/shared` cannot be resolved, the link in `node_modules` is stale
— re-run `npm ci` in that package.

### JetBrains plugin

```bash
cd jetbrains-plugin && ./gradlew build    # `build` includes `test`
```

Needs JDK 21; Gradle 8.7 does not run on JDK 25.

### Editor plugins

Both are thin clients over the REST API, and both are tested against a stub
server rather than mocked, so a request path that the API does not route fails
the suite:

```bash
cd vim-plugin     && python3 test/run_tests.py   # needs vim and curl
cd neovim-plugin  && nvim --headless -l test/run.lua
```

## Pull requests

1. Fork, then branch from `master`.
2. Make the change, and add tests for it. Rust code has good coverage and new
   code is expected to keep it; the JS/TS packages are thinner, so tests there
   are especially welcome.
3. Run the checks above for every component you touched.
4. Open the PR against `master` with a description of what changed and why.
5. Sign the CLA if you have not already.

### Commit messages

Conventional Commits, with the component as the scope:

```
feat(api): implement the twelve endpoints the web UI was calling
fix(vscode): repair test:unit, which turns out to run 64 real tests
security(auth): make logout actually invalidate the token
docs: record the security behaviour changed in #75, #77, #78 and #80
```

Types in use: `feat`, `fix`, `security`, `perf`, `refactor`, `test`, `docs`,
`style`, `chore`, `ci`. Append `!` for a breaking change (`chore!: rename ...`).

Write the subject as what the change does, not what area it touches.

## Reporting security issues

Do not open a public issue. Follow [SECURITY.md](SECURITY.md).

## Documentation claims

`README.md` and `ROADMAP.md` state counts — tests, routes, lines of code — and
describe what each area does and does not do. If your change moves one of those
numbers or crosses one of those boundaries, update the claim in the same PR. A
documented capability that does not exist is treated as a bug here.
