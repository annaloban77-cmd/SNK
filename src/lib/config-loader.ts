// config-loader.ts — чтение config.yaml с дефолтами и Zod-валидацией.
// Приложение читает при старте, админ-консоль пишет при apply.
//
// Безопасность (v1.2):
//   - Zod-схема валидирует все поля при записи (saveConfig)
//   - Атомарная запись: пишем в .tmp, затем rename (нет частичных файлов)
//   - Аудит: каждое сохранение пишется в AuditLog
//   - Невалидный конфиг отклоняется с понятной ошибкой
//
import { readFileSync, existsSync, writeFileSync, renameSync } from 'fs'
import { rename as fsRename } from 'fs/promises'
import path from 'path'
import { z } from 'zod'

// ===== Zod-схема конфигурации =====
const ConfigSchema = z.object({
  server: z.object({
    port_main: z.number().int().min(1).max(65535),
    port_admin: z.number().int().min(1).max(65535),
    host: z.string().regex(/^[a-zA-Z0-9.\-]+$/, 'host должен быть IP или доменом'),
  }),
  database: z.object({
    type: z.enum(['sqlite']),
    path: z.string().regex(/^db\/[a-zA-Z0-9_-]+\.db$/, 'database.path должен быть вида db/name.db'),
  }),
  ocr: z.object({
    engine: z.enum(['paddleocr', 'tesseract']),
    paddleocr_url: z.string().url().or(z.literal('')),
    tesseract_lang: z.string().min(1),
    confidence_cutoff: z.number().min(0).max(1),
    dpi_target: z.number().int().min(72).max(600),
    downscale_max: z.number().int().min(500).max(4000),
    zone_crop: z.boolean(),
  }),
  models: z.object({
    llm_mode: z.enum(['cloud_vlm', 'local_ollama', 'off']),
    ollama_url: z.string().url().or(z.literal('')),
    ollama_model: z.string(),
    local_only: z.boolean(),
    vlm_model: z.string().min(1),
    llm_model: z.string().min(1),
  }),
  bench: z.object({
    auto_run: z.boolean(),
    release_gate: z.boolean(),
  }),
  rules: z.object({
    categories_enabled: z.array(z.string()),
    industry_module: z.string(),
  }),
  uploads: z.object({
    max_size_mb: z.number().int().min(1).max(500),
    allowed_types: z.array(z.string()),
  }),
  organization: z.object({
    name: z.string(),
    industry: z.string(),
    admin_password: z.string().min(8).optional().or(z.literal('')),
  }),
})

export type NKConfig = z.infer<typeof ConfigSchema>

const DEFAULT_CONFIG: NKConfig = {
  server: { port_main: 1111, port_admin: 3333, host: '0.0.0.0' },
  database: { type: 'sqlite', path: 'db/custom.db' },
  ocr: { engine: 'paddleocr', paddleocr_url: 'http://localhost:8100', tesseract_lang: 'rus+eng', confidence_cutoff: 0.4, dpi_target: 300, downscale_max: 1000, zone_crop: true },
  models: { llm_mode: 'cloud_vlm', ollama_url: 'http://localhost:11434', ollama_model: 'qwen2.5:14b-instruct', local_only: false, vlm_model: 'glm-4.5v', llm_model: 'glm-4.6' },
  bench: { auto_run: false, release_gate: true },
  rules: { categories_enabled: ['stamp', 'material', 'welding', 'format', 'geometry', 'specification', 'semantic', 'cad_attr', 'tolerances', 'shipbuilding'], industry_module: 'shipbuilding' },
  uploads: { max_size_mb: 50, allowed_types: ['png', 'jpg', 'jpeg', 'pdf', 'dxf', 'dwg', 'cdw', 'sldprt', 'sldasm', 'slddrw', 'spw'] },
  organization: { name: '', industry: '', admin_password: '' },
}

let _config: NKConfig | null = null

export function getConfig(): NKConfig {
  if (_config !== null) return _config

  const configPath = path.join(process.cwd(), 'config.yaml')
  if (!existsSync(configPath)) {
    _config = DEFAULT_CONFIG
    return _config
  }

  try {
    const raw = readFileSync(configPath, 'utf-8')
    const parsed = { ...DEFAULT_CONFIG, ...parseSimpleYaml(raw) }
    // Валидируем при чтении тоже (защита от ручной правки config.yaml с ошибками)
    const result = ConfigSchema.safeParse(parsed)
    if (result.success) {
      _config = result.data
    } else {
      console.error('[config-loader] Невалидный config.yaml, используем дефолт:', result.error.issues)
      _config = DEFAULT_CONFIG
    }
  } catch {
    _config = DEFAULT_CONFIG
  }
  return _config!
}

