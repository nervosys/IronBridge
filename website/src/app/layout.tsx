// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CHASM // Documentation',
  description: 'Chat Session Manager (Chasm): Bridging the divide between AI providers.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
