import type { StampFields, Severity, LlmIssueInput } from './types'
import type { ExtractedStamp } from './zai'

// Результат проверки одного правила
export interface RuleCheckResult {
  code: string
  title: string
  description: string
  requirement?: string
  recommendation?: string
  gostRef?: string
  field?: string
  severity: Severity
  source: 'auto' | 'llm'
  evidence?: string
}

const ALLOWED_FORMATS = ['A0', 'A1', 'A2', 'A3', 'A4']
const ALLOWED_SCALES = ['1:1', '1:2', '1:2.5', '1:4', '1:5', '1:10', '1:20', '1:50', '1:100', '2:1', '5:1', '10:1']
const ALLOWED_LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'О', 'О1']
const ALLOWED_STAGES = ['ЭП', 'ТП', 'РД', 'РК', 'РП', 'Р']

// Маска обозначения по схеме ХХХ.ХХХХХХ.ХХХ (разделители точка, 3 группы букв/цифр)
const DESIGNATION_RE = /^[А-ЯA-Z0-9]{1,6}\.[А-ЯA-Z0-9]{4,8}\.[А-ЯA-Z0-9]{2,4}$/

export interface DeterministicRule {
  code: string
  title: string
  description: string
  severity: Severity
  gostRef: string
  field: string
  // Метод проверки
  check: (stamp: StampFields) => RuleCheckResult | null
}

// Конвертируем ExtractedStamp (из VLM) в StampFields для проверок
export function toStampFields(s: ExtractedStamp | null | undefined): StampFields {
  if (!s) return {}
  return {
    format: (s.format as string) ?? null,
    designation: s.designation ?? null,
    name: s.name ?? null,
    scale: s.scale ?? null,
    mass: s.mass ?? null,
    material: s.material ?? null,
    letter: s.letter ?? null,
    stage: s.stage ?? null,
    signatures: {
      developed: s.signatures?.developed ?? null,
      checked: s.signatures?.checked ?? null,
      normControl: s.signatures?.normControl ?? null,
      approved: s.signatures?.approved ?? null,
    },
    dates: {
      developed: s.dates?.developed ?? null,
      checked: s.dates?.checked ?? null,
      approved: s.dates?.approved ?? null,
    },
    invNumber: s.invNumber ?? null,
    technicalRequirements: s.technicalRequirements ?? null,
    gostReferences: s.gostReferences ?? null,
    documentType: s.documentType ?? null,
    sheetCount: s.sheetCount ?? null,
    notes: s.notes ?? null,
  }
}

