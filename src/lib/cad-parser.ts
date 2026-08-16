// CAD-парсер: извлечение атрибутов из CAD-файлов
// Поддержка: DXF (полный текстовый разбор), DWG (заголовок/метаданные),
// SolidWorks SLDPRT/SLDASM/SLDDRW (метаданные), КOMПАС CDW/SPW (метаданные)

import { readFile } from 'fs/promises'

export interface CadAttribute {
  key: string
  value: string
  source: string // откуда извлечено: 'block_attr' | 'layer' | 'text' | 'header' | 'metadata'
}

export interface CadGeometry {
  entities: number
  lines: number
  circles: number
  arcs: number
  polylines: number
  texts: number
  dimensions: number
  hatchCount: number
  insertCount: number // блоки-вставки
  bounds?: { minX: number; minY: number; maxX: number; maxY: number }
}

export interface CadLayer {
  name: string
  entityCount: number
  color?: number
}

export interface CadBlock {
  name: string
  layer: string
  basePoint: { x: number; y: number }
  attributeDefs: { tag: string; prompt: string; text: string }[]
}

export interface ParsedCadFile {
  format: 'dxf' | 'dwg' | 'sldprt' | 'sldasm' | 'slddrw' | 'cdw' | 'spw' | 'unknown'
  // Извлечённые атрибуты штампа (если найдены в блоке основной надписи)
  stampAttributes: Record<string, string>
  // Все атрибуты CAD-файла
  attributes: CadAttribute[]
  // Геометрия
  geometry: CadGeometry
  // Слои
  layers: CadLayer[]
  // Блоки (особенно блок штампа)
  blocks: CadBlock[]
  // Текстовые элементы (для поиска обозначения, наименования и т.д.)
  textEntities: { text: string; x: number; y: number; layer: string }[]
  // Метаданные файла
  metadata: {
    fileSize: number
    software?: string // какая CAD-система создала
    version?: string
    drawingUnits?: string
    lastSavedBy?: string
  }
  // Сырые предупреждения парсера
  warnings: string[]
}

// Главный метод: разобрать CAD-файл по пути
export async function parseCadFile(filePath: string, mimeType?: string): Promise<ParsedCadFile> {
  const buf = await readFile(filePath)
  const ext = filePath.toLowerCase().split('.').pop() || ''
  
  if (ext === 'dxf') return parseDxf(buf)
  if (ext === 'dwg') return parseDwg(buf)
  if (ext === 'sldprt' || ext === 'sldasm' || ext === 'slddrw') return parseSolidWorks(buf, ext)
  if (ext === 'cdw') return parseKompasCdw(buf)
  if (ext === 'spw') return parseKompasSpw(buf)
  
  return {
    format: 'unknown',
    stampAttributes: {},
    attributes: [],
    geometry: { entities: 0, lines: 0, circles: 0, arcs: 0, polylines: 0, texts: 0, dimensions: 0, hatchCount: 0, insertCount: 0 },
    layers: [],
    blocks: [],
    textEntities: [],
    metadata: { fileSize: buf.length },
    warnings: [`Unsupported CAD format: ${ext}`],
  }
}

