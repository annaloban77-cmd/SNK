// DTO mapping helpers for API routes
// Note: leading underscore prefix prevents Next.js App Router from treating
// this directory as a route segment.

import type {
  DocumentDto,
  IssueDto,
  RuleDto,
  StandardDto,
  StampFields,
} from '@/lib/types'
import type { ExtractedStamp } from '@/lib/zai'

type DocWithRelations = {
  id: string
  projectId: string | null
  name: string
  originalName: string
  mimeType: string
  size: number
  format: string
  sourceType: string
  status: string
  stampJson: string | null
  ocrText: string | null
  issueCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  checkDuration: number | null
  docTypeId: string | null
  createdAt: Date
  updatedAt: Date
  project?: { id: string; code: string; name: string } | null
}

export function parseStamp(json: string | null): StampFields | null {
  if (!json) return null
  try {
    const parsed = JSON.parse(json) as StampFields
    return parsed
  } catch {
    return null
  }
}

export function mapDocument(doc: DocWithRelations): DocumentDto {
  return {
    id: doc.id,
    projectId: doc.projectId,
    name: doc.name,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    size: doc.size,
    format: doc.format,
    sourceType: doc.sourceType as DocumentDto['sourceType'],
    status: doc.status as DocumentDto['status'],
    stamp: parseStamp(doc.stampJson),
    ocrText: doc.ocrText,
    issueCount: doc.issueCount,
    highCount: doc.highCount,
    mediumCount: doc.mediumCount,
    lowCount: doc.lowCount,
    checkDuration: doc.checkDuration,
    docTypeId: doc.docTypeId,
    project: doc.project
      ? { id: doc.project.id, code: doc.project.code, name: doc.project.name }
      : null,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date(doc.createdAt).toISOString(),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : new Date(doc.updatedAt).toISOString(),
  }
}

type IssueWithRelations = {
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
  severity: string
  status: string
  source: string
  evidence: string | null
  createdAt: Date
  updatedAt: Date
  document?: { id: string; name: string; format: string } | null
  rule?: { id: string; code: string; name: string } | null
}

export function mapIssue(i: IssueWithRelations): IssueDto {
  return {
    id: i.id,
    documentId: i.documentId,
    ruleId: i.ruleId,
    code: i.code,
    title: i.title,
    description: i.description,
    requirement: i.requirement,
    recommendation: i.recommendation,
    gostRef: i.gostRef,
    field: i.field,
    severity: i.severity as IssueDto['severity'],
    status: i.status as IssueDto['status'],
    source: i.source as IssueDto['source'],
    evidence: i.evidence,
    createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : new Date(i.createdAt).toISOString(),
    updatedAt: i.updatedAt instanceof Date ? i.updatedAt.toISOString() : new Date(i.updatedAt).toISOString(),
    document: i.document
      ? { id: i.document.id, name: i.document.name, format: i.document.format }
      : null,
    rule: i.rule ? { id: i.rule.id, code: i.rule.code, name: i.rule.name } : null,
  }
}

type RuleWithRelations = {
  id: string
  code: string
  name: string
  description: string
  category: string
  method: string
  severity: string
  gostField: string | null
  expression: string | null
  enabled: boolean
  standardId: string | null
  createdAt: Date
  updatedAt: Date
  standard?: { id: string; code: string; name: string } | null
}

export function mapRule(r: RuleWithRelations): RuleDto {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    category: r.category as RuleDto['category'],
    method: r.method as RuleDto['method'],
    severity: r.severity as RuleDto['severity'],
    gostField: r.gostField,
    expression: r.expression,
    enabled: r.enabled,
    standardId: r.standardId,
    standard: r.standard
      ? { id: r.standard.id, code: r.standard.code, name: r.standard.name }
      : null,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : new Date(r.createdAt).toISOString(),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : new Date(r.updatedAt).toISOString(),
  }
}

type StandardWithRules = {
  id: string
  code: string
  name: string
  type: string
  scope: string
  description: string | null
  status: string
  publishedAt: string | null
  createdAt: Date
  updatedAt: Date
  _count?: { rules: number }
  rules?: RuleWithRelations[]
}

export function mapStandard(s: StandardWithRules, withRules = false): StandardDto {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    type: s.type as StandardDto['type'],
    scope: s.scope,
    description: s.description,
    status: s.status as StandardDto['status'],
    publishedAt: s.publishedAt,
    rulesCount: s._count?.rules ?? (s.rules?.length ?? 0),
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : new Date(s.createdAt).toISOString(),
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : new Date(s.updatedAt).toISOString(),
    // extend with rules for /api/standards/[id]
    ...((withRules && s.rules)
      ? { rules: s.rules.map(mapRule) }
      : {}),
  } as StandardDto & { rules?: RuleDto[] }
}

// Coerce an arbitrary ExtractedStamp (from VLM) into a plain StampFields
// serialisable object suitable for stampJson storage.
export function stampToStorage(s: ExtractedStamp | null): string | null {
  if (!s) return null
  return JSON.stringify(s)
}

export function iso(d: Date | string): string {
  if (d instanceof Date) return d.toISOString()
  return new Date(d).toISOString()
}
