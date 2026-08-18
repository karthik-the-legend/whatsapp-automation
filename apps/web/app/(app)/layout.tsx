import type { ReactNode } from 'react';
import { UserButton } from '@clerk/nextjs';
import { Sidebar } from '@/components/layout/sidebar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
          <span className="text-sm font-semibold">Kombat Fitness Academy</span>
          <UserButton afterSignOutUrl="/sign-in" />
        </header>
        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