// ============ DXF-парсер (основной, текстовый формат) ============
function parseDxf(buf: Buffer): ParsedCadFile {
  // DXF может быть в UTF-8 или windows-1251 (в зависимости от CAD-системы)
  // Пробуем UTF-8 сначала, если не получается — latin1
  let text: string
  try {
    text = buf.toString('utf-8')
    // Проверяем, есть ли мусор от неправильной кодировки
    if (text.includes('Ð') || text.includes('Â')) {
      text = buf.toString('latin1')
    }
  } catch {
    text = buf.toString('latin1')
  }
  const lines = text.split(/\r?\n/)
  const warnings: string[] = []
  const attributes: CadAttribute[] = []
  const textEntities: { text: string; x: number; y: number; layer: string }[] = []
  const layers: CadLayer[] = []
  const blocks: CadBlock[] = []
  const geometry: CadGeometry = { entities: 0, lines: 0, circles: 0, arcs: 0, polylines: 0, texts: 0, dimensions: 0, hatchCount: 0, insertCount: 0 }
  let bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  
  let metadata: ParsedCadFile['metadata'] = { fileSize: buf.length }
  let currentSection = ''
  let currentBlock: Partial<CadBlock> | null = null
  let currentAttrDef: Partial<{ tag: string; prompt: string; text: string }> | null = null
  
  // Простой конечный автомат по парам код-значение
  let i = 0
  while (i < lines.length - 1) {
    const codeStr = lines[i].trim()
    const value = lines[i + 1]
    const code = parseInt(codeStr, 10)
    if (isNaN(code)) { i += 1; continue }
    
    // HEADER section — метаданные
    if (code === 2 && currentSection === 'HEADER') {
      if (value === '$ACADVER') {
        const verCode = parseInt(lines[i + 2]?.trim() || '0', 10)
        const verVal = lines[i + 3] || ''
        if (verCode === 1) metadata.version = verVal.trim()
      }
      if (value === '$DWGCODEPAGE') {
        const cpCode = parseInt(lines[i + 2]?.trim() || '0', 10)
        if (cpCode === 3) metadata.drawingUnits = lines[i + 3]?.trim()
      }
      if (value === '$LASTSAVEDBY') {
        const sbCode = parseInt(lines[i + 2]?.trim() || '0', 10)
        if (sbCode === 1) metadata.lastSavedBy = lines[i + 3]?.trim()
      }
    }
    
    // SECTION marker
    if (code === 0 && value === 'SECTION') {
      const nextCode = parseInt(lines[i + 2]?.trim() || '0', 10)
      if (nextCode === 2) {
        currentSection = lines[i + 3]?.trim() || ''
      }
    }
    if (code === 0 && value === 'ENDSEC') {
      currentSection = ''
    }
    
    // BLOCKS section — ищем блок основной надписи
    if (code === 0 && value === 'BLOCK') {
      currentBlock = { attributeDefs: [] }
    }
    if (currentBlock && code === 2 && currentSection === 'BLOCKS' && !currentAttrDef) {
      // Только если не внутри ATTDEF (code 2 в ATTDEF = tag, не имя блока)
      currentBlock.name = value.trim()
    }
    if (currentBlock && code === 8 && currentSection === 'BLOCKS') {
      currentBlock.layer = value.trim()
    }
    if (currentBlock && code === 0 && value === 'ATTDEF') {
      // Сначала сохраняем предыдущий ATTDEF
      if (currentAttrDef && currentAttrDef.tag) {
        currentBlock.attributeDefs!.push(currentAttrDef as any)
      }
      currentAttrDef = {}
    }
    if (currentAttrDef && code === 1) currentAttrDef.text = value?.trim()
    if (currentAttrDef && code === 2) currentAttrDef.tag = value?.trim()
    if (currentAttrDef && code === 3) currentAttrDef.prompt = value?.trim()
    if (currentAttrDef && code === 0 && value !== 'ATTDEF') {
      if (currentAttrDef.tag && currentBlock) {
        currentBlock.attributeDefs!.push(currentAttrDef as any)
      }
      currentAttrDef = null
    }
    if (currentBlock && code === 0 && value === 'ENDBLK') {
      blocks.push(currentBlock as CadBlock)
      currentBlock = null
    }
    
    // TABLES/LAYER
    if (code === 0 && value === 'LAYER' && currentSection === 'TABLES') {
      layers.push({ name: '', entityCount: 0 })
    }
    if (layers.length > 0 && code === 2 && currentSection === 'TABLES') {
      const last = layers[layers.length - 1]
      if (last.name === '') last.name = value.trim()
    }
    
    // ENTITIES section — геометрия
    if (currentSection === 'ENTITIES' && code === 0) {
      geometry.entities++
      const entType = value.trim()
      if (entType === 'LINE') geometry.lines++
      if (entType === 'CIRCLE') geometry.circles++
      if (entType === 'ARC') geometry.arcs++
      if (entType === 'LWPOLYLINE' || entType === 'POLYLINE') geometry.polylines++
      if (entType === 'TEXT' || entType === 'MTEXT') {
        geometry.texts++
        // Считаем координаты и текст (следующие пары)
        let entLayer = ''
        let entText = ''
        let entX = 0, entY = 0
        for (let j = i + 2; j < Math.min(i + 30, lines.length - 1); j += 2) {
          const ec = parseInt(lines[j].trim(), 10)
          const ev = lines[j + 1] || ''
          if (ec === 0) break // следующий объект
          if (ec === 8) entLayer = ev.trim()
          if (ec === 1) entText = ev.trim()
          if (ec === 10) entX = parseFloat(ev) || 0
          if (ec === 20) entY = parseFloat(ev) || 0
        }
        if (entText) {
          textEntities.push({ text: entText, x: entX, y: entY, layer: entLayer })
          // Обновляем bounds
          bounds.minX = Math.min(bounds.minX, entX)
          bounds.minY = Math.min(bounds.minY, entY)
          bounds.maxX = Math.max(bounds.maxX, entX)
          bounds.maxY = Math.max(bounds.maxY, entY)
        }
      }
      if (entType === 'DIMENSION' || entType === 'DIMENSION_ORDINATE') geometry.dimensions++
      if (entType === 'HATCH') geometry.hatchCount++
      if (entType === 'INSERT') geometry.insertCount++
    }
    
    // Гарантированное продвижение по парам код-значение
    i += 2
  }
  
  // Извлечение атрибутов штампа из блоков
  const stampAttributes = extractStampFromBlocks(blocks, textEntities)
  
  // Если в блоках есть атрибуты — добавим в список
  for (const blk of blocks) {
    if (blk.attributeDefs) {
      for (const ad of blk.attributeDefs) {
        if (ad.text) {
          attributes.push({ key: ad.tag || blk.name, value: ad.text, source: 'block_attr' })
        }
      }
    }
  }
  
  // Текстовые атрибуты (на случай если штамп не блок)
  for (const te of textEntities.slice(0, 50)) {
    attributes.push({ key: te.layer, value: te.text, source: 'text' })
  }
  
  if (metadata.version) {
    const verMap: Record<string, string> = {
      'AC1015': 'AutoCAD 2000',
      'AC1018': 'AutoCAD 2004',
      'AC1021': 'AutoCAD 2007',
      'AC1024': 'AutoCAD 2010',
      'AC1027': 'AutoCAD 2013',
      'AC1032': 'AutoCAD 2018',
    }
    metadata.software = verMap[metadata.version] || metadata.version
  }
  
  if (bounds.minX === Infinity) bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  geometry.bounds = bounds
  
  return {
    format: 'dxf',
    stampAttributes,
    attributes,
    geometry,
    layers: layers.filter(l => l.name),
    blocks,
    textEntities: textEntities.slice(0, 200),
    metadata,
    warnings,
  }
}

