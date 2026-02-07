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
