import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kombat Fitness Academy — Admin',
  description: 'Owner/admin dashboard for the academy WhatsApp automation platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