// Извлечь поля штампа из блоков и текстовых entities
function extractStampFromBlocks(
  blocks: CadBlock[],
  textEntities: { text: string; x: number; y: number; layer: string }[]
): Record<string, string> {
  const result: Record<string, string> = {}
  
  // Поиск блока с именем, похожим на штамп: "stamp", "title_block", "osnovnaya_nadpis", "ОБ", "ШТАМП"
  const stampBlock = blocks.find(b => 
    /stamp|title|osnovn|штамп|основн/i.test(b.name)
  )
  
  if (stampBlock && stampBlock.attributeDefs) {
    for (const ad of stampBlock.attributeDefs) {
      const tag = (ad.tag || '').toUpperCase()
      if (ad.text) {
        // Маппинг типичных тегов
        if (/ОБОЗН|DESIGNATION|DESIG/.test(tag)) result.designation = ad.text
        else if (/НАИМЕН|NAME|TITLE/.test(tag)) result.name = ad.text
        else if (/МАСС|MASS|WEIGHT/.test(tag)) result.mass = ad.text
        else if (/МАСШТАБ|SCALE/.test(tag)) result.scale = ad.text
        else if (/^MATERIAL$|^МАТЕР/i.test(tag)) result.material = ad.text
        else if (/ЛИТЕР|LETTER/.test(tag)) result.letter = ad.text
        else if (/СТАДИ|STAGE/.test(tag)) result.stage = ad.text
        else if (/РАЗРАБ|DEVELOPED|AUTHOR/.test(tag)) result.developed = ad.text
        else if (/ПРОВ|CHECKED/.test(tag)) result.checked = ad.text
        else if (/Н\.?\s?КОНТР|NORMO|NORM/.test(tag)) result.normControl = ad.text
        else if (/УТВ|APPROVED/.test(tag)) result.approved = ad.text
        else if (/ФОРМАТ|FORMAT|SHEET/.test(tag)) result.format = ad.text
        else result[tag] = ad.text
      }
    }
  }
  
  // Если блок не найден — поиск по текстам в нижнем правом углу (где обычно штамп)
  if (Object.keys(result).length === 0 && textEntities.length > 0) {
    // Найдём «обозначение» — обычно шаблон XXX.XXXXXX.XXX
    const desig = textEntities.find(t => /^[А-ЯA-Z0-9]{2,6}\.[А-ЯA-Z0-9]{4,8}\.[А-ЯA-Z0-9]{2,4}/.test(t.text))
    if (desig) result.designation = desig.text
    
    // Масштаб вида 1:N или N:1
    const scale = textEntities.find(t => /^[1-9]\d?\s*:\s*[1-9]\d?$/.test(t.text.trim()))
    if (scale) result.scale = scale.text.trim()
    
    // Формат
    const fmt = textEntities.find(t => /^A[0-4]$/i.test(t.text.trim()))
    if (fmt) result.format = fmt.text.trim().toUpperCase()
    
    // Литера
    const letter = textEntities.find(t => /^[АБВГДО]\d?$/.test(t.text.trim()))
    if (letter) result.letter = letter.text.trim()
  }
  
  return result
}

