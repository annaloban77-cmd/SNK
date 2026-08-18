// config-loader.ts — чтение config.yaml с дефолтами
// Приложение читает при старте, админ-консоль пишет при apply

import { readFileSync, existsSync, writeFileSync } from 'fs'
import path from 'path'

export interface NKConfig {
  server: { port_main: number; port_admin: number; host: string }
  database: { type: string; path: string }
  ocr: { engine: string; paddleocr_url: string; tesseract_lang: string; confidence_cutoff: number; dpi_target: number; downscale_max: number; zone_crop: boolean }
  models: { llm_mode: string; ollama_url: string; ollama_model: string; local_only: boolean; vlm_model: string; llm_model: string }
  bench: { auto_run: boolean; release_gate: boolean }
  rules: { categories_enabled: string[]; industry_module: string }
  uploads: { max_size_mb: number; allowed_types: string[] }
  organization: { name: string; industry: string; admin_password: string }
}

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
    _config = { ...DEFAULT_CONFIG, ...parseSimpleYaml(raw) } as NKConfig
  } catch {
    _config = DEFAULT_CONFIG
  }
  return _config!
}

export function saveConfig(config: Partial<NKConfig>): void {
  const current = getConfig()
  const merged = { ...current, ...config }
  const configPath = path.join(process.cwd(), 'config.yaml')
  writeFileSync(configPath, serializeYaml(merged))
  _config = merged
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
        result[currentSection] = [...result[currentSection] || [], ...listItems]
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
        result[currentSection] = [...(Array.isArray(result[currentSection]) ? result[currentSection] : []), ...listItems]
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
      else if (/^\d+$/.test(value)) value = parseInt(value)
      else if (/^\d+\.\d+$/.test(value)) value = parseFloat(value)
      result[currentSection][key] = value
    }
  }

  if (inList && currentSection && listItems.length > 0) {
    result[currentSection] = listItems
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
