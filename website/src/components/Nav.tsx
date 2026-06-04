// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navigation } from '@/lib/navigation';
import { useState } from 'react';

export function Header() {
    return (
        <header className="header">
            <Link href="/" className="header-logo">
                <span className="logo-icon">◈</span>
                <span>CHASM</span>
            </Link>
            <nav className="header-nav">
                <Link href="/docs">Docs</Link>
                <Link href="/docs/features">Features</Link>
                <Link href="/docs/api">API</Link>
                <a
                    href="https://github.com/nervosys/chasm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="header-github"
                >
                    GitHub ↗
                </a>
            </nav>
            <MobileMenuButton />
        </header>
    );
}

function MobileMenuButton() {
    return (
        <button
            className="menu-toggle"
            onClick={() => document.querySelector('.sidebar')?.classList.toggle('open')}
            aria-label="Toggle menu"
        >
            ☰
        </button>
    );
}

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="sidebar">
            {navigation.map((section) => (
                <div key={section.title} className="sidebar-section">
                    <div className="sidebar-title">{section.title}</div>
                    {section.items.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`sidebar-link${pathname === item.href ? ' active' : ''}`}
                        >
                            {item.title}
                        </Link>
                    ))}
                </div>
            ))}
        </aside>
    );
}
