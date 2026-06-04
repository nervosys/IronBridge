// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Link from 'next/link';
import { flatNav } from '@/lib/navigation';

export function PageNav({ currentPath }: { currentPath: string }) {
  const flat = flatNav();
  const idx = flat.findIndex((n) => n.href === currentPath);

  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx < flat.length - 1 ? flat[idx + 1] : null;

  if (!prev && !next) return null;

  return (
    <div className="page-nav">
      {prev ? (
        <Link href={prev.href}>
          <span className="nav-label">← Previous</span>
          <span className="nav-title">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href} className="next">
          <span className="nav-label">Next →</span>
          <span className="nav-title">{next.title}</span>
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