// ===== Детерминированные правила =====
export const DETERMINISTIC_RULES: DeterministicRule[] = [
  {
    code: 'R-FORMAT-001',
    title: 'Формат листа не соответствует ГОСТ 2.301',
    description: 'Формат листа должен быть одним из A0–A4 по ГОСТ 2.301.',
    severity: 'medium',
    gostRef: 'ГОСТ 2.301-68',
    field: 'Формат',
    check: (s) => {
      const f = (s.format || '').toUpperCase().trim()
      if (!f) return mkIssue('R-FORMAT-001', 'Формат листа не распознан', 'Поле "Формат" в основной надписи не заполнено или не распознано.', 'high', 'Формат', 'Указать формат листа (A0–A4) по ГОСТ 2.301.', 'Заполнить поле "Формат"', s.format ?? '')
      if (!ALLOWED_FORMATS.includes(f)) {
        return mkIssue('R-FORMAT-001', 'Недопустимый формат листа', `Формат "${f}" не входит в перечень допустимых (A0–A4).`, 'high', 'Формат', 'Заменить формат на один из допустимых: A0, A1, A2, A3, A4.', 'ГОСТ 2.301-68', f)
      }
      return null
    },
  },
  {
    code: 'R-STAMP-001',
    title: 'Отсутствует обозначение документа',
    description: 'Поле "Обозначение" в основной надписи обязательно.',
    severity: 'high',
    gostRef: 'ГОСТ 2.104-2006, п. 3',
    field: 'Обозначение',
    check: (s) => {
      if (!s.designation || !s.designation.trim()) {
        return mkIssue('R-STAMP-001', 'Отсутствует обозначение документа', 'Поле "Обозначение" в штампе не заполнено.', 'high', 'Обозначение', 'Заполнить обозначение по схеме организации-разработчика.', 'ГОСТ 2.104-2006', '')
      }
      return null
    },
  },
  {
    code: 'R-STAMP-002',
    title: 'Обозначение не соответствует шаблону',
    description: 'Обозначение должно соответствовать схеме ХХХ.ХХХХХХ.ХХХ.',
    severity: 'medium',
    gostRef: 'ГОСТ 2.201-80',
    field: 'Обозначение',
    check: (s) => {
      if (!s.designation) return null
      if (!DESIGNATION_RE.test(s.designation.trim())) {
        return mkIssue('R-STAMP-002', 'Структура обозначения некорректна', `Обозначение "${s.designation}" не соответствует схеме кодификации предприятия (ХХХ.ХХХХХХ.ХХХ).`, 'medium', 'Обозначение', 'Использовать формат обозначения, принятый на предприятии.', 'ГОСТ 2.201-80', s.designation)
      }
      return null
    },
  },
  {
    code: 'R-STAMP-003',
    title: 'Отсутствует наименование изделия',
    description: 'Поле "Наименование" в основной надписи обязательно.',
    severity: 'high',
    gostRef: 'ГОСТ 2.104-2006, п. 3',
    field: 'Наименование',
    check: (s) => {
      if (!s.name || !s.name.trim()) {
        return mkIssue('R-STAMP-003', 'Отсутствует наименование изделия', 'Поле "Наименование" в штампе не заполнено.', 'high', 'Наименование', 'Указать наименование изделия существительным в именительном падеже.', 'ГОСТ 2.104-2006', '')
      }
      return null
    },
  },
  {
    code: 'R-SCALE-001',
    title: 'Масштаб не соответствует ГОСТ 2.302',
    description: 'Масштаб должен быть из стандартного ряда.',
    severity: 'low',
    gostRef: 'ГОСТ 2.302-68',
    field: 'Масштаб',
    check: (s) => {
      if (!s.scale || !s.scale.trim()) {
        return mkIssue('R-SCALE-001', 'Масштаб не указан', 'Поле "Масштаб" в основной надписи не заполнено.', 'low', 'Масштаб', 'Указать масштаб из ряда ГОСТ 2.302.', 'ГОСТ 2.302-68', '')
      }
      const sc = s.scale.replace(/\s+/g, '').replace('.', ':')
      if (!ALLOWED_SCALES.includes(sc)) {
        return mkIssue('R-SCALE-001', 'Нестандартный масштаб', `Масштаб "${s.scale}" не входит в стандартный ряд ГОСТ 2.302.`, 'low', 'Масштаб', `Использовать масштаб из ряда: ${ALLOWED_SCALES.join(', ')}.`, 'ГОСТ 2.302-68', s.scale)
      }
      return null
    },
  },
  {
    code: 'R-MASS-001',
    title: 'Масса указана некорректно',
    description: 'Масса должна указываться в кг без лишних символов.',
    severity: 'medium',
    gostRef: 'ГОСТ 2.104-2006',
    field: 'Масса',
    check: (s) => {
      if (!s.mass || !s.mass.trim()) {
        return mkIssue('R-MASS-001', 'Масса не указана', 'Поле "Масса" не заполнено (для чертежей деталей обязательно).', 'medium', 'Масса', 'Указать массу в кг.', 'ГОСТ 2.104-2006', '')
      }
      const m = s.mass.trim()
      // Не должно заканчиваться точкой после "кг"
      if (/кг\.$/i.test(m)) {
        return mkIssue('R-MASS-001', 'Лишняя точка после единицы массы', `Масса указана как "${m}" — после "кг" не ставится точка.`, 'low', 'Масса', 'Убрать точку: записать "12,5 кг".', 'ГОСТ 2.104-2006', m)
      }
      // Должно содержать "кг"
      if (!/кг/i.test(m) && !/kg/i.test(m)) {
        return mkIssue('R-MASS-001', 'Не указана единица измерения массы', `Масса указана как "${m}" — отсутствует единица измерения "кг".`, 'low', 'Масса', 'Указать единицу измерения: "12,5 кг".', 'ГОСТ 2.104-2006', m)
      }
      return null
    },
  },
  {
    code: 'R-MAT-001',
    title: 'Не указан материал',
    description: 'Для чертежей деталей материал обязателен.',
    severity: 'high',
    gostRef: 'ГОСТ 2.104-2006',
    field: 'Материал',
    check: (s) => {
      if (!s.material || !s.material.trim()) {
        return mkIssue('R-MAT-001', 'Не указан материал', 'Поле "Материал" в штампе не заполнено.', 'high', 'Материал', 'Указать материал с обозначением по ГОСТ.', 'ГОСТ 2.104-2006', '')
      }
      return null
    },
  },
  {
    code: 'R-MAT-002',
    title: 'Материал без ссылки на ГОСТ',
    description: 'В обозначении материала должна быть ссылка на ГОСТ.',
    severity: 'medium',
    gostRef: 'ГОСТ 2.109-73',
    field: 'Материал',
    check: (s) => {
      if (!s.material) return null
      if (!/ГОСТ/i.test(s.material) && !/GOST/i.test(s.material)) {
        return mkIssue('R-MAT-002', 'В обозначении материала нет ГОСТ', `Материал "${s.material}" указан без ссылки на стандарт.`, 'medium', 'Материал', 'Дополнить обозначение материала ссылкой на ГОСТ (напр. "Сталь 09Г2С ГОСТ 19281-2014").', 'ГОСТ 2.109-73', s.material)
      }
      return null
    },
  },
  {
    code: 'R-MAT-003',
    title: 'ГОСТ материала отсутствует в перечне применённых стандартов',
    description: 'Все ссылочные ГОСТ должны быть указаны в перечне.',
    severity: 'high',
    gostRef: 'ГОСТ 2.104-2006',
    field: 'Материал',
    check: (s) => {
      if (!s.material || !s.gostReferences || s.gostReferences.length === 0) return null
      const matches = s.material.match(/ГОСТ\s*[\s-]?\s*(\d[\d-]*)/gi) || []
      for (const m of matches) {
        const num = m.replace(/ГОСТ/i, '').replace(/[\s-]/g, '').trim()
        const inList = s.gostReferences.some((g) => g.replace(/ГОСТ/i, '').replace(/[\s-]/g, '').trim().startsWith(num))
        if (!inList) {
          return mkIssue('R-MAT-003', 'ГОСТ материала отсутствует в перечне', `В материале указан ${m.replace(/\s+/g, ' ').trim()}, но в перечне ссылочных документов его нет.`, 'high', 'Материал', 'Добавить ГОСТ материала в перечень применённых стандартов или уточнить обозначение.', 'ГОСТ 2.104-2006', s.material)
        }
      }
      return null
    },
  },
  {
    code: 'R-LETTER-001',
    title: 'Литера не указана',
    description: 'Поле "Литера" в основной надписи обязательно.',
    severity: 'medium',
    gostRef: 'ГОСТ 2.103-68',
    field: 'Литера',
    check: (s) => {
      if (!s.letter || !s.letter.trim()) {
        return mkIssue('R-LETTER-001', 'Литера не указана', 'Поле "Литера" не заполнено.', 'medium', 'Литера', 'Указать литеру документа (А, Б, О и т.д.) согласно стадии разработки.', 'ГОСТ 2.103-68', '')
      }
      const l = s.letter.trim().toUpperCase()
      if (!ALLOWED_LETTERS.includes(l)) {
        return mkIssue('R-LETTER-001', 'Нестандартная литера', `Литера "${s.letter}" не входит в перечень допустимых.`, 'low', 'Литера', `Использовать литеру из ряда: ${ALLOWED_LETTERS.join(', ')}.`, 'ГОСТ 2.103-68', s.letter)
      }
      return null
    },
  },
  {
    code: 'R-STAGE-001',
    title: 'Стадия разработки не указана',
    description: 'Поле "Стадия" в основной надписи обязательно.',
    severity: 'medium',
    gostRef: 'ГОСТ 2.103-68',
    field: 'Стадия',
    check: (s) => {
      if (!s.stage || !s.stage.trim()) {
        return mkIssue('R-STAGE-001', 'Стадия не указана', 'Поле "Стадия" не заполнено.', 'medium', 'Стадия', `Указать стадию разработки: ${ALLOWED_STAGES.join(', ')}.`, 'ГОСТ 2.103-68', '')
      }
      const st = s.stage.trim().toUpperCase()
      if (!ALLOWED_STAGES.includes(st)) {
        return mkIssue('R-STAGE-001', 'Нестандартная стадия', `Стадия "${s.stage}" не входит в перечень допустимых.`, 'low', 'Стадия', `Использовать стадию из ряда: ${ALLOWED_STAGES.join(', ')}.`, 'ГОСТ 2.103-68', s.stage)
      }
      return null
    },
  },
  {
    code: 'R-SIGN-001',
    title: 'Отсутствует подпись разработчика',
    description: 'В штампе должна быть подпись разработчика.',
    severity: 'high',
    gostRef: 'ГОСТ 2.104-2006',
    field: 'Подписи',
    check: (s) => {
      const dev = s.signatures?.developed?.trim() || ''
      if (!dev) {
        return mkIssue('R-SIGN-001', 'Отсутствует подпись разработчика', 'Графа "Разраб." в основной надписи не заполнена.', 'high', 'Подписи', 'Указать фамилию и инициалы разработчика, поставить подпись и дату.', 'ГОСТ 2.104-2006', '')
      }
      return null
    },
  },
  {
    code: 'R-SIGN-002',
    title: 'Отсутствует подпись проверившего',
    description: 'В штампе должна быть подпись проверившего.',
    severity: 'high',
    gostRef: 'ГОСТ 2.104-2006',
    field: 'Подписи',
    check: (s) => {
      const chk = s.signatures?.checked?.trim() || ''
      if (!chk) {
        return mkIssue('R-SIGN-002', 'Отсутствует подпись проверившего', 'Графа "Пров." в основной надписи не заполнена.', 'high', 'Подписи', 'Указать фамилию и инициалы проверяющего.', 'ГОСТ 2.104-2006', '')
      }
      return null
    },
  },
  {
    code: 'R-SIGN-003',
    title: 'Отсутствует подпись нормоконтролера',
    description: 'В штампе должна быть подпись нормоконтролера.',
    severity: 'high',
    gostRef: 'ГОСТ 2.104-2006',
    field: 'Подписи',
    check: (s) => {
      const nk = s.signatures?.normControl?.trim() || ''
      if (!nk) {
        return mkIssue('R-SIGN-003', 'Отсутствует подпись нормоконтролера', 'Графа "Н. контр." в основной надписи не заполнена.', 'high', 'Подписи', 'Передать документ на нормоконтроль; указать фамилию нормоконтролера.', 'ГОСТ 2.104-2006', '')
      }
      return null
    },
  },
  {
    code: 'R-SIGN-004',
    title: 'Отсутствует подпись утверждающего',
    description: 'Графа "Утв." в штампе должна быть заполнена.',
    severity: 'medium',
    gostRef: 'ГОСТ 2.104-2006',
    field: 'Подписи',
    check: (s) => {
      const ap = s.signatures?.approved?.trim() || ''
      if (!ap) {
        return mkIssue('R-SIGN-004', 'Отсутствует подпись утверждающего', 'Графа "Утв." не заполнена.', 'medium', 'Подписи', 'Указать фамилию утверждающего документ руководителя.', 'ГОСТ 2.104-2006', '')
      }
      return null
    },
  },
  {
    code: 'R-TT-001',
    title: 'Отсутствуют технические требования',
    description: 'На чертеже детали должны быть технические требования.',
    severity: 'medium',
    gostRef: 'ГОСТ 2.316-2008',
    field: 'Технические требования',
    check: (s) => {
      if (!s.technicalRequirements || s.technicalRequirements.length === 0) {
        return mkIssue('R-TT-001', 'Отсутствуют технические требования', 'Блок технических требований не найден или пуст.', 'medium', 'Технические требования', 'Добавить обязательные пункты ТТ (размеры для справок, неуказанные предельные отклонения и т.д.).', 'ГОСТ 2.316-2008', '')
      }
      return null
    },
  },
  {
    code: 'R-GOST-001',
    title: 'Отсутствует перечень ссылочных ГОСТ',
    description: 'В перечне ссылочных документов должны быть указаны все применённые ГОСТ.',
    severity: 'medium',
    gostRef: 'ГОСТ 2.104-2006',
    field: 'Перечень ГОСТ',
    check: (s) => {
      if (!s.gostReferences || s.gostReferences.length === 0) {
        return mkIssue('R-GOST-001', 'Отсутствует перечень ссылочных ГОСТ', 'Не найдено ссылок на ГОСТ в перечне применённых стандартов.', 'medium', 'Перечень ГОСТ', 'Заполнить перечень применённых стандартов.', 'ГОСТ 2.104-2006', '')
      }
      return null
    },
  },
]

