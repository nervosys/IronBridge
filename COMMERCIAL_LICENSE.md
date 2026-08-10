# Chasm Commercial License

## Overview

Chasm is dual-licensed under the **GNU Affero General Public License v3.0
(AGPL-3.0)** and a **Commercial License** for organizations that cannot comply
with AGPL-3.0 obligations.

## SPDX Identifier

The commercial half of the dual license has no SPDX-registered identifier, so
Chasm declares its own:

```
LicenseRef-Chasm-Commercial
```

**This document is that license reference.** Package manifests and source
headers throughout the repository carry:

```
AGPL-3.0-only OR LicenseRef-Chasm-Commercial
```

Read that expression as *"AGPL-3.0-only, or commercial terms by agreement with
Nervosys LLC."* It is not an invitation to self-select the commercial branch:
absent a signed agreement, the terms you receive Chasm under are AGPL-3.0-only.
Automated license scanners that treat `OR` as a free choice will get this
wrong — the commercial option requires [contacting us](#contact).

## When You Need a Commercial License

Under the AGPL-3.0, if you modify Chasm or use it to provide a network service,
you must make the complete source code available to users of that service. A
commercial license removes this obligation. You need a commercial license if you:

- **Offer Chasm as a service** (SaaS, hosted, managed) without open-sourcing
  your modifications
- **Embed or redistribute** Chasm in proprietary products
- **White-label** Chasm for resale
- **Cannot comply** with AGPL-3.0 source disclosure requirements
- **Need patent indemnification** or custom warranty terms

## What the Commercial License Includes

- Freedom from AGPL-3.0 copyleft obligations
- Full rights to redistribute and sublicense
- White-label and OEM embedding rights
- Priority support and SLA options
- Patent and IP indemnification
- Custom integration support

### What it does *not* include

A commercial license buys different **terms**, not additional **code**. There
is no proprietary build of Chasm held back from the AGPL one.

In particular, the enterprise features are already here, under AGPL-3.0:
single sign-on ([`chasm-sso`](chasm-sso/) plus the `/sso` and `/oidc` handlers),
multi-tenancy, audit logging and retention policy all ship in this repository
behind `--features enterprise`. Building them requires nothing but `cargo`.

What a commercial license changes is that you may run or redistribute those
features without the AGPL's source-disclosure obligation.

## Pricing

Commercial licenses are available on a per-organization basis. Pricing is
based on:

- Number of seats / developers
- Deployment scope (single product vs. portfolio)
- Support tier requirements
- Custom feature development needs

## Contact

For commercial licensing inquiries:

- **Email:** [hello@nervosys.ai](mailto:hello@nervosys.ai)
- **Web:** [nervosys.ai](https://nervosys.ai)
- **GitHub:** [github.com/nervosys/chasm](https://github.com/nervosys/chasm)

## FAQ

### Can I use Chasm internally at my company for free?

**Yes.** As long as you comply with AGPL-3.0 (i.e., you make source code
available to users who interact with Chasm over a network), you can use it
at no cost.

### Can I build a product that uses Chasm and sell it?

Only if you comply with AGPL-3.0 — meaning your derivative work must also
be AGPL-3.0 licensed and source code must be available. If you want to keep
your code proprietary, you need a commercial license.

### Can I offer Chasm as a hosted service?

Under AGPL-3.0, yes — but you must provide complete corresponding source to
all users of that service. A commercial license removes this requirement.

### What about contributions?

By signing the [Contributor License Agreement](CLA.md), contributors grant
Nervosys LLC the right to use contributions under both the AGPL-3.0 and
commercial license. This enables the dual-license model while ensuring
contributors retain their copyright. See [CONTRIBUTING.md](chasm-rust/CONTRIBUTING.md).

---

Copyright 2024-2026 Nervosys LLC. All rights reserved.
