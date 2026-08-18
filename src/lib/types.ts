// Общие типы для API-контракта между backend и frontend

export type Severity = 'high' | 'medium' | 'low'
export type IssueStatus = 'new' | 'confirmed' | 'rejected' | 'fixed'
export type RuleMethod = 'deterministic' | 'semantic' | 'vision'
export type RuleCategory =
  | 'stamp'
  | 'specification'
  | 'material'
  | 'cad_attr'
  | 'format'
  | 'geometry'
  | 'semantic'
export type StandardType = 'GOST' | 'OST' | 'STO' | 'RD' | 'REGISTER' | 'ESKD' | 'SPDS'
export type DocumentStatus = 'new' | 'processing' | 'analyzed' | 'failed'
export type DocumentSource =
  | 'scan'
  | 'pdf'
  | 'dwg'
  | 'dxf'
  | 'cdw'
  | 'sldprt'
  | 'sldasm'
  | 'slddrw'
  | 'spw'

export interface StampFields {
  format?: string | null
  designation?: string | null
  name?: string | null
  scale?: string | null
  mass?: string | null
  material?: string | null
  letter?: string | null
  stage?: string | null
  signatures?: {
    developed?: string | null
    checked?: string | null
    normControl?: string | null
    approved?: string | null
  } | null
  dates?: {
    developed?: string | null
    checked?: string | null
    approved?: string | null
  } | null
  invNumber?: string | null
  technicalRequirements?: string[] | null
  gostReferences?: string[] | null
  documentType?: string | null
  sheetCount?: number | null
  notes?: string | null
}

// Унифицированный DTO документа (для списков и карточек)
export interface DocumentDto {
  id: string
  projectId: string | null
  name: string
  originalName: string
  mimeType: string
  size: number
  format: string
  sourceType: DocumentSource
  status: DocumentStatus
  stamp: StampFields | null
  ocrText: string | null
  issueCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  checkDuration: number | null
  docTypeId: string | null
  project?: { id: string; code: string; name: string } | null
  createdAt: string
  updatedAt: string
}

export interface IssueDto {
  id: string
  documentId: string
  ruleId: string | null
  code: string
  title: string
  description: string
  requirement: string | null
  recommendation: string | null
  gostRef: string | null
  field: string | null
  severity: Severity
  status: IssueStatus
  source: 'auto' | 'expert' | 'llm'
  evidence: string | null
  createdAt: string
  updatedAt: string
  document?: { id: string; name: string; format: string } | null
  rule?: { id: string; code: string; name: string } | null
}

export interface RuleDto {
  id: string
  code: string
  name: string
  description: string
  category: RuleCategory
  method: RuleMethod
  severity: Severity
  gostField: string | null
  expression: string | null
  enabled: boolean
  standardId: string | null
  standard?: { id: string; code: string; name: string } | null
  createdAt: string
  updatedAt: string
}

export interface StandardDto {
  id: string
  code: string
  name: string
  type: StandardType
  scope: string
  description: string | null
  status: 'active' | 'cancelled' | 'draft'
  publishedAt: string | null
  rulesCount: number
  // Extended fields (Task 3-a)
  category: string | null
  source: string
  sourceUrl: string | null
  clausesCount: number
  createdAt: string
  updatedAt: string
}

export interface DashboardStats {
  totalDocuments: number
  analyzedDocuments: number
  processingDocuments: number
  pendingDocuments: number
  totalIssues: number
  highIssues: number
  mediumIssues: number
  lowIssues: number
  confirmedIssues: number
  fixedIssues: number
  avgCheckDurationMs: number | null
  passRate: number // % документов без высоких замечаний
  // распределения для графиков
  issuesBySeverity: { name: string; value: number; color: string }[]
  documentsByStatus: { name: string; value: number; color: string }[]
  documentsByFormat: { name: string; value: number }[]
  issuesByCategory: { name: string; value: number }[]
  checksLast14Days: { date: string; count: number; issues: number }[]
  recentDocuments: DocumentDto[]
  topIssues: { code: string; title: string; count: number; severity: Severity }[]
  // Extension (Task 3-a) — knowledge base stats
  standardsCount?: number
  rulesCount?: number
  categoriesCount?: number
  referenceCount?: number
  dbVersion?: string
  // Business metrics (P5)
  avgCheckTimeSec?: number | null
  firstTimePassRate?: number
  totalChecks?: number
  estimatedHoursSaved?: number
  estimatedCostSaved?: number
}

