import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'critical' | 'success' | 'warning';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'border-transparent bg-[var(--primary)] text-[var(--primary-foreground)]',
    secondary: 'border-transparent bg-[var(--secondary)] text-[var(--secondary-foreground)]',
    destructive: 'border-transparent bg-[var(--destructive)] text-[var(--destructive-foreground)]',
    outline: 'border-[var(--border)] text-[var(--foreground)]',
    critical: 'border-transparent bg-rose-600 text-white font-semibold animate-pulse',
    success: 'border-transparent bg-emerald-600 text-white',
    warning: 'border-transparent bg-amber-500 text-white',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
