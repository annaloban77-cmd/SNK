'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, Star } from 'lucide-react'
import type { PlanItem } from '@/hooks/use-nk-api'

export interface PlanCardProps {
  plan: PlanItem
  current?: boolean
  onSelect?: (plan: PlanItem) => void
  className?: string
}

function formatPrice(price: number, currency: string, interval: string): string {
  if (price === 0) return 'Бесплатно'
  const sym = currency === 'RUB' ? '₽' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : ''
  const value = new Intl.NumberFormat('ru-RU').format(price)
  const suffix = interval === 'month' ? '/мес' : interval === 'year' ? '/год' : ''
  return `${sym}${value} ${suffix}`.trim()
}

export function PlanCard({ plan, current, onSelect, className }: PlanCardProps) {
  return (
    <Card
      className={cn(
        'relative flex flex-col overflow-hidden',
        plan.highlighted && !current
          ? 'border-emerald-300 ring-1 ring-emerald-200 dark:border-emerald-800 dark:ring-emerald-900/50'
          : '',
        current ? 'border-emerald-500 ring-2 ring-emerald-200 dark:border-emerald-700 dark:ring-emerald-900/60' : '',
        className
      )}
    >
      {plan.highlighted ? (
        <div className="absolute right-0 top-0 rounded-bl-lg bg-emerald-500 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Популярный
        </div>
      ) : null}
      {current ? (
        <div className="absolute right-0 top-0 rounded-bl-lg bg-emerald-600 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Текущий
        </div>
      ) : null}
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {plan.highlighted ? (
            <Star className="size-4 text-amber-500" />
          ) : null}
          {plan.name}
        </CardTitle>
        <CardDescription className="text-2xl font-bold text-foreground">
          {formatPrice(plan.price, plan.currency, plan.interval)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Limit label="Документов" value={plan.maxDocuments} />
          <Limit label="Проверок" value={plan.maxChecks} />
          <Limit label="Пользователей" value={plan.maxUsers} />
          <Limit label="API-запросов" value={plan.maxApiRequests ?? 0} />
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Возможности
          </div>
          <ul className="space-y-1.5">
            {plan.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          className="w-full"
          variant={current ? 'outline' : plan.highlighted ? 'default' : 'outline'}
          disabled={current}
          onClick={() => onSelect?.(plan)}
        >
          {current ? 'Текущий тариф' : 'Выбрать тариф'}
        </Button>
      </CardFooter>
    </Card>
  )
}

function Limit({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums">
        {new Intl.NumberFormat('ru-RU').format(value)}
      </div>
    </div>
  )
}
