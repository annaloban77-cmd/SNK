'use client'

import * as React from 'react'
import { PageHeader } from './nk-page-header'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BookOpen, Search, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import ReactMarkdown from 'react-markdown'

interface GuideSection {
  slug: string
  title: string
}

export function Guide() {
  const [sections, setSections] = React.useState<GuideSection[]>([])
  const [activeSlug, setActiveSlug] = React.useState('01-quick-start')
  const [content, setContent] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch('/api/guide').then(r => r.json()).then(d => setSections(d.items || []))
  }, [])

  React.useEffect(() => {
    setLoading(true)
    fetch(`/api/guide/${activeSlug}`).then(r => r.json()).then(d => {
      setContent(d.content || '')
      setLoading(false)
    })
  }, [activeSlug])

  const filtered = sections.filter(s =>
    !search || s.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Руководство"
        description="Пользовательское руководство системы НК-Контроль"
      />
      <div className="flex gap-4">
        {/* Sidebar with sections */}
        <div className="w-64 shrink-0">
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-1">
              {filtered.map(s => (
                <button
                  key={s.slug}
                  onClick={() => setActiveSlug(s.slug)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    activeSlug === s.slug
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  <ChevronRight className="size-3 shrink-0" />
                  <span className="line-clamp-1">{s.title}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <BookOpen className="size-4 animate-pulse" />
                Загрузка...
              </div>
            ) : (
              <ReactMarkdown>{content}</ReactMarkdown>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