function mkIssue(
  code: string,
  title: string,
  description: string,
  severity: Severity,
  field: string,
  recommendation: string,
  gostRef: string,
  evidence: string
): RuleCheckResult {
  return {
    code,
    title,
    description,
    requirement: gostRef,
    recommendation,
    gostRef,
    field,
    severity,
    source: 'auto',
    evidence: evidence || undefined,
  }
}

export function runDeterministicRules(stamp: StampFields): RuleCheckResult[] {
  const results: RuleCheckResult[] = []
  for (const rule of DETERMINISTIC_RULES) {
    try {
      const r = rule.check(stamp)
      if (r) results.push(r)
    } catch (e) {
      // не падать, продолжать проверки
      console.error(`Rule ${rule.code} failed:`, e)
    }
  }
  return results
}

// Преобразование LLM-замечаний в унифицированный формат
export function fromLlmIssues(issues: LlmIssueInput[]): RuleCheckResult[] {
  return issues.map((i) => ({
    code: i.code || 'LLM-SEM-XXX',
    title: i.title,
    description: i.description,
    requirement: i.requirement,
    recommendation: i.recommendation,
    gostRef: i.gostRef,
    field: i.field,
    severity: i.severity,
    source: 'llm' as const,
    evidence: undefined,
  }))
}

// Сводка по замечаниям для отчёта
export function summarizeIssues(issues: RuleCheckResult[]) {
  return {
    total: issues.length,
    high: issues.filter((i) => i.severity === 'high').length,
    medium: issues.filter((i) => i.severity === 'medium').length,
    low: issues.filter((i) => i.severity === 'low').length,
    byField: groupBy(issues, (i) => i.field || '—'),
    byCategory: groupBy(issues, (i) => i.code.split('-')[1] || 'SEM'),
  }
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item)
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {} as Record<string, T[]>)
}
