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
}

export interface AnalyzeResponse {
  documentId: string
  status: DocumentStatus
  stamp: StampFields | null
  issues: IssueDto[]
  checkDurationMs: number
  stages: { stage: string; status: string; durationMs: number | null; message?: string }[]
}
