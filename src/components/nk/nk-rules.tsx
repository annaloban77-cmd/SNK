'use client'

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, ListChecks, RefreshCw, Eye, FlaskConical } from 'lucide-react'
import { toast } from 'sonner'
import {
  useRules,
  useUpdateRule,
  useCreateRule,
  useStandards,
  type RuleFilters,
  type CreateRulePayload,
} from '@/hooks/use-nk-api'
import { PageHeader } from './nk-page-header'
import { EmptyState, ErrorState } from './nk-empty-state'
import { SeverityBadge } from './nk-severity-badge'
import {
  categoryLabel,
  methodLabel,
  methodHint,
  formatDate,
} from './nk-format'
import type { RuleDto, Severity } from '@/lib/types'

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Все категории' },
  { value: 'stamp', label: 'Штамп' },
  { value: 'specification', label: 'Спецификация' },
  { value: 'material', label: 'Материал' },
  { value: 'cad_attr', label: 'CAD-атрибуты' },
  { value: 'format', label: 'Формат' },
  { value: 'geometry', label: 'Геометрия' },
  { value: 'semantic', label: 'Семантика' },
]

const CATEGORY_FORM_OPTIONS = CATEGORY_OPTIONS.filter((o) => o.value !== 'all')

const METHOD_OPTIONS = [
  { value: 'all', label: 'Все методы' },
  { value: 'deterministic', label: 'Автопроверка по формату' },
  { value: 'semantic', label: 'Проверка смысла (ИИ)' },
  { value: 'vision', label: 'Проверка чертежа (ИИ)' },
]

const METHOD_FORM_OPTIONS = METHOD_OPTIONS.filter((o) => o.value !== 'all')

const SEVERITY_FORM_OPTIONS = [
  { value: 'high', label: 'Высокая' },
  { value: 'medium', label: 'Средняя' },
  { value: 'low', label: 'Низкая' },
]

const ENABLED_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'true', label: 'Активные' },
  { value: 'false', label: 'Отключённые' },
]

const CATEGORY_BADGE_STYLE: Record<string, string> = {
  stamp: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900',
  specification: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-900',
  material: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900',
  cad_attr: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900',
  format: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900',
  geometry: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:border-cyan-900',
  semantic: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700',
}

