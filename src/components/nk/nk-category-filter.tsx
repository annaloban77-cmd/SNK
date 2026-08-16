'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface CategoryFilterOption {
  category: string
  label: string
  count: number
  color?: string
}

export interface CategoryFilterProps {
  options: CategoryFilterOption[]
  value: string | undefined
  onChange: (category: string) => void
  allLabel?: string
  className?: string
}

export function CategoryFilter({
  options,
  value,
  onChange,
  allLabel = 'Все',
  className,
}: CategoryFilterProps) {
  const totalAll = options.reduce((acc, o) => acc + o.count, 0)
  const items: CategoryFilterOption[] = [
    { category: 'all', label: allLabel, count: totalAll, color: '#64748b' },
    ...options,
  ]
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {items.map((o) => {
        const active = (value ?? 'all') === o.category
        return (
          <button
            key={o.category}
            type="button"
            onClick={() => onChange(o.category)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
              active
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {o.color ? (
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: o.color }}
              />
            ) : null}
            <span>{o.label}</span>
            <span
              className={cn(
                'tabular-nums',
                active ? 'text-background/70' : 'text-muted-foreground/70'
              )}
            >
              {o.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
