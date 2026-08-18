'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Ship,
  Sun,
  Moon,
  Menu,
  LayoutDashboard,
  FileText,
  AlertTriangle,
  BookOpen,
  ListChecks,
  FolderKanban,
  Upload,
  CircleDot,
  Settings,
  KeyRound,
  History,
  Sparkles,
  FlaskConical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNKStore, type NKView } from '@/stores/nk-store'
import {
  useDashboard,
  useStandardsStats,
  useOrganization,
} from '@/hooks/use-nk-api'
import { UploadDocumentDialog } from '@/components/nk/nk-upload-dialog'
import { Dashboard } from '@/components/nk/nk-dashboard'
import { Documents } from '@/components/nk/nk-documents'
import { DocumentDetail } from '@/components/nk/nk-document-detail'
import { Issues } from '@/components/nk/nk-issues'
import { KnowledgeBase } from '@/components/nk/nk-knowledge-base'
import { Rules } from '@/components/nk/nk-rules'
import { Projects } from '@/components/nk/nk-projects'
import { Settings as SettingsView } from '@/components/nk/nk-settings'
import { ApiKeys } from '@/components/nk/nk-api-keys'
import { AuditLog } from '@/components/nk/nk-audit-log'
import { Bench } from '@/components/nk/nk-bench'

interface NavItem {
  id: NKView
  label: string
  icon: React.ReactNode
  badge?: React.ReactNode
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Старт',
  pro: 'Профи',
  enterprise: 'Предприятие',
}

const PLAN_BADGE_CLS: Record<string, string> = {
  free:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700',
  pro:
    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-900',
  enterprise:
    'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-200 dark:border-violet-900',
}