// ============ DWG-парсер (минимальный — заголовок) ============
function parseDwg(buf: Buffer): ParsedCadFile {
  const warnings: string[] = []
  const attributes: CadAttribute[] = []
  // DWG — бинарный формат. Читаем заголовок версии (первые 6 байт)
  const verBytes = buf.slice(0, 6).toString('ascii')
  const verMap: Record<string, string> = {
    'AC1015': 'AutoCAD 2000-2002',
    'AC1018': 'AutoCAD 2004-2006',
    'AC1021': 'AutoCAD 2007-2009',
    'AC1024': 'AutoCAD 2010-2012',
    'AC1027': 'AutoCAD 2013-2014',
    'AC1032': 'AutoCAD 2018+',
  }
  const software = verMap[verBytes] || `Unknown DWG (${verBytes})`
  
  // Поищем текстовые строки в бинарнике (могут быть имена слоёв, атрибуты)
  const textStrings: string[] = []
  let strBuf = ''
  for (let i = 0; i < Math.min(buf.length, 50000); i++) {
    const b = buf[i]
    if (b >= 0x20 && b < 0x7f) {
      strBuf += String.fromCharCode(b)
    } else if (b >= 0xC0 && b < 0xFF) {
      // UTF-8 multibyte — пропустим для простоты
      strBuf += '?'
    } else {
      if (strBuf.length >= 4) textStrings.push(strBuf)
      strBuf = ''
    }
  }
  if (strBuf.length >= 4) textStrings.push(strBuf)
  
  // Поищем обозначение, масштаб, формат в строках
  const stampAttributes: Record<string, string> = {}
  for (const s of textStrings) {
    if (!stampAttributes.designation && /^[А-ЯA-Z0-9]{2,6}\.[А-ЯA-Z0-9]{4,8}\.[А-ЯA-Z0-9]{2,4}/.test(s)) {
      stampAttributes.designation = s
      attributes.push({ key: 'designation', value: s, source: 'metadata' })
    }
    if (!stampAttributes.scale && /^[1-9]\d?\s*:\s*[1-9]\d?$/.test(s.trim())) {
      stampAttributes.scale = s.trim()
      attributes.push({ key: 'scale', value: s.trim(), source: 'metadata' })
    }
    if (!stampAttributes.format && /^A[0-4]$/i.test(s.trim())) {
      stampAttributes.format = s.trim().toUpperCase()
      attributes.push({ key: 'format', value: s.trim().toUpperCase(), source: 'metadata' })
    }
  }
  
  warnings.push('DWG — бинарный формат, извлечены только метаданные заголовка. Для полного разбора требуется ODA SDK или экспорт в DXF.')
  
  return {
    format: 'dwg',
    stampAttributes,
    attributes,
    geometry: { entities: 0, lines: 0, circles: 0, arcs: 0, polylines: 0, texts: 0, dimensions: 0, hatchCount: 0, insertCount: 0 },
    layers: [],
    blocks: [],
    textEntities: [],
    metadata: { fileSize: buf.length, software, version: verBytes },
    warnings,
  }
}

