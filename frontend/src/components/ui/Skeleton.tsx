import { clsx } from 'clsx';
import type { HTMLAttributes } from 'react';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        'rounded-md bg-gradient-to-r',
        'from-[#F5F3F0] via-[#FAF9F7] to-[#F5F3F0]',
        'bg-[length:200%_100%] animate-shimmer',
        className
      )}
      {...props}
    />
  );
}

export function SkeletonLine({
  className,
  width = 'w-full',
}: { className?: string; width?: string }) {
  return <Skeleton className={clsx('h-4', width, className)} />;
}

export function SkeletonHeading({ className }: { className?: string }) {
  return <Skeleton className={clsx('h-6 w-48', className)} />;
}

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
        'rounded-card border border-[#F0EFED] bg-white p-6 space-y-4',
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
          className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[#F0EFED] bg-white"
        >
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonLine width="w-2/5" />
            <SkeletonLine width="w-1/4" className="h-3" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonGantt({
  rows = 8,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  const widths  = ['w-1/2', 'w-2/3', 'w-1/3', 'w-3/4', 'w-2/5', 'w-1/2', 'w-3/5', 'w-1/4'];
  const offsets = ['ml-0', 'ml-4', 'ml-8', 'ml-2', 'ml-12', 'ml-6', 'ml-0', 'ml-10'];

  return (
    <div
      aria-busy="true"
      aria-label="Loading chart…"
      className={clsx('space-y-1', className)}
    >
      <div className="flex gap-2 px-4 py-2">
        <Skeleton className="h-4 w-48 shrink-0" />
        <div className="flex-1 flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-2 border-b border-[#F0EFED]"
        >
          <Skeleton className={clsx('h-4 shrink-0', widths[i % widths.length])} style={{ maxWidth: '12rem' }} />
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
