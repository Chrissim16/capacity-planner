import { clsx } from 'clsx';
import type { HTMLAttributes } from 'react';

/**
 * Base shimmer strip.
 * Width / height are controlled by the caller via className.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        'rounded-md bg-gradient-to-r',
        'from-mw-grey-light via-white to-mw-grey-light',
        'dark:from-mw-muted-dark dark:via-mw-card-border-dark dark:to-mw-muted-dark',
        'bg-[length:200%_100%] animate-shimmer',
        className
      )}
      {...props}
    />
  );
}

/** Single text-line skeleton */
export function SkeletonLine({
  className,
  width = 'w-full',
}: { className?: string; width?: string }) {
  return <Skeleton className={clsx('h-4', width, className)} />;
}

/** Skeleton for a page section heading */
export function SkeletonHeading({ className }: { className?: string }) {
  return <Skeleton className={clsx('h-6 w-48', className)} />;
}

/** Skeleton that looks like a Card with a header + content lines */
export function SkeletonCard({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading…"
      className={clsx(
        'rounded-card border border-mw-grey-light dark:border-mw-card-border-dark',
        'bg-white dark:bg-mw-surface-dark p-5 space-y-4',
        className
      )}
    >
      <SkeletonHeading />
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonLine
            key={i}
            width={i === lines - 1 ? 'w-3/5' : 'w-full'}
          />
        ))}
      </div>
    </div>
  );
}

/** Skeleton for a table / list of rows */
export function SkeletonList({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading…"
      className={clsx('space-y-2', className)}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3 rounded-lg
                     border border-mw-grey-light dark:border-mw-card-border-dark
                     bg-white dark:bg-mw-surface-dark"
        >
          {/* Avatar placeholder */}
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonLine width="w-2/5" />
            <SkeletonLine width="w-1/4" className="h-3" />
          </div>
          {/* Badge placeholder */}
          <Skeleton className="h-5 w-16 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for a Gantt chart — header row + N bar rows */
export function SkeletonGantt({
  rows = 8,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  const widths = ['w-1/2', 'w-2/3', 'w-1/3', 'w-3/4', 'w-2/5', 'w-1/2', 'w-3/5', 'w-1/4'];
  const offsets = ['ml-0', 'ml-4', 'ml-8', 'ml-2', 'ml-12', 'ml-6', 'ml-0', 'ml-10'];

  return (
    <div
      aria-busy="true"
      aria-label="Loading chart…"
      className={clsx('space-y-1', className)}
    >
      {/* Column header */}
      <div className="flex gap-2 px-4 py-2">
        <Skeleton className="h-4 w-48 shrink-0" />
        <div className="flex-1 flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>

      {/* Bar rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-2
                     border-b border-mw-grey-light dark:border-mw-card-border-dark"
        >
          {/* Label column */}
          <Skeleton className={clsx('h-4 shrink-0', widths[i % widths.length])} style={{ maxWidth: '12rem' }} />
          {/* Bar track */}
          <div className="flex-1 flex items-center">
            <Skeleton
              className={clsx('h-5 rounded', widths[i % widths.length], offsets[i % offsets.length])}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
