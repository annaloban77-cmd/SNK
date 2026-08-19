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
  StandardClauseDto,
  DashboardStats,
  AnalyzeResponse,
  Severity,
  IssueStatus,
  OrganizationDto,
  UserDto,
  ApiKeyDto,
  ApiKeyWithSecret,
  AuditLogDto,
  SubscriptionDto,
  UsageStats,
  StandardsStats,
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
  category?: string
  source?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface AuditFilters {
  action?: string
  userId?: string
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

export interface PlanItem {
  id: string
  name: string
  price: number
  currency: string
  interval: string
  maxDocuments: number
  maxChecks: number
  maxUsers: number
  maxApiRequests?: number
  highlighted?: boolean
  features: string[]
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

export interface CreateProjectPayload {
  code: string
  name: string
  description?: string
  stage: string
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: CreateProjectPayload) => {
      return apiFetch<ProjectItem>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(vars),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Проект создан')
    },
    onError: (e: Error) => toast.error('Ошибка создания: ' + e.message),
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

export function useStandardsStats() {
  return useQuery<StandardsStats>({
    queryKey: ['standards-stats'],
    queryFn: () => apiFetch<StandardsStats>('/api/standards/stats'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useStandardClauses(id: string | null) {
  return useQuery<{ items: StandardClauseDto[] }>({
    queryKey: ['standard-clauses', id],
    queryFn: () =>
      apiFetch<{ items: StandardClauseDto[] }>(
        `/api/standards/${id}/clauses`
      ),
    enabled: !!id,
  })
}

// ---------- Organization & Monetization Queries ----------

export function useOrganization() {
  return useQuery<OrganizationDto>({
    queryKey: ['organization'],
    queryFn: () => apiFetch<OrganizationDto>('/api/organization'),
    staleTime: 60 * 1000,
  })
}

export function useOrgUsers() {
  return useQuery<{ items: UserDto[] }>({
    queryKey: ['org-users'],
    queryFn: () => apiFetch<{ items: UserDto[] }>('/api/organization/users'),
  })
}

export function useApiKeys() {
  return useQuery<{ items: ApiKeyDto[] }>({
    queryKey: ['api-keys'],
    queryFn: () =>
      apiFetch<{ items: ApiKeyDto[] }>('/api/organization/api-keys'),
  })
}

export function useAuditLog(filters: AuditFilters = {}) {
  return useQuery<{
    items: AuditLogDto[]
    total: number
    page: number
    pageSize: number
  }>({
    queryKey: ['audit', filters],
    queryFn: () =>
      apiFetch<{
        items: AuditLogDto[]
        total: number
        page: number
        pageSize: number
      }>(
        `/api/organization/audit${buildQS(filters as Record<string, unknown>)}`
      ),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })
}

export function useUsageStats() {
  return useQuery<UsageStats>({
    queryKey: ['usage'],
    queryFn: () => apiFetch<UsageStats>('/api/organization/usage'),
    staleTime: 30 * 1000,
  })
}

export function useSubscription() {
  return useQuery<SubscriptionDto>({
    queryKey: ['subscription'],
    queryFn: () =>
      apiFetch<SubscriptionDto>('/api/organization/subscription'),
  })
}

export function usePlans() {
  return useQuery<{ items: PlanItem[] } | PlanItem[]>({
    queryKey: ['plans'],
    queryFn: async () => {
      const data = await apiFetch<unknown>('/api/organization/plans')
      // Endpoint may return either an array or { items: [] }
      if (Array.isArray(data)) return data as PlanItem[]
      return data as { items: PlanItem[] }
    },
    staleTime: 30 * 60 * 1000,
  })
}

/** Trigger HTML report download for a document. Not a hook. */
export function downloadReport(documentId: string) {
  if (typeof window === 'undefined') return
  window.open(`/api/reports/${documentId}/html`, '_blank')
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

export function useRetryDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string }) => {
      return apiFetch<DocumentDto>(`/api/documents/${vars.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'retry' }),
      })
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['document', vars.id] })
      qc.invalidateQueries({ queryKey: ['documents'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['document-issues', vars.id] })
      qc.invalidateQueries({ queryKey: ['checklog', vars.id] })
      toast.success('Документ сброшен, можно повторить проверку')
    },
    onError: (e: Error) => toast.error('Ошибка сброса: ' + e.message),
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

export interface CreateRulePayload {
  code: string
  name: string
  description: string
  category: string
  method: string
  severity: string
  gostField?: string
  expression?: string
  standardId?: string
}

export function useCreateRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: CreateRulePayload) => {
      return apiFetch<RuleDto>(`/api/rules`, {
        method: 'POST',
        body: JSON.stringify(vars),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rules'] })
      toast.success('Правило создано')
    },
    onError: (e: Error) => toast.error('Ошибка создания: ' + e.message),
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

// ---------- Organization & Monetization Mutations ----------

export function useUpdateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      name?: string
      contactEmail?: string
      contactPhone?: string
    }) => {
      return apiFetch<OrganizationDto>('/api/organization', {
        method: 'PATCH',
        body: JSON.stringify(vars),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organization'] })
      qc.invalidateQueries({ queryKey: ['usage'] })
      toast.success('Организация обновлена')
    },
    onError: (e: Error) => toast.error('Ошибка сохранения: ' + e.message),
  })
}

export function useInviteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      email: string
      name: string
      role: 'admin' | 'normocontroller' | 'engineer' | 'viewer'
    }) => {
      return apiFetch<UserDto>('/api/organization/users', {
        method: 'POST',
        body: JSON.stringify(vars),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-users'] })
      qc.invalidateQueries({ queryKey: ['organization'] })
      qc.invalidateQueries({ queryKey: ['usage'] })
      toast.success('Пользователь приглашён')
    },
    onError: (e: Error) => toast.error('Ошибка приглашения: ' + e.message),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      id: string
      role?: 'admin' | 'normocontroller' | 'engineer' | 'viewer'
      status?: 'active' | 'disabled' | 'pending'
    }) => {
      return apiFetch<UserDto>(`/api/organization/users/${vars.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          role: vars.role,
          status: vars.status,
        }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-users'] })
      toast.success('Пользователь обновлён')
    },
    onError: (e: Error) => toast.error('Ошибка: ' + e.message),
  })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      name: string
      scopes: string
      expiresAt?: string
    }) => {
      return apiFetch<ApiKeyWithSecret>('/api/organization/api-keys', {
        method: 'POST',
        body: JSON.stringify(vars),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api-keys'] })
      qc.invalidateQueries({ queryKey: ['organization'] })
      qc.invalidateQueries({ queryKey: ['usage'] })
    },
    onError: (e: Error) => toast.error('Ошибка создания ключа: ' + e.message),
  })
}

export function useUpdateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      id: string
      status: 'active' | 'revoked' | 'expired'
    }) => {
      return apiFetch<ApiKeyDto>(`/api/organization/api-keys/${vars.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: vars.status }),
      })
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['api-keys'] })
      qc.invalidateQueries({ queryKey: ['audit'] })
      toast.success(
        vars.status === 'revoked'
          ? 'API-ключ отозван'
          : 'Статус ключа обновлён'
      )
    },
    onError: (e: Error) => toast.error('Ошибка: ' + e.message),
  })
}

export function useDeleteApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string }) => {
      return apiFetch<{ success: boolean }>(
        `/api/organization/api-keys/${vars.id}`,
        { method: 'DELETE' }
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api-keys'] })
      qc.invalidateQueries({ queryKey: ['organization'] })
      qc.invalidateQueries({ queryKey: ['usage'] })
      qc.invalidateQueries({ queryKey: ['audit'] })
      toast.success('API-ключ удалён')
    },
    onError: (e: Error) => toast.error('Ошибка удаления: ' + e.message),
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

// ===== BENCH =====
export interface BenchStatus {
  lastRun: {
    id: string; version: string; status: string; benchStatus: string | null
    recall: number | null; precision: number | null; recallHigh: number | null
    coordAccuracy: number | null
    totalSamples: number; passedSamples: number; failedSamples: number
    totalExpected: number; totalFound: number; totalMatched: number
    totalFalsePos: number; totalFalseNeg: number
    durationMs: number | null; startedAt: string; finishedAt: string | null
    findingsCount: number
  } | null
  runningRun: { id: string; version: string; startedAt: string; progress: { processed: number; total: number } | null } | null
  samples: { total: number; correct: number; withErrors: number }
  history: {
    id: string; version: string; benchStatus: string | null; status: string
    recall: number | null; precision: number | null; recallHigh: number | null
    passedSamples: number; failedSamples: number; totalSamples: number
    durationMs: number | null; startedAt: string
  }[]
}

export function useBenchStatus() {
  return useQuery<BenchStatus>({
    queryKey: ['bench-status'],
    queryFn: () => apiFetch<BenchStatus>('/api/bench/run'),
    refetchInterval: 5000, // авто-рефреш каждые 5с (для отслеживания прогресса)
  })
}

export function useRunBench() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { runLlm?: boolean; version?: string }) =>
      apiFetch<{ success: boolean; runId: string }>('/api/bench/run', {
        method: 'POST',
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bench-status'] })
      toast.success('Прогон стенда запущен')
    },
    onError: (e: Error) => toast.error('Ошибка запуска: ' + e.message),
  })
}

export function useBenchResults(runId?: string) {
  return useQuery({
    queryKey: ['bench-results', runId],
    queryFn: () => apiFetch<any>(`/api/bench/results/${runId}`),
    enabled: !!runId,
  })
}

export function useBenchResultsList(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['bench-results-list', page, pageSize],
    queryFn: () => apiFetch<any>(`/api/bench/results?page=${page}&pageSize=${pageSize}`),
  })
}

export function useBenchSamples(category?: string) {
  const qs = category && category !== 'all' ? `?category=${category}` : ''
  return useQuery({
    queryKey: ['bench-samples', category],
    queryFn: () => apiFetch<any>(`/api/bench/samples${qs}`),
  })
}
