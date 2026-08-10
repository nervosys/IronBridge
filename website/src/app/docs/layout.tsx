// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import { Header, Sidebar } from '@/components/Nav';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Header />
            <div className="page-wrapper">
                <Sidebar />
                <main className="main-content">
                    {children}
                    <footer className="footer">
                        © {new Date().getFullYear()} Nervosys LLC — Apache 2.0 License
                    </footer>
                </main>
            </div>
        </>
    );
}