export function Rules() {
  const [filters, setFilters] = React.useState<RuleFilters>({
    category: 'all',
    method: 'all',
    enabled: 'all',
    search: '',
    page: 1,
    pageSize: 50,
  })
  const [searchBox, setSearchBox] = React.useState(filters.search ?? '')
  React.useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchBox, page: 1 }))
    }, 350)
    return () => clearTimeout(t)
  }, [searchBox])

  // Pre-fill the search box when navigating from another view (e.g., GostDialog in IssueCard).
  // The GostDialog sets sessionStorage['nk:rules:search'] = ruleCode and switches view to 'rules'.
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const preset = window.sessionStorage.getItem('nk:rules:search')
      if (preset) {
        setSearchBox(preset)
        window.sessionStorage.removeItem('nk:rules:search')
      }
    } catch {
      // ignore sessionStorage availability
    }
  }, [])

  const { data, isLoading, isError, refetch, isFetching } = useRules(filters)

  const [selectedRule, setSelectedRule] = React.useState<RuleDto | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)

  function setField<K extends keyof RuleFilters>(k: K, v: RuleFilters[K]) {
    setFilters((f) => ({ ...f, [k]: v, page: 1 }))
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Правила"
        description="Детерминированные и ИИ-правила нормоконтроля"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw
                className={isFetching ? 'size-4 animate-spin' : 'size-4'}
              />
              Обновить
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast.info('Проверка на тестовых документах', {
                  description: 'В разработке — скоро будет доступно',
                })
              }
            >
              <FlaskConical className="size-4" />
              Проверить на тестовых документах
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Создать правило
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Категория
            </label>
            <Select
              value={filters.category ?? 'all'}
              onValueChange={(v) => setField('category', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Метод
            </label>
            <Select
              value={filters.method ?? 'all'}
              onValueChange={(v) => setField('method', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHOD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Статус
            </label>
            <Select
              value={filters.enabled ?? 'all'}
              onValueChange={(v) => setField('enabled', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENABLED_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Поиск
            </label>
            <Input
              placeholder="Код, название, ГОСТ…"
              value={searchBox}
              onChange={(e) => setSearchBox(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isError ? (
            <div className="p-6">
              <ErrorState
                message="Не удалось загрузить правила"
                onRetry={() => refetch()}
              />
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (data?.items ?? []).length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<ListChecks className="size-6" />}
                title="Правила не найдены"
                description="Измените фильтры"
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Код</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead>Метод</TableHead>
                  <TableHead>Критичность</TableHead>
                  <TableHead>ГОСТ-поле</TableHead>
                  <TableHead>Стандарт</TableHead>
                  <TableHead className="text-center">Включено</TableHead>
                  <TableHead className="pr-4 text-right">Детали</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((r) => (
                  <RuleRow
                    key={r.id}
                    rule={r}
                    onOpen={() => setSelectedRule(r)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Всего: {data?.total ?? 0}
      </div>

      <RuleDetailDialog
        rule={selectedRule}
        onOpenChange={(v) => !v && setSelectedRule(null)}
      />

      <CreateRuleDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}

function RuleRow({
  rule,
  onOpen,
}: {
  rule: RuleDto
  onOpen: () => void
}) {
  const update = useUpdateRule()
  return (
    <TableRow className="cursor-pointer" onClick={onOpen}>
      <TableCell className="pl-6">
        <Badge variant="outline" className="font-mono text-xs">
          {rule.code}
        </Badge>
      </TableCell>
      <TableCell className="max-w-[260px]">
        <div className="truncate text-sm font-medium">{rule.name}</div>
        <div className="line-clamp-1 text-xs text-muted-foreground">
          {rule.description}
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={`text-xs ${CATEGORY_BADGE_STYLE[rule.category] ?? ''}`}
        >
          {categoryLabel(rule.category)}
        </Badge>
      </TableCell>
      <TableCell className="text-xs">{methodLabel(rule.method)}</TableCell>
      <TableCell>
        <SeverityBadge severity={rule.severity} />
      </TableCell>
      <TableCell className="text-xs font-mono">
        {rule.gostField ?? '—'}
      </TableCell>
      <TableCell className="text-xs">
        {rule.standard ? (
          <span className="font-mono">{rule.standard.code}</span>
        ) : (
          <span className="text-muted-foreground/60">—</span>
        )}
      </TableCell>
      <TableCell
        className="text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Switch
          checked={rule.enabled}
          onCheckedChange={(v) =>
            update.mutate({ id: rule.id, data: { enabled: v } })
          }
        />
      </TableCell>
      <TableCell className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>
        <Button size="icon" variant="ghost" onClick={onOpen}>
          <Eye className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

function RuleDetailDialog({
  rule,
  onOpenChange,
}: {
  rule: RuleDto | null
  onOpenChange: (v: boolean) => void
}) {
  const update = useUpdateRule()
  const [severity, setSeverity] = React.useState<Severity>('medium')

  React.useEffect(() => {
    if (rule) setSeverity(rule.severity)
  }, [rule])

  if (!rule) {
    return (
      <Dialog open={false} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    )
  }

  return (
    <Dialog open={!!rule} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {rule.code}
            </Badge>
            <span>{rule.name}</span>
          </DialogTitle>
          <DialogDescription>{rule.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Категория
              </div>
              <div>{categoryLabel(rule.category)}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Метод
              </div>
              <div>{methodLabel(rule.method)}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                ГОСТ-поле
              </div>
              <div className="font-mono">{rule.gostField ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Стандарт
              </div>
              <div>
                {rule.standard ? (
                  <span className="font-mono">{rule.standard.code}</span>
                ) : (
                  '—'
                )}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Создано
              </div>
              <div>{formatDate(rule.createdAt)}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Обновлено
              </div>
              <div>{formatDate(rule.updatedAt)}</div>
            </div>
          </div>

          {rule.expression ? (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Выражение
              </div>
              <pre className="mt-1 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
                {rule.expression}
              </pre>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="severity">Критичность</Label>
              <Select
                value={severity}
                onValueChange={(v) => setSeverity(v as Severity)}
              >
                <SelectTrigger id="severity" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Высокая</SelectItem>
                  <SelectItem value="medium">Средняя</SelectItem>
                  <SelectItem value="low">Низкая</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={
                  update.isPending || severity === rule.severity
                }
                onClick={() =>
                  update.mutate({
                    id: rule.id,
                    data: { severity },
                  })
                }
              >
                Сохранить критичность
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant={rule.enabled ? 'destructive' : 'default'}
            onClick={() =>
              update.mutate({
                id: rule.id,
                data: { enabled: !rule.enabled },
              })
            }
            disabled={update.isPending}
          >
            {rule.enabled ? 'Отключить правило' : 'Включить правило'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateRuleDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const create = useCreateRule()
  const standardsQ = useStandards({ pageSize: 100 })
  const [isAdmin] = React.useState<boolean>(() => readCurrentRole() === 'admin')

  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [category, setCategory] = React.useState('stamp')
  const [method, setMethod] = React.useState('deterministic')
  const [severity, setSeverity] = React.useState<Severity>('medium')
  const [gostField, setGostField] = React.useState('')
  // Raw JSON kept in `expression`; the friendly form below writes to it.
  const [expression, setExpression] = React.useState('')
  const [standardId, setStandardId] = React.useState('__none__')
  // Friendly rule-constructor state (auto-assembled into `expression`).
  const [ruleField, setRuleField] = React.useState('designation')
  const [ruleCondition, setRuleCondition] = React.useState('empty')
  const [ruleValue, setRuleValue] = React.useState('')
  const [engineerMode, setEngineerMode] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setCode('')
      setName('')
      setDescription('')
      setCategory('stamp')
      setMethod('deterministic')
      setSeverity('medium')
      setGostField('')
      setExpression('')
      setStandardId('__none__')
      setRuleField('designation')
      setRuleCondition('empty')
      setRuleValue('')
      setEngineerMode(false)
    }
  }, [open])

  // Auto-assemble JSON from the friendly form fields whenever they change
  // (unless the user is editing the raw JSON in engineer mode).
  React.useEffect(() => {
    if (engineerMode) return
    const assembled = buildRuleExpression({
      field: ruleField,
      condition: ruleCondition,
      value: ruleValue,
    })
    setExpression(assembled)
  }, [ruleField, ruleCondition, ruleValue, engineerMode])

  function handleSubmit() {
    const payload: CreateRulePayload = {
      code: code.trim(),
      name: name.trim(),
      description: description.trim(),
      category,
      method,
      severity,
      gostField: gostField.trim() || undefined,
      expression: expression.trim() || undefined,
      standardId: standardId === '__none__' ? undefined : standardId,
    }
    create.mutate(payload, {
      onSuccess: () => {
        onOpenChange(false)
      },
    })
  }

  const canSubmit =
    code.trim() &&
    name.trim() &&
    description.trim() &&
    !create.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Создать правило нормоконтроля</DialogTitle>
          <DialogDescription>
            Новое правило будет добавлено в базу знаний и станет доступно для
            проверок после включения.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rule-code">Код правила</Label>
            <Input
              id="rule-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="R-XXX-001"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-name">Название</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Короткое название правила"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-desc">Описание</Label>
            <Textarea
              id="rule-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Что проверяет правило и при каких условиях срабатывает"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rule-cat">Категория</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="rule-cat" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_FORM_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-method">Метод</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="rule-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHOD_FORM_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {methodHint(method)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-sev">Критичность</Label>
              <Select
                value={severity}
                onValueChange={(v) => setSeverity(v as Severity)}
              >
                <SelectTrigger id="rule-sev" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_FORM_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-std">ГОСТ (стандарт)</Label>
              <Select value={standardId} onValueChange={setStandardId}>
                <SelectTrigger id="rule-std" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Без стандарта</SelectItem>
                  {(standardsQ.data?.items ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="font-mono">{s.code}</span> · {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-gost">ГОСТ-поле (текстом)</Label>
            <Input
              id="rule-gost"
              value={gostField}
              onChange={(e) => setGostField(e.target.value)}
              placeholder="Например: ГОСТ 2.104-2006"
            />
          </div>

          <RuleConstructor
            field={ruleField}
            condition={ruleCondition}
            value={ruleValue}
            engineerMode={engineerMode}
            isAdmin={isAdmin}
            rawExpression={expression}
            onFieldChange={setRuleField}
            onConditionChange={setRuleCondition}
            onValueChange={setRuleValue}
            onEngineerModeChange={setEngineerMode}
            onRawExpressionChange={setExpression}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.info('Проверка на тестовых документах', {
                description: 'В разработке — скоро будет доступно',
              })
            }
          >
            <FlaskConical className="size-4" />
            Проверить на тестовых документах
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {create.isPending ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Создать правило
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Rule constructor — human-friendly replacement for the raw JSON textarea.
// Пользователь выбирает «что проверяем» и «условие», а JSON-выражение для
// детерминированного движка собирается автоматически. Администратор может
// включить «Режим инженера» и править JSON вручную.
// ============================================================================

type Role = 'admin' | 'normocontroller' | 'engineer' | 'viewer'

/** Прочитать текущую роль из cookie `nk-role` (тот же механизм, что в RoleSwitcher). */
function readCurrentRole(): Role {
  if (typeof document === 'undefined') return 'admin'
  const match = document.cookie.match(/(?:^|;\s*)nk-role=([^;]+)/)
  const r = match?.[1]
  if (r === 'admin' || r === 'normocontroller' || r === 'engineer' || r === 'viewer') {
    return r
  }
  return 'admin'
}

/** Опции поля «Что проверяем» — каждое значение = ключ в StampFields. */
const RULE_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: 'designation', label: 'Обозначение' },
  { value: 'name', label: 'Наименование' },
  { value: 'scale', label: 'Масштаб' },
  { value: 'mass', label: 'Масса' },
  { value: 'material', label: 'Материал' },
  { value: 'letter', label: 'Литера' },
  { value: 'stage', label: 'Стадия' },
  { value: 'format', label: 'Формат' },
  { value: 'signatures.developed', label: 'Подпись: Разраб' },
  { value: 'signatures.checked', label: 'Подпись: Пров' },
  { value: 'signatures.normControl', label: 'Подпись: Н.контр' },
  { value: 'signatures.approved', label: 'Подпись: Утв' },
  { value: 'gostReferences', label: 'ГОСТ-перечень' },
  { value: 'technicalRequirements', label: 'Технические требования (ТТ)' },
]

/** Опции поля «Условие» — тип проверки. */
const RULE_CONDITION_OPTIONS: {
  value: string
  label: string
  hint: string
}[] = [
  {
    value: 'empty',
    label: 'Не заполнено',
    hint: 'Поле пустое или отсутствует в штампе.',
  },
  {
    value: 'regex',
    label: 'Не соответствует шаблону',
    hint: 'Значение должно соответствовать регулярному выражению (шаблону).',
  },
  {
    value: 'lookup',
    label: 'Отсутствует в справочнике',
    hint: 'Значение должно входить в список разрешённых (через запятую).',
  },
  {
    value: 'range',
    label: 'Значение вне диапазона',
    hint: 'Числовое значение должно быть в диапазоне «мин-макс».',
  },
]

/**
 * Собрать JSON-выражение правила из трёх дружелюбных полей.
 * Возвращает пустую строку, если ничего не выбрано / значение не нужно.
 */
function buildRuleExpression(input: {
  field: string
  condition: string
  value: string
}): string {
  const { field, condition, value } = input
  const trimmed = value.trim()

  switch (condition) {
    case 'empty':
      return JSON.stringify({ field, check: 'empty' }, null, 2)
    case 'regex':
      if (!trimmed) return JSON.stringify({ field, check: 'regex' }, null, 2)
      return JSON.stringify(
        { field, check: 'regex', pattern: trimmed },
        null,
        2
      )
    case 'lookup':
      if (!trimmed) return JSON.stringify({ field, check: 'lookup' }, null, 2)
      return JSON.stringify(
        { field, check: 'lookup', values: trimmed },
        null,
        2
      )
    case 'range':
      if (!trimmed) return JSON.stringify({ field, check: 'range' }, null, 2)
      return JSON.stringify(
        { field, check: 'range', range: trimmed },
        null,
        2
      )
    default:
      return ''
  }
}

/** Подсказка-плейсхолдер для поля «Шаблон/значение» в зависимости от условия. */
function ruleValuePlaceholder(condition: string): string {
  switch (condition) {
    case 'empty':
      return 'Не требуется — условие проверяет только пустоту поля'
    case 'regex':
      return '^[А-ЯA-Z0-9]+\\.[А-ЯA-Z0-9]+\\.[А-ЯA-Z0-9]+$'
    case 'lookup':
      return 'Сталь 09Г2С, Сталь 10, Сталь 20 (через запятую)'
    case 'range':
      return '0.1-500 (мин-макс, в кг / мм / etc)'
    default:
      return ''
  }
}

function RuleConstructor({
  field,
  condition,
  value,
  engineerMode,
  isAdmin,
  rawExpression,
  onFieldChange,
  onConditionChange,
  onValueChange,
  onEngineerModeChange,
  onRawExpressionChange,
}: {
  field: string
  condition: string
  value: string
  engineerMode: boolean
  isAdmin: boolean
  rawExpression: string
  onFieldChange: (v: string) => void
  onConditionChange: (v: string) => void
  onValueChange: (v: string) => void
  onEngineerModeChange: (v: boolean) => void
  onRawExpressionChange: (v: string) => void
}) {
  const condHint =
    RULE_CONDITION_OPTIONS.find((o) => o.value === condition)?.hint ?? ''

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Конструктор условия
        </Label>
        {isAdmin ? (
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={engineerMode}
              onCheckedChange={onEngineerModeChange}
              aria-label="Режим инженера"
            />
            Режим инженера (raw JSON)
          </label>
        ) : null}
      </div>

      {engineerMode && isAdmin ? (
        <div className="space-y-1.5">
          <Label htmlFor="rule-expr">Выражение / параметры (JSON)</Label>
          <Textarea
            id="rule-expr"
            value={rawExpression}
            onChange={(e) => onRawExpressionChange(e.target.value)}
            placeholder={
              '{\n  "field": "designation",\n  "check": "regex",\n  "pattern": "^[А-ЯA-Z0-9]+\\\\.[А-ЯA-Z0-9]+$"\n}'
            }
            rows={5}
            className="font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            Сырое JSON-выражение. Доступно только администратору для отладки
            и сложных случаев, не покрываемых конструктором.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rule-field">Что проверяем</Label>
            <Select value={field} onValueChange={onFieldChange}>
              <SelectTrigger id="rule-field" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RULE_FIELD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-condition">Условие</Label>
            <Select value={condition} onValueChange={onConditionChange}>
              <SelectTrigger id="rule-condition" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RULE_CONDITION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rule-value">Шаблон / значение</Label>
            <Input
              id="rule-value"
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              placeholder={ruleValuePlaceholder(condition)}
              disabled={condition === 'empty'}
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">{condHint}</p>
          </div>

          {/* Предпросмотр собираемого JSON — чтобы пользователь видел результат. */}
          <div className="sm:col-span-2">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              JSON-выражение (собирается автоматически)
            </div>
            <pre className="mt-1 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-[11px]">
              {rawExpression || '—'}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
