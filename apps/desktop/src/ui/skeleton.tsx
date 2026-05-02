import type { HTMLAttributes } from 'react'
import { cn } from '@core/utils/cn'

/** Animated placeholder element used as a loading skeleton for content that is not yet available. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}
