'use client'

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import type {
  DocumentDto,
  IssueDto,
  RuleDto,
  StandardDto,
  DashboardStats,
  AnalyzeResponse,
  Severity,
  IssueStatus,
} from '@/lib/types'

// ---------- Types for filter payloads ----------

export interface DocumentFilters {
  status?: string
  format?: string
  sourceType?: string
  projectId?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface IssueFilters {
  severity?: string
  status?: string
  documentId?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface StandardFilters {
  type?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface RuleFilters {
  category?: string
  method?: string
  enabled?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface CheckLogEntry {
  id: string
  documentId: string
  stage: string
  status: string
  durationMs: number | null
  message: string | null
  createdAt: string
}

export interface SampleItem {
  id: string
  title: string
  description: string
  url: string
  available: boolean
}

export interface ProjectItem {
  id: string
  code: string
  name: string
  description: string | null
  stage: string
  status: string
  documentsCount: number
  createdAt: string
  updatedAt: string
}

// ---------- Low-level fetch helpers ----------

async function apiFetch<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
  })
  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!res.ok) {
    const msg =
      (data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `HTTP ${res.status}`) || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data as T
}

function buildQS(filters: Record<string, unknown>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v == null || v === '' || v === 'all') continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

// ---------- Queries ----------

export function useDashboard() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<DashboardStats>('/api/dashboard'),
  })
}

export function useDocuments(filters: DocumentFilters = {}) {
  return useQuery<{
    items: DocumentDto[]
    total: number
    page: number
    pageSize: number
  }>({
    queryKey: ['documents', filters],
    queryFn: () =>
      apiFetch<{
        items: DocumentDto[]
        total: number
        page: number
        pageSize: number
      }>(`/api/documents${buildQS(filters as Record<string, unknown>)}`),
    placeholderData: keepPreviousData,
  })
}

export function useDocument(id: string | null) {
  return useQuery<DocumentDto>({
    queryKey: ['document', id],
    queryFn: () => apiFetch<DocumentDto>(`/api/documents/${id}`),
    enabled: !!id,
  })
}

export function useDocumentIssues(
  id: string | null,
  filters: { severity?: string; status?: string } = {}
) {
  return useQuery<{ items: IssueDto[] }>({
    queryKey: ['document-issues', id, filters],
    queryFn: () =>
      apiFetch<{ items: IssueDto[] }>(
        `/api/documents/${id}/issues${buildQS(filters as Record<string, unknown>)}`
      ),
    enabled: !!id,
  })
}

export function useIssues(filters: IssueFilters = {}) {
  return useQuery<{
    items: IssueDto[]
    total: number
    page: number
    pageSize: number
  }>({
    queryKey: ['issues', filters],
    queryFn: () =>
      apiFetch<{
        items: IssueDto[]
        total: number
        page: number
        pageSize: number
      }>(`/api/issues${buildQS(filters as Record<string, unknown>)}`),
    placeholderData: keepPreviousData,
  })
}

export function useStandards(filters: StandardFilters = {}) {
  return useQuery<{
    items: StandardDto[]
    total: number
    page: number
    pageSize: number
  }>({
    queryKey: ['standards', filters],
    queryFn: () =>
      apiFetch<{
        items: StandardDto[]
        total: number
        page: number
        pageSize: number
      }>(`/api/standards${buildQS(filters as Record<string, unknown>)}`),
    placeholderData: keepPreviousData,
  })
}

export function useStandard(id: string | null) {
  return useQuery<StandardDto & { rules?: RuleDto[] }>({
    queryKey: ['standard', id],
    queryFn: () =>
      apiFetch<StandardDto & { rules?: RuleDto[] }>(`/api/standards/${id}`),
    enabled: !!id,
  })
}

export function useRules(filters: RuleFilters = {}) {
  return useQuery<{
    items: RuleDto[]
    total: number
    page: number
    pageSize: number
  }>({
    queryKey: ['rules', filters],
    queryFn: () =>
      apiFetch<{
        items: RuleDto[]
        total: number
        page: number
        pageSize: number
      }>(`/api/rules${buildQS(filters as Record<string, unknown>)}`),
    placeholderData: keepPreviousData,
  })
}

export function useProjects() {
  return useQuery<{ items: ProjectItem[] }>({
    queryKey: ['projects'],
    queryFn: () => apiFetch<{ items: ProjectItem[] }>('/api/projects'),
  })
}

export function useCheckLog(documentId: string | null) {
  return useQuery<{ items: CheckLogEntry[] }>({
    queryKey: ['checklog', documentId],
    queryFn: () =>
      apiFetch<{ items: CheckLogEntry[] }>(`/api/checklog/${documentId}`),
    enabled: !!documentId,
  })
}

