'use client'

import * as React from 'react'
import { PageHeader } from './nk-page-header'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BookOpen, Search, ChevronRight, HardHat, ShieldCheck, Wrench, Cog } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface GuideTome {
  slug: string
  title: string
  icon: React.ReactNode
  role: string
  recommended?: boolean
}

const TOMES: GuideTome[] = [
  { slug: 'designer', title: 'Конструктору', icon: <HardHat className="size-5" />, role: 'engineer', recommended: true },
  { slug: 'normo', title: 'Нормоконтролёру', icon: <ShieldCheck className="size-5" />, role: 'normocontroller' },
  { slug: 'admin', title: 'Администратору', icon: <Wrench className="size-5" />, role: 'admin' },
  { slug: 'tech', title: 'Техническое', icon: <Cog className="size-5" />, role: 'admin' },
]

export function Guide() {
  const [activeSlug, setActiveSlug] = React.useState('designer')
  const [content, setContent] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [searchResults, setSearchResults] = React.useState<{ slug: string; title: string; snippet: string }[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setLoading(true)
    fetch(`/api/guide/${activeSlug}`).then(r => r.json()).then(d => {
      setContent(d.content || '')
      setLoading(false)
    })
  }, [activeSlug])

  // Search across all tomes
  React.useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return }
    const q = search.toLowerCase()
    Promise.all(TOMES.map(t => fetch(`/api/guide/${t.slug}`).then(r => r.json()).then(d => ({ tome: t, content: d.content || '' }))))
      .then(results => {
        const matches: { slug: string; title: string; snippet: string }[] = []
        for (const r of results) {
          const lines = r.content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(q)) {
              const start = Math.max(0, i - 1)
              const end = Math.min(lines.length, i + 2)
              matches.push({
                slug: r.tome.slug,
                title: r.tome.title,
                snippet: lines.slice(start, end).join(' ').slice(0, 120) + '...',
              })
              break
            }
          }
        }
        setSearchResults(matches)
      })
  }, [search])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Руководство"
        description="Выберите том по вашей роли или используйте поиск"
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по всем томам..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Search results */}
      {search.trim() && searchResults.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-1">
            {searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => { setActiveSlug(r.slug); setSearch('') }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted/50"
              >
                <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                <span className="font-medium">{r.title}</span>
                <span className="text-muted-foreground line-clamp-1">— {r.snippet}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {!search.trim() && (
        <>
          {/* Tome cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TOMES.map(t => (
              <Card
                key={t.slug}
                className={`cursor-pointer transition-all hover:border-primary/50 hover:shadow-md ${activeSlug === t.slug ? 'border-primary ring-1 ring-primary/20' : ''}`}
                onClick={() => setActiveSlug(t.slug)}
              >
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className={`rounded-lg p-3 ${activeSlug === t.slug ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'}`}>
                    {t.icon}
                  </div>
                  <div className="font-medium text-sm">{t.title}</div>
                  {t.recommended && (
                    <span className="text-[10px] text-emerald-600 font-medium">Рекомендуется для вас</span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="prose prose-sm dark:prose-invert max-w-none
              [&_table]:border-collapse [&_table]:w-full
              [&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:text-sm
              [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm
              [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs
              [&_pre]:rounded-md [&_pre]:bg-muted/50 [&_pre]:p-4 [&_pre]:overflow-x-auto
              [&_img]:rounded-md [&_img]:border [&_img]:max-w-full [&_img]:h-auto
              [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3
              [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2
              [&_h3]:text-base [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:mb-2
              [&_p]:my-2 [&_p]:leading-relaxed
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2
              [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2
              [&_li]:my-1
              [&_a]:text-primary [&_a]:underline
              [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground
            ">
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <BookOpen className="size-4 animate-pulse" />
                  Загрузка...
                </div>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