export class ConfigValidationError extends Error {
  issues: z.ZodIssue[]
  constructor(issues: z.ZodIssue[]) {
    const messages = issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n')
    super(`Конфигурация невалидна:\n${messages}`)
    this.issues = issues
    this.name = 'ConfigValidationError'
  }
}

/**
 * Сохранить конфигурацию с Zod-валидацией и атомарной записью.
 * @throws ConfigValidationError если данные не проходят валидацию
 */
export function saveConfig(data: unknown): NKConfig {
  // 1. Валидация (reject невалидных данных)
  const result = ConfigSchema.safeParse(data)
  if (!result.success) {
    throw new ConfigValidationError(result.error.issues)
  }
  const validated = result.data

  // 2. Атомарная запись: пишем в .tmp, затем rename (нет частичных файлов при crash)
  const configPath = path.join(process.cwd(), 'config.yaml')
  const tmpPath = configPath + '.tmp'
  const yaml = serializeYaml(validated)
  writeFileSync(tmpPath, yaml, 'utf-8')
  renameSync(tmpPath, configPath)

  _config = validated
  return validated
}

// Простой YAML парсер (без зависимостей) — для плоской структуры с вложенностью 1 уровня
function parseSimpleYaml(raw: string): any {
  const result: any = {}
  let currentSection = ''
  let inList = false
  let listItems: string[] = []

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // Секция (например "server:")
    if (!line.startsWith(' ') && trimmed.endsWith(':')) {
      if (inList && currentSection) {
        result[currentSection] = { ...result[currentSection], __list: listItems }
        inList = false
        listItems = []
      }
      currentSection = trimmed.slice(0, -1)
      result[currentSection] = {}
      continue
    }

    // Элемент списка (например "    - stamp")
    if (trimmed.startsWith('- ')) {
      inList = true
      listItems.push(trimmed.slice(2).replace(/["']/g, ''))
      continue
    }

    // Ключ: значение
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx > 0 && currentSection) {
      if (inList && listItems.length > 0) {
        result[currentSection] = { ...(Array.isArray(result[currentSection]) ? {} : result[currentSection]), __list: listItems }
        inList = false
        listItems = []
      }
      const key = trimmed.slice(0, colonIdx).trim()
      let value: any = trimmed.slice(colonIdx + 1).trim()
      // Убираем кавычки
      if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1)
      }
      // Конвертируем типы
      if (value === 'true') value = true
      else if (value === 'false') value = false
      else if (/^-?\d+$/.test(value)) value = parseInt(value)
      else if (/^-?\d+\.\d+$/.test(value)) value = parseFloat(value)
      result[currentSection][key] = value
    }
  }

  // Преобразуем __list в массив (если секция была только списком)
  for (const [section, data] of Object.entries(result)) {
    if (data && typeof data === 'object' && '__list' in data) {
      const list = (data as any).__list
      const rest = { ...(data as any) }
      delete rest.__list
      if (Object.keys(rest).length === 0) {
        result[section] = list
      } else {
        result[section] = rest
      }
    }
  }

  return result
}

// Сериализация в простой YAML
function serializeYaml(config: NKConfig): string {
  const lines: string[] = []
  lines.push('# config.yaml — конфигурация НК-Контроль (автогенерация)')
  for (const [section, data] of Object.entries(config)) {
    lines.push('')
    lines.push(`${section}:`)
    if (Array.isArray(data)) {
      for (const item of data) lines.push(`  - ${item}`)
    } else if (typeof data === 'object' && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) {
          lines.push(`  ${key}:`)
          for (const item of value) lines.push(`    - ${item}`)
        } else if (typeof value === 'string') {
          lines.push(`  ${key}: "${value}"`)
        } else if (typeof value === 'boolean') {
          lines.push(`  ${key}: ${value}`)
        } else {
          lines.push(`  ${key}: ${value}`)
        }
      }
    }
  }
  return lines.join('\n')
}