export function useSamples() {
  return useQuery<{ items: SampleItem[] }>({
    queryKey: ['samples'],
    queryFn: () => apiFetch<{ items: SampleItem[] }>('/api/samples'),
  })
}

// ---------- Mutations ----------

export function useUploadDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      file: File
      projectId?: string
      sourceType?: string
      format?: string
    }) => {
      const fd = new FormData()
      fd.append('file', vars.file)
      if (vars.projectId) fd.append('projectId', vars.projectId)
      if (vars.sourceType) fd.append('sourceType', vars.sourceType)
      if (vars.format) fd.append('format', vars.format)
      return apiFetch<{ document: DocumentDto }>(
        '/api/documents/upload',
        { method: 'POST', body: fd }
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Документ загружен')
    },
    onError: (e: Error) => toast.error('Ошибка загрузки: ' + e.message),
  })
}

export function useAnalyzeDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string; runLlm?: boolean }) => {
      return apiFetch<AnalyzeResponse>(`/api/documents/${vars.id}/analyze`, {
        method: 'POST',
        body: JSON.stringify({ runLlm: vars.runLlm ?? true }),
      })
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ['document', vars.id] })
      qc.invalidateQueries({ queryKey: ['document-issues', vars.id] })
      qc.invalidateQueries({ queryKey: ['checklog', vars.id] })
      qc.invalidateQueries({ queryKey: ['documents'] })
      qc.invalidateQueries({ queryKey: ['issues'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      if (data.status === 'analyzed') {
        toast.success(
          `Проверка завершена за ${(data.checkDurationMs / 1000).toFixed(1)} с · найдено замечаний: ${data.issues.length}`
        )
      } else {
        toast.error('Проверка завершилась с ошибкой')
      }
    },
    onError: (e: Error) => toast.error('Ошибка анализа: ' + e.message),
  })
}

export function useUpdateIssue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string; status: IssueStatus }) => {
      return apiFetch<IssueDto>(`/api/issues/${vars.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: vars.status }),
      })
    },
    onSuccess: (_, vars) => {
      // Issues can be in any document — invalidate broadly
      qc.invalidateQueries({ queryKey: ['issues'] })
      qc.invalidateQueries({ queryKey: ['document-issues'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['documents'] })
      // Best-effort: invalidate the specific document-issues of the issue's doc
      // We don't know it here, so invalidate all
      void vars.id
      toast.success('Статус замечания обновлён')
    },
    onError: (e: Error) => toast.error('Ошибка: ' + e.message),
  })
}

export function useBulkIssues() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      ids: string[]
      action: 'confirm' | 'reject' | 'fix'
    }) => {
      return apiFetch<{ updated: number }>(`/api/issues/bulk`, {
        method: 'POST',
        body: JSON.stringify(vars),
      })
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['issues'] })
      qc.invalidateQueries({ queryKey: ['document-issues'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['documents'] })
      toast.success(`Обновлено замечаний: ${data.updated}`)
    },
    onError: (e: Error) => toast.error('Ошибка: ' + e.message),
  })
}

export function useUpdateRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      id: string
      data: Partial<Pick<RuleDto, 'enabled' | 'severity' | 'name' | 'description'>>
    }) => {
      return apiFetch<RuleDto>(`/api/rules/${vars.id}`, {
        method: 'PATCH',
        body: JSON.stringify(vars.data),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rules'] })
      toast.success('Правило обновлено')
    },
    onError: (e: Error) => toast.error('Ошибка: ' + e.message),
  })
}

export function useAnalyzeSample() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string; runLlm?: boolean }) => {
      const url = `/api/samples/${vars.id}/analyze${
        vars.runLlm === false ? '?runLlm=false' : ''
      }`
      return apiFetch<AnalyzeResponse>(url, { method: 'POST' })
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['documents'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      if (data.status === 'analyzed') {
        toast.success(
          `Тестовый чертёж проверен за ${(data.checkDurationMs / 1000).toFixed(1)} с · найдено замечаний: ${data.issues.length}`
        )
      } else {
        toast.error('Проверка завершилась с ошибкой')
      }
    },
    onError: (e: Error) => toast.error('Ошибка анализа: ' + e.message),
  })
}

// Severity helpers used by badges
export const SEVERITY_LABEL: Record<Severity, string> = {
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Низкая',
}

export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  new: 'Новое',
  confirmed: 'Подтверждено',
  rejected: 'Отклонено',
  fixed: 'Исправлено',
}