export interface AnalyzeResponse {
  documentId: string
  status: DocumentStatus
  stamp: StampFields | null
  issues: IssueDto[]
  checkDurationMs: number
  stages: { stage: string; status: string; durationMs: number | null; message?: string }[]
}

// ============ MONETIZATION & EXTENDED DTOs (Task 3-a) ============

export type StandardCategory =
  | 'eskd'
  | 'estd'
  | 'espd'
  | 'spds'
  | 'welding'
  | 'materials'
  | 'tolerances'
  | 'shipbuilding'
  | 'register'
  | 'rd'
  | 'sto'

export interface StandardClauseDto {
  id: string
  standardId: string
  number: string
  title: string
  text: string
  severity: Severity
  createdAt: string
}

// NOTE: StandardDto above already includes the extended fields (category, source, sourceUrl, clausesCount).
// ApiKeyWithSecret is returned only ONCE on ApiKey creation.

export interface OrganizationDto {
  id: string
  name: string
  slug: string
  inn: string | null
  contactEmail: string | null
  contactPhone: string | null
  plan: 'free' | 'pro' | 'enterprise'
  maxDocuments: number
  maxChecks: number
  maxUsers: number
  status: 'active' | 'suspended' | 'cancelled'
  trialEndsAt: string | null
  createdAt: string
  updatedAt: string
  // Usage stats (computed)
  documentsCount: number
  checksThisMonth: number
  usersCount: number
  apiKeysCount: number
}

export interface UserDto {
  id: string
  email: string
  name: string | null
  role: 'admin' | 'normocontroller' | 'engineer' | 'viewer'
  organizationId: string | null
  status: 'active' | 'disabled' | 'pending'
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ApiKeyDto {
  id: string
  organizationId: string
  name: string
  keyPrefix: string
  // keyHash NEVER exposed
  scopes: string
  requestsCount: number
  requestsLimit: number
  periodStart: string
  lastUsedAt: string | null
  expiresAt: string | null
  status: 'active' | 'revoked' | 'expired'
  createdAt: string
  updatedAt: string
}

export interface ApiKeyWithSecret extends ApiKeyDto {
  secret: string // only returned ONCE at creation
}

export interface AuditLogDto {
  id: string
  organizationId: string | null
  userId: string | null
  action: string
  resourceType: string | null
  resourceId: string | null
  details: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user?: { id: string; email: string; name: string | null } | null
}

export interface SubscriptionDto {
  id: string
  organizationId: string
  plan: 'free' | 'pro' | 'enterprise'
  status: 'active' | 'past_due' | 'cancelled' | 'trialing'
  amount: number
  currency: string
  interval: 'month' | 'year'
  currentPeriodStart: string
  currentPeriodEnd: string | null
  cancelAt: string | null
  paymentProvider: string | null
  externalId: string | null
  createdAt: string
  updatedAt: string
}

export interface UsageStats {
  organizationId: string
  plan: string
  documentsCount: number
  maxDocuments: number
  documentsPercent: number
  checksThisMonth: number
  maxChecks: number
  checksPercent: number
  usersCount: number
  maxUsers: number
  apiKeysCount: number
  apiRequestsThisMonth: number
  maxApiRequests: number
  trialDaysLeft: number | null
}

export interface StandardsStats {
  total: number
  byCategory: { category: string; label: string; count: number; color: string }[]
  byType: { type: string; count: number }[]
  bySource: { source: string; count: number }[]
  activeCount: number
  withClausesCount: number
}
