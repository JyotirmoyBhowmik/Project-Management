'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-xs text-[var(--muted-foreground)] py-3 px-4 sm:px-6">
      <Link href="/" className="flex items-center hover:text-[var(--foreground)] transition-colors">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join('/')}`;
        const isLast = index === segments.length - 1;
        const formatted = segment.replace(/-/g, ' ').replace(/^([a-z])/, (m) => m.toUpperCase());

        return (
          <React.Fragment key={href}>
            <ChevronRight className="h-3 w-3 text-[var(--muted-foreground)]" />
            {isLast ? (
              <span className="font-semibold text-[var(--foreground)] truncate max-w-xs">{formatted}</span>
            ) : (
              <Link href={href} className="hover:text-[var(--foreground)] transition-colors truncate max-w-xs">
                {formatted}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