// ============ SolidWorks-парсер (SLDPRT/SLDASM/SLDDRW) ============
function parseSolidWorks(buf: Buffer, ext: string): ParsedCadFile {
  const warnings: string[] = []
  const attributes: CadAttribute[] = []
  const stampAttributes: Record<string, string> = {}
  
  // SolidWorks файлы — сложный бинарный OLE-подобный формат.
  // Извлекаем текстовые строки (имена свойств, конфигураций)
  const textStrings: string[] = []
  let strBuf = ''
  for (let i = 0; i < Math.min(buf.length, 100000); i++) {
    const b = buf[i]
    // Windows-1251 кириллица
    if ((b >= 0x20 && b < 0x7f) || (b >= 0xC0 && b <= 0xFF)) {
      strBuf += b < 0x80 ? String.fromCharCode(b) : Buffer.from([b]).toString('latin1')
    } else {
      if (strBuf.length >= 3) textStrings.push(strBuf)
      strBuf = ''
    }
  }
  if (strBuf.length >= 3) textStrings.push(strBuf)
  
  // Поиск типичных property-имен SolidWorks
  const swProps = ['Обозначение', 'Наименование', 'Масса', 'Материал', 'Масштаб', 'Литера', 'Стадия', 'Разработал', 'Проверил', 'Утвердил', 'Configuration', 'Description', 'PartNumber', 'Material', 'Mass', 'Author', 'Company']
  for (const prop of swProps) {
    const idx = textStrings.findIndex(s => s.includes(prop))
    if (idx >= 0 && idx + 1 < textStrings.length) {
      const val = textStrings[idx + 1]
      if (val && val.length > 0 && val.length < 200) {
        const key = prop.toLowerCase().replace(/[^a-zа-я0-9]/gi, '')
        stampAttributes[key] = val
        attributes.push({ key: prop, value: val, source: 'metadata' })
      }
    }
  }
  
  // Поиск обозначения по шаблону
  if (!stampAttributes.designation) {
    const desig = textStrings.find(s => /^[А-ЯA-Z0-9]{2,6}\.[А-ЯA-Z0-9]{4,8}\.[А-ЯA-Z0-9]{2,4}/.test(s))
    if (desig) {
      stampAttributes.designation = desig
      attributes.push({ key: 'designation', value: desig, source: 'metadata' })
    }
  }
  
  warnings.push(`SolidWorks .${ext} — извлечены только метаданные свойств файла. Для полного разбора требуется SolidWorks API или eDrawings.`)
  
  return {
    format: ext as any,
    stampAttributes,
    attributes,
    geometry: { entities: 0, lines: 0, circles: 0, arcs: 0, polylines: 0, texts: 0, dimensions: 0, hatchCount: 0, insertCount: 0 },
    layers: [],
    blocks: [],
    textEntities: [],
    metadata: { fileSize: buf.length, software: 'SolidWorks' },
    warnings,
  }
}