export default function Home() {
  const { theme, setTheme } = useTheme()
  const isMobile = useIsMobile()
  const view = useNKStore((s) => s.view)
  const setView = useNKStore((s) => s.setView)
  const setMobileNavOpen = useNKStore((s) => s.setMobileNavOpen)
  const mobileNavOpen = useNKStore((s) => s.mobileNavOpen)
  const selectDocument = useNKStore((s) => s.selectDocument)

  const { data: dash } = useDashboard()
  const statsQ = useStandardsStats()
  const orgQ = useOrganization()

  const [uploadOpen, setUploadOpen] = React.useState(false)

  // Role-based UI: 'free' plan → viewer (read-only, no admin features)
  //                    'pro' / 'enterprise' → admin (full feature set)
  const plan = orgQ.data?.plan
  const isAdmin = plan === 'pro' || plan === 'enterprise'

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Дашборд', icon: <LayoutDashboard className="size-4" /> },
    {
      id: 'documents',
      label: 'Документы',
      icon: <FileText className="size-4" />,
      badge:
        dash && dash.pendingDocuments > 0 ? (
          <Badge
            variant="outline"
            className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-900"
          >
            {dash.pendingDocuments}
          </Badge>
        ) : undefined,
    },
    {
      id: 'issues',
      label: 'Замечания',
      icon: <AlertTriangle className="size-4" />,
      badge:
        dash && dash.highIssues > 0 ? (
          <Badge
            variant="outline"
            className="bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-200 dark:border-red-900"
          >
            {dash.highIssues}
          </Badge>
        ) : undefined,
    },
    { id: 'knowledge', label: 'База знаний', icon: <BookOpen className="size-4" /> },
    { id: 'rules', label: 'Правила', icon: <ListChecks className="size-4" /> },
    { id: 'projects', label: 'Проекты', icon: <FolderKanban className="size-4" /> },
    { id: 'settings', label: 'Настройки', icon: <Settings className="size-4" /> },
  ]
  // Admin-only items (visible on pro / enterprise plan)
  const adminNav: NavItem[] = isAdmin
    ? [
        { id: 'apikeys', label: 'API-ключи', icon: <KeyRound className="size-4" /> },
        { id: 'audit', label: 'Аудит', icon: <History className="size-4" /> },
        { id: 'bench', label: 'Стенд', icon: <FlaskConical className="size-4" /> },
      ]
    : []
  const allNavItems: NavItem[] = [...navItems, ...adminNav]

  function handleNav(v: NKView) {
    if (v !== 'document-detail') selectDocument(null)
    setView(v)
    setMobileNavOpen(false)
  }

  const viewContent = (() => {
    switch (view) {
      case 'dashboard':
        return <Dashboard />
      case 'documents':
        return <Documents />
      case 'document-detail':
        return <DocumentDetail />
      case 'issues':
        return <Issues />
      case 'knowledge':
        return <KnowledgeBase />
      case 'rules':
        return <Rules />
      case 'projects':
        return <Projects />
      case 'settings':
        return <SettingsView />
      case 'apikeys':
        return <ApiKeys />
      case 'audit':
        return <AuditLog />
      case 'bench':
        return <Bench />
      default:
        return <Dashboard />
    }
  })()

  const navList = (
    <nav className="flex flex-col gap-1 p-3">
      {allNavItems.map((item) => {
        const active = view === item.id
        return (
          <button
            key={item.id}
            onClick={() => handleNav(item.id)}
            className={cn(
              'group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <span className={cn(active ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground')}>
              {item.icon}
            </span>
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge}
          </button>
        )
      })}
    </nav>
  )

  const standardsCount = dash?.standardsCount ?? statsQ.data?.total ?? null
  const rulesCount = dash?.rulesCount ?? null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex h-14 items-center gap-3 px-4 md:px-6">
          {/* Mobile hamburger */}
          {isMobile ? (
            <Sheet
              open={mobileNavOpen}
              onOpenChange={setMobileNavOpen}
            >
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Меню">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="border-b p-4">
                  <SheetTitle className="flex items-center gap-2 text-left">
                    <Ship className="size-5 text-emerald-600" />
                    НК-Контроль
                  </SheetTitle>
                </SheetHeader>
                {navList}
              </SheetContent>
            </Sheet>
          ) : null}

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Ship className="size-5" />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold leading-tight">
                НК-Контроль
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight">
                Система нормативного контроля
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Organization / plan badge */}
            {orgQ.data ? (
              <button
                type="button"
                onClick={() => setView('settings')}
                className="hidden items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent sm:flex"
                title={`${orgQ.data.name} · план: ${PLAN_LABELS[orgQ.data.plan] ?? orgQ.data.plan}`}
              >
                <Sparkles className="size-3 text-emerald-500" />
                <span className="text-muted-foreground">{orgQ.data.slug}</span>
                <Badge
                  variant="outline"
                  className={cn('text-[10px]', PLAN_BADGE_CLS[orgQ.data.plan] ?? PLAN_BADGE_CLS.free)}
                >
                  {PLAN_LABELS[orgQ.data.plan] ?? orgQ.data.plan}
                </Badge>
              </button>
            ) : null}
            <div className="hidden items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs text-muted-foreground lg:flex">
              <CircleDot className="size-3 text-emerald-500" />
              Система активна
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Переключить тему"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="size-4" />
              <span className="hidden sm:inline">Загрузить документ</span>
              <span className="sm:hidden">Загрузить</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div className="flex flex-1">
        {!isMobile ? (
          <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r bg-card/40 md:block">
            <div className="flex h-full flex-col">
              {navList}
              <div className="mt-auto border-t p-3 text-[10px] text-muted-foreground">
                <div className="font-medium">ЕСКД · СПДС · Регистр РФ</div>
                <div className="mt-0.5">
                  Документов: {dash ? dash.totalDocuments : '…'}
                  {' · '} Справочников: {dash?.referenceCount ?? '…'}
                  {' · '} v{dash?.dbVersion ?? '…'}
                </div>
                {orgQ.data ? (
                  <div className="mt-0.5">
                    Организация: <span className="font-medium">{orgQ.data.slug}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        ) : null}

        <main className="min-w-0 flex-1 p-4 md:p-6">{viewContent}</main>
      </div>

      {/* Footer (sticky) */}
      <footer className="mt-auto border-t bg-card/40">
        <div className="flex flex-col items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground sm:flex-row md:px-6">
          <div>© 2026 Северо-Верфь · НК-Контроль v1.1</div>
          <div className="hidden items-center gap-3 sm:flex">
            <span className="rounded border px-1.5 py-0.5">ЕСКД</span>
            <span className="rounded border px-1.5 py-0.5">СПДС</span>
            <span className="rounded border px-1.5 py-0.5">Регистр РФ</span>
          </div>
          <div>
            База знаний: {standardsCount != null ? standardsCount : '…'} стандартов
            {' · '}
            {rulesCount != null ? rulesCount : '…'} правил
            {' · '}
            {dash?.referenceCount ?? '…'} справочников
            {' · '} v{dash?.dbVersion ?? '…'}
          </div>
        </div>
      </footer>

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={(docId) => {
          selectDocument(docId)
          setView('document-detail')
        }}
      />
    </div>
  )
}
