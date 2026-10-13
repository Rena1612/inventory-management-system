import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  /** Usually a row count, set in the tertiary ink so it never competes with the title. */
  count?: number | string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, count, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 border-b border-line pb-2',
        className,
      )}
    >
      <h1 className="text-[15px] font-semibold text-ink">
        {title}
        {count !== undefined && (
          <span className="ml-2 text-[13px] font-normal tabular-nums text-ink-3">{count}</span>
        )}
      </h1>
      {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

interface SectionHeadProps {
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}

/** Heading for one block of a page. Not a page title — no border, no rule. */
export function SectionHead({ children, aside, className }: SectionHeadProps) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', className)}>
      <h2 className="section-head">{children}</h2>
      {aside !== undefined && <div className="text-[12px] text-ink-3">{aside}</div>}
    </div>
  );
}