// ============ КOMПАС-парсер (CDW/SPW) ============
function parseKompasCdw(buf: Buffer): ParsedCadFile {
  return parseKompas(buf, 'cdw')
}
function parseKompasSpw(buf: Buffer): ParsedCadFile {
  return parseKompas(buf, 'spw')
}
function parseKompas(buf: Buffer, ext: string): ParsedCadFile {
  const warnings: string[] = []
  const attributes: CadAttribute[] = []
  const stampAttributes: Record<string, string> = {}
  
  // КOMПАС-файлы — сложный бинарный формат.
  // Извлекаем текстовые строки (Windows-1251)
  const textStrings: string[] = []
  let strBuf = ''
  for (let i = 0; i < Math.min(buf.length, 100000); i++) {
    const b = buf[i]
    if ((b >= 0x20 && b < 0x7f) || (b >= 0xC0 && b <= 0xFF) || b === 0xA8 || b === 0xB8 || b === 0xB7 || b === 0xFF) {
      strBuf += b < 0x80 ? String.fromCharCode(b) : Buffer.from([b]).toString('latin1')
    } else {
      if (strBuf.length >= 3) textStrings.push(strBuf)
      strBuf = ''
    }
  }
  if (strBuf.length >= 3) textStrings.push(strBuf)
  
  // Поиск свойств КOMПАС
  const kProps = ['Обозначение', 'Наименование', 'Масса', 'Материал', 'Масштаб', 'Литера', 'Стадия', 'Разработал', 'Проверил', 'Н.контр.', 'Утв.', 'Формат', 'Лист']
  for (const prop of kProps) {
    const idx = textStrings.findIndex(s => s === prop || s.startsWith(prop))
    if (idx >= 0 && idx + 1 < textStrings.length) {
      const val = textStrings[idx + 1]
      if (val && val.length > 0 && val.length < 200 && val !== prop) {
        const key = mapKompasPropToKey(prop)
        stampAttributes[key] = val
        attributes.push({ key: prop, value: val, source: 'metadata' })
      }
    }
  }
  
  // Поиск обозначения по шаблону
  if (!stampAttributes.designation) {
    const desig = textStrings.find(s => /^[А-ЯA-Z0-9]{2,6}\.[А-ЯA-Z0-9]{4,8}\.[А-ЯA-Z0-9]{2,4}/.test(s))
    if (desig) {
      stampAttributes.designation = desig
      attributes.push({ key: 'designation', value: desig, source: 'metadata' })
    }
  }
  
  warnings.push(`КOMПАС .${ext} — извлечены только метаданные свойств файла. Для полного разбора требуется КOMПАС API (KompasAPI7).`)
  
  return {
    format: ext as any,
    stampAttributes,
    attributes,
    geometry: { entities: 0, lines: 0, circles: 0, arcs: 0, polylines: 0, texts: 0, dimensions: 0, hatchCount: 0, insertCount: 0 },
    layers: [],
    blocks: [],
    textEntities: [],
    metadata: { fileSize: buf.length, software: 'КOMПАС-3D' },
    warnings,
  }
}

function mapKompasPropToKey(prop: string): string {
  if (/обозн/i.test(prop)) return 'designation'
  if (/наимен/i.test(prop)) return 'name'
  if (/масс/i.test(prop)) return 'mass'
  if (/матер/i.test(prop)) return 'material'
  if (/масшт/i.test(prop)) return 'scale'
  if (/литер/i.test(prop)) return 'letter'
  if (/стади/i.test(prop)) return 'stage'
  if (/разраб/i.test(prop)) return 'developed'
  if (/пров/i.test(prop)) return 'checked'
  if (/н\.?\s?контр/i.test(prop)) return 'normControl'
  if (/утв/i.test(prop)) return 'approved'
  if (/формат/i.test(prop)) return 'format'
  return prop.toLowerCase().replace(/[^a-zа-я0-9]/gi, '')
}

// Конвертация ParsedCadFile в StampFields для движка правил
export function cadToStampFields(parsed: ParsedCadFile) {
  const s = parsed.stampAttributes

  // Извлекаем ГОСТ ссылки и ТТ из TEXT entities (не только из ATTDEF)
  const gostRefs: string[] = []
  const ttItems: string[] = []
  let inTtSection = false

  for (const te of parsed.textEntities) {
    // ГОСТ ссылки
    const matches = [...te.text.matchAll(/ГОСТ\s+[\d.\-]+/gi)]
    for (const m of matches) {
      const ref = m[0].trim().replace(/\s+/g, ' ')
      if (!gostRefs.includes(ref)) gostRefs.push(ref)
    }

    // Технические требования
    if (/технические требования/i.test(te.text)) {
      inTtSection = true
      continue
    }
    // Перечень ГОСТ — заканчиваем секцию ТТ
    if (/перечень применен/i.test(te.text)) {
      inTtSection = false
      continue
    }
    if (inTtSection && /^\d+[.:]/.test(te.text.trim())) {
      ttItems.push(te.text.trim())
    }
  }

  return {
    format: s.format || null,
    designation: s.designation || null,
    name: s.name || null,
    scale: s.scale || null,
    mass: s.mass || null,
    material: s.material || null,
    letter: s.letter || null,
    stage: s.stage || null,
    signatures: {
      developed: s.developed || null,
      checked: s.checked || null,
      normControl: s.normControl || null,
      approved: s.approved || null,
    },
    dates: null,
    invNumber: null,
    technicalRequirements: ttItems.length > 0 ? ttItems : null,
    gostReferences: gostRefs.length > 0 ? gostRefs : null,
    documentType: parsed.format === 'sldasm' ? 'сборочный чертеж' : 'чертеж детали',
    sheetCount: null,
    notes: parsed.warnings.join('; '),
  }
}
