// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

export interface NavItem {
  title: string;
  href: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    title: 'Getting Started',
    items: [
      { title: 'Introduction', href: '/docs' },
      { title: 'Features', href: '/docs/features' },
      { title: 'Installation', href: '/docs/installation' },
      { title: 'Quick Start', href: '/docs/quickstart' },
    ],
  },
  {
    title: 'CLI Reference',
    items: [
      { title: 'Commands', href: '/docs/cli' },
      { title: 'Agent Launcher', href: '/docs/agents' },
      { title: 'Watch Mode', href: '/docs/watch' },
      { title: 'Harvest System', href: '/docs/harvest' },
    ],
  },
  {
    title: 'Integrations',
    items: [
      { title: 'API Server', href: '/docs/api' },
      { title: 'MCP Server', href: '/docs/mcp' },
      { title: 'Providers', href: '/docs/providers' },
    ],
  },
  {
    title: 'Ecosystem',
    items: [
      { title: 'Architecture', href: '/docs/architecture' },
      { title: 'Agency (ADK)', href: '/docs/agency' },
      { title: 'Enterprise', href: '/docs/enterprise' },
    ],
  },
  {
    title: 'Community',
    items: [
      { title: 'Contributing', href: '/docs/contributing' },
    ],
  },
];

/** Flatten nav for prev/next */
export function flatNav(): NavItem[] {
  return navigation.flatMap((s) => s.items);
}
