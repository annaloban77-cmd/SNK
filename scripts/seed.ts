import { db } from '../src/lib/db'

// Сидинг: ГОСТ/ОСТ/СТО + правила + демо-проект и документы
async function main() {
  console.log('🌱 Seeding NK-Контроль database...')

  // === Стандарты ===
  const standards = [
    { code: 'ГОСТ 2.001-2013', name: 'ЕСКД. Общие положения', type: 'ESKD', scope: 'Общие положения ЕСКД', description: 'Устанавливает назначение, состав и правила применения стандартов Единой системы конструкторской документации.', publishedAt: '2013' },
    { code: 'ГОСТ 2.104-2006', name: 'ЕСКД. Основные надписи', type: 'ESKD', scope: 'Штампы чертежей, спецификаций', description: 'Устанавливает формы, размеры и порядок заполнения основных надписей в конструкторских документах.', publishedAt: '2006' },
    { code: 'ГОСТ 2.109-73', name: 'ЕСКД. Основные требования к чертежам', type: 'ESKD', scope: 'Правила выполнения чертежей', description: 'Устанавливает общие требования к выполнению чертежей деталей, сборочных, габаритных, монтажных.', publishedAt: '1973' },
    { code: 'ГОСТ 2.301-68', name: 'ЕСКД. Форматы', type: 'ESKD', scope: 'Форматы листов чертежей', description: 'Устанавливает форматы листов чертежей и других документов: A0, A1, A2, A3, A4.', publishedAt: '1968' },
    { code: 'ГОСТ 2.302-68', name: 'ЕСКД. Масштабы', type: 'ESKD', scope: 'Масштабы изображений', description: 'Устанавливает масштабы изображений и их обозначение на чертежах.', publishedAt: '1968' },
    { code: 'ГОСТ 2.303-68', name: 'ЕСКД. Линии', type: 'ESKD', scope: 'Типы линий чертежа', description: 'Устанавливает начертания и основные назначения линий на чертежах.', publishedAt: '1968' },
    { code: 'ГОСТ 2.304-81', name: 'ЕСКД. Шрифты чертёжные', type: 'ESKD', scope: 'Чертёжные шрифты', description: 'Устанавливает чертёжные шрифты для нанесения надписей на чертежах.', publishedAt: '1981' },
    { code: 'ГОСТ 2.307-2011', name: 'ЕСКД. Нанесение размеров и предельных отклонений', type: 'ESKD', scope: 'Размеры и допуски', description: 'Устанавливает правила нанесения размеров и предельных отклонений на чертежах.', publishedAt: '2011' },
    { code: 'ГОСТ 2.308-2011', name: 'ЕСКД. Указание допусков формы и расположения', type: 'ESKD', scope: 'Допуски формы и расположения', description: 'Устанавливает правила указания допусков формы и расположения поверхностей.', publishedAt: '2011' },
    { code: 'ГОСТ 2.309-73', name: 'ЕСКД. Обозначение шероховатости поверхностей', type: 'ESKD', scope: 'Шероховатость', description: 'Устанавливает обозначения шероховатости поверхностей и правила их нанесения.', publishedAt: '1973' },
    { code: 'ГОСТ 2.311-68', name: 'ЕСКД. Изображение резьбы', type: 'ESKD', scope: 'Резьбы', description: 'Устанавливает правила изображения резьбы на чертежах.', publishedAt: '1968' },
    { code: 'ГОСТ 2.312-72', name: 'ЕСКД. Условные изображения и обозначения сварных соединений', type: 'ESKD', scope: 'Сварные швы', description: 'Устанавливает условные изображения и обозначения сварных соединений в конструкторских документах.', publishedAt: '1972' },
    { code: 'ГОСТ 2.316-2008', name: 'ЕСКД. Правила нанесения на чертежах надписей, технических требований и таблиц', type: 'ESKD', scope: 'Технические требования', description: 'Устанавливает правила нанесения надписей, технических требований и таблиц на чертежах.', publishedAt: '2008' },
    { code: 'ГОСТ 2.201-80', name: 'ЕСКД. Обозначение изделий и конструкторских документов', type: 'ESKD', scope: 'Обозначения документов', description: 'Устанавливает систему обозначения изделий и конструкторских документов.', publishedAt: '1980' },
    { code: 'ГОСТ 2.103-2013', name: 'ЕСКД. Стадии разработки', type: 'ESKD', scope: 'Стадии и литеры', description: 'Устанавливает стадии разработки конструкторской документации на изделия всех отраслей промышленности.', publishedAt: '2013' },
    { code: 'ГОСТ 2.106-96', name: 'ЕСКД. Текстовые документы', type: 'ESKD', scope: 'Спецификации, ведомости, ТТ', description: 'Устанавливает формы и правила выполнения текстовых конструкторских документов: спецификаций, ведомостей, технических условий.', publishedAt: '1996' },
    { code: 'ГОСТ 19281-2014', name: 'Прокат из стали повышенной прочности. Технические условия', type: 'GOST', scope: 'Стали для судостроения', description: 'Распространяется на прокат из стали повышенной прочности, применяемой в судостроении и машиностроении.', publishedAt: '2014' },
    { code: 'ГОСТ 5264-80', name: 'Ручная дуговая сварка. Сварные соединения', type: 'GOST', scope: 'Сварка конструкций', description: 'Устанавливает основные типы, конструктивные элементы и размеры сварных соединений при ручной дуговой сварке.', publishedAt: '1980' },
    { code: 'ГОСТ 14771-76', name: 'Дуговая сварка в защитном газе. Сварные соединения', type: 'GOST', scope: 'Сварка конструкций', description: 'Устанавливает основные типы и конструктивные элементы сварных соединений при дуговой сварке в защитных газах.', publishedAt: '1976' },
    { code: 'ГОСТ 15150-69', name: 'Машины, приборы и другие технические изделия. Климатическое исполнение', type: 'GOST', scope: 'Климатическое исполнение', description: 'Устанавливает климатические исполнения для эксплуатации в различных макроклиматических районах.', publishedAt: '1969' },
    { code: 'ОСТ 5Р.0206-2002', name: 'Положение о нормоконтроле в судостроении', type: 'OST', scope: 'Нормоконтроль в судостроении', description: 'Отраслевой стандарт, устанавливающий порядок проведения нормоконтроля в организациях судостроительной промышленности.', publishedAt: '2002' },
    { code: 'СТО Северо-Верфь-001-2023', name: 'СТО. Правила оформления конструкторской документации', type: 'STO', scope: 'Внутренний стандарт предприятия', description: 'Стандарт предприятия, устанавливающий дополнительные требования к оформлению КД с учётом специфики производства.', publishedAt: '2023' },
    { code: 'РД 5Р.0007-2005', name: 'РД. Порядок согласования документации с Регистром', type: 'RD', scope: 'Согласование с Регистром', description: 'Руководящий документ по порядку согласования конструкторской документации с Российским морским регистром судоходства.', publishedAt: '2005' },
    { code: 'Регистр. Правила классификации и постройки морских судов', name: 'Правила Регистра морских судов', type: 'REGISTER', scope: 'Классификация и постройка судов', description: 'Требования Российского морского регистра судоходства к классификации и постройке морских судов.', publishedAt: '2024' },
    { code: 'Регистр. Правила классификации и постройки судов внутреннего плавания', name: 'Правила Регистра речных судов', type: 'REGISTER', scope: 'Судов внутреннего плавания', description: 'Требования Российского речного регистра к классификации и постройке судов внутреннего плавания.', publishedAt: '2023' },
  ]

  for (const s of standards) {
    await db.standard.upsert({
      where: { code: s.code },
      update: {},
      create: s,
    })
  }
  console.log(`✓ Inserted ${standards.length} standards`)

  // === Правила ===
  const gostMap = (code: string) => standards.find((s) => s.code === code)?.code
  const rules = [
    { code: 'R-FORMAT-001', name: 'Проверка формата листа', description: 'Формат листа должен быть A0–A4 по ГОСТ 2.301', category: 'format', method: 'deterministic', severity: 'high', gostField: 'Формат', standardCode: gostMap('ГОСТ 2.301-68') },
    { code: 'R-STAMP-001', name: 'Наличие обозначения', description: 'Поле "Обозначение" обязательно', category: 'stamp', method: 'deterministic', severity: 'high', gostField: 'Обозначение', standardCode: gostMap('ГОСТ 2.104-2006') },
    { code: 'R-STAMP-002', name: 'Структура обозначения', description: 'Соответствие шаблону предприятия', category: 'stamp', method: 'deterministic', severity: 'medium', gostField: 'Обозначение', standardCode: gostMap('ГОСТ 2.201-80') },
    { code: 'R-STAMP-003', name: 'Наличие наименования', description: 'Поле "Наименование" обязательно', category: 'stamp', method: 'deterministic', severity: 'high', gostField: 'Наименование', standardCode: gostMap('ГОСТ 2.104-2006') },
    { code: 'R-SCALE-001', name: 'Проверка масштаба', description: 'Масштаб из стандартного ряда', category: 'stamp', method: 'deterministic', severity: 'low', gostField: 'Масштаб', standardCode: gostMap('ГОСТ 2.302-68') },
    { code: 'R-MASS-001', name: 'Проверка массы', description: 'Корректность указания массы', category: 'stamp', method: 'deterministic', severity: 'medium', gostField: 'Масса', standardCode: gostMap('ГОСТ 2.104-2006') },
    { code: 'R-MAT-001', name: 'Наличие материала', description: 'Материал обязателен для деталей', category: 'material', method: 'deterministic', severity: 'high', gostField: 'Материал', standardCode: gostMap('ГОСТ 2.104-2006') },
    { code: 'R-MAT-002', name: 'ГОСТ в материале', description: 'В обозначении материала должен быть ГОСТ', category: 'material', method: 'deterministic', severity: 'medium', gostField: 'Материал', standardCode: gostMap('ГОСТ 2.109-73') },
    { code: 'R-MAT-003', name: 'ГОСТ материала в перечне', description: 'ГОСТ материала должен быть в перечне ссылочных', category: 'material', method: 'deterministic', severity: 'high', gostField: 'Материал', standardCode: gostMap('ГОСТ 2.104-2006') },
    { code: 'R-LETTER-001', name: 'Проверка литеры', description: 'Литера обязательна и из стандартного ряда', category: 'stamp', method: 'deterministic', severity: 'medium', gostField: 'Литера', standardCode: gostMap('ГОСТ 2.103-2013') },
    { code: 'R-STAGE-001', name: 'Проверка стадии', description: 'Стадия обязательна и из стандартного ряда', category: 'stamp', method: 'deterministic', severity: 'medium', gostField: 'Стадия', standardCode: gostMap('ГОСТ 2.103-2013') },
    { code: 'R-SIGN-001', name: 'Подпись разработчика', description: 'Графа "Разраб." обязательна', category: 'stamp', method: 'deterministic', severity: 'high', gostField: 'Подписи', standardCode: gostMap('ГОСТ 2.104-2006') },
    { code: 'R-SIGN-002', name: 'Подпись проверившего', description: 'Графа "Пров." обязательна', category: 'stamp', method: 'deterministic', severity: 'high', gostField: 'Подписи', standardCode: gostMap('ГОСТ 2.104-2006') },
    { code: 'R-SIGN-003', name: 'Подпись нормоконтролера', description: 'Графа "Н.контр." обязательна', category: 'stamp', method: 'deterministic', severity: 'high', gostField: 'Подписи', standardCode: gostMap('ГОСТ 2.104-2006') },
    { code: 'R-SIGN-004', name: 'Подпись утверждающего', description: 'Графа "Утв." обязательна', category: 'stamp', method: 'deterministic', severity: 'medium', gostField: 'Подписи', standardCode: gostMap('ГОСТ 2.104-2006') },
    { code: 'R-TT-001', name: 'Наличие ТТ', description: 'Технические требования обязательны', category: 'stamp', method: 'deterministic', severity: 'medium', gostField: 'Технические требования', standardCode: gostMap('ГОСТ 2.316-2008') },
    { code: 'R-GOST-001', name: 'Перечень ГОСТ', description: 'Перечень ссылочных ГОСТ обязателен', category: 'stamp', method: 'deterministic', severity: 'medium', gostField: 'Перечень ГОСТ', standardCode: gostMap('ГОСТ 2.104-2006') },
    { code: 'R-SEM-001', name: 'Семантическая согласованность ТТ и материала', description: 'ТТ должны соответствовать материалу', category: 'semantic', method: 'semantic', severity: 'medium', gostField: 'ТТ/Материал', standardCode: gostMap('ГОСТ 2.316-2008') },
    { code: 'R-SEM-002', name: 'Согласованность наименований', description: 'Наименование в штампе и в спецификации должно совпадать', category: 'semantic', method: 'semantic', severity: 'medium', gostField: 'Наименование', standardCode: gostMap('ГОСТ 2.106-96') },
    { code: 'R-SEM-003', name: 'Контроль сварного шва', description: 'Наличие указания о контроле сварного шва', category: 'semantic', method: 'semantic', severity: 'high', gostField: 'Сварка', standardCode: gostMap('ГОСТ 2.312-72') },
    { code: 'R-CAD-001', name: 'CAD: обязательные атрибуты', description: 'Проверка свойств CAD-файла', category: 'cad_attr', method: 'vision', severity: 'medium', gostField: 'CAD-атрибуты', standardCode: gostMap('СТО Северо-Верфь-001-2023') },
    { code: 'R-CAD-002', name: 'CAD: соответствие 3D и 2D', description: 'Соответствие модели и чертежа', category: 'cad_attr', method: 'vision', severity: 'high', gostField: 'CAD-модель', standardCode: gostMap('СТО Северо-Верфь-001-2023') },
    { code: 'R-GEOM-001', name: 'Наличие необходимых видов', description: 'Достаточность изображений для чтения чертежа', category: 'geometry', method: 'vision', severity: 'medium', gostField: 'Геометрия', standardCode: gostMap('ГОСТ 2.305-2008') },
  ]

  for (const r of rules) {
    const std = r.standardCode ? await db.standard.findUnique({ where: { code: r.standardCode } }) : null
    await db.rule.upsert({
      where: { code: r.code },
      update: {},
      create: {
        code: r.code,
        name: r.name,
        description: r.description,
        category: r.category,
        method: r.method,
        severity: r.severity,
        gostField: r.gostField,
        enabled: true,
        standardId: std?.id ?? null,
      },
    })
  }
  console.log(`✓ Inserted ${rules.length} rules`)

  // === Проект ===
  const project = await db.project.upsert({
    where: { code: 'СВ-2025-К-104' },
    update: {},
    create: {
      code: 'СВ-2025-К-104',
      name: 'Корпусная конструкция - секция 104',
      description: 'Рабочая документация на корпусную секцию 104 (судно проекта СВ-2025)',
      stage: 'РК',
      status: 'active',
    },
  })
  console.log(`✓ Project: ${project.code}`)

  // === Демо-документы (без файлов — только метаданные) ===
  const existingDocs = await db.document.count()
  if (existingDocs === 0) {
    const demoDocs = [
      {
        name: 'АБВ.301254.001_Кронштейн.pdf',
        originalName: 'Кронштейн.pdf',
        mimeType: 'application/pdf',
        size: 248320,
        format: 'A3',
        sourceType: 'pdf',
        status: 'analyzed',
        filePath: '',
        stampJson: JSON.stringify({
          format: 'A3',
          designation: 'АБВ.301254.001',
          name: 'Кронштейн',
          scale: '1:2',
          mass: '12,5 кг.',
          material: 'Сталь 09Г2С',
          letter: 'О',
          stage: 'РК',
          signatures: { developed: 'Иванов И.И.', checked: 'Петров П.П.', normControl: '', approved: 'Сидоров С.С.' },
          dates: { developed: '12.03.2025', checked: '14.03.2025', approved: '18.03.2025' },
          technicalRequirements: ['Неуказанные предельные отклонения H14, h14, ±IT14/2', 'Острые кромки притупить'],
          gostReferences: ['ГОСТ 2.307', 'ГОСТ 2.309'],
          documentType: 'чертеж детали',
          sheetCount: 1,
        }),
        issueCount: 4, highCount: 2, mediumCount: 1, lowCount: 1,
        checkDuration: 8500,
      },
      {
        name: 'АБВ.301254.002_Кронштейн_СБ.pdf',
        originalName: 'Кронштейн_СБ.pdf',
        mimeType: 'application/pdf',
        size: 412160,
        format: 'A2',
        sourceType: 'scan',
        status: 'analyzed',
        filePath: '',
        stampJson: JSON.stringify({
          format: 'A2',
          designation: 'АБВ.301254.002 СБ',
          name: 'Кронштейн (сборочный)',
          scale: '1:1',
          mass: '18,2 кг',
          material: '',
          letter: 'О',
          stage: 'РК',
          signatures: { developed: 'Иванов И.И.', checked: 'Петров П.П.', normControl: 'Кузнецов К.К.', approved: '' },
          dates: { developed: '10.03.2025', checked: '12.03.2025', approved: '' },
          technicalRequirements: ['Сварные швы по ГОСТ 5264-80', 'Контроль швов — визуальный'],
          gostReferences: ['ГОСТ 2.312', 'ГОСТ 5264', 'ГОСТ 2.307'],
          documentType: 'сборочный чертеж',
          sheetCount: 2,
        }),
        issueCount: 2, highCount: 0, mediumCount: 2, lowCount: 0,
        checkDuration: 11200,
      },
      {
        name: 'АБВ.301254.000_СП.pdf',
        originalName: 'Спецификация.pdf',
        mimeType: 'application/pdf',
        size: 184320,
        format: 'A4',
        sourceType: 'pdf',
        status: 'new',
        filePath: '',
        stampJson: null,
        issueCount: 0, highCount: 0, mediumCount: 0, lowCount: 0,
      },
      {
        name: 'АБВ.301455.012_Фланец.cdw',
        originalName: 'Фланец.cdw',
        mimeType: 'application/octet-stream',
        size: 92160,
        format: 'A4',
        sourceType: 'cdw',
        status: 'new',
        filePath: '',
        stampJson: null,
        issueCount: 0, highCount: 0, mediumCount: 0, lowCount: 0,
      },
      {
        name: 'АБВ.301567.003_Опора.sldasm',
        originalName: 'Опора.sldasm',
        mimeType: 'application/octet-stream',
        size: 1048576,
        format: null,
        sourceType: 'sldasm',
        status: 'failed',
        filePath: '',
        stampJson: null,
        issueCount: 0, highCount: 0, mediumCount: 0, lowCount: 0,
      },
    ]

    for (const d of demoDocs) {
      await db.document.create({
        data: {
          ...d,
          projectId: project.id,
          ocrText: null,
        },
      })
    }
    console.log(`✓ Inserted ${demoDocs.length} demo documents`)

    // === Замечания для первого демо-документа ===
    const doc1 = await db.document.findFirst({ where: { name: 'АБВ.301254.001_Кронштейн.pdf' } })
    if (doc1) {
      const ruleMat = await db.rule.findUnique({ where: { code: 'R-MAT-002' } })
      const ruleMat3 = await db.rule.findUnique({ where: { code: 'R-MAT-003' } })
      const ruleMass = await db.rule.findUnique({ where: { code: 'R-MASS-001' } })
      const ruleSign = await db.rule.findUnique({ where: { code: 'R-SIGN-003' } })

      const issuesData = [
        { ruleId: ruleMass?.id ?? null, code: 'R-MASS-001', title: 'Лишняя точка после единицы массы', description: 'Масса указана как "12,5 кг." — после "кг" не ставится точка.', requirement: 'Единица массы должна указываться без точки.', recommendation: 'Исправить на "12,5 кг".', gostRef: 'ГОСТ 2.104-2006', field: 'Масса', severity: 'low', status: 'new', source: 'auto', evidence: '12,5 кг.' },
        { ruleId: ruleMat?.id ?? null, code: 'R-MAT-002', title: 'В обозначении материала нет ГОСТ', description: 'Материал "Сталь 09Г2С" указан без ссылки на стандарт.', requirement: 'Дополнить обозначение материала ссылкой на ГОСТ.', recommendation: 'Исправить на "Сталь 09Г2С ГОСТ 19281-2014".', gostRef: 'ГОСТ 2.109-73', field: 'Материал', severity: 'medium', status: 'new', source: 'auto', evidence: 'Сталь 09Г2С' },
        { ruleId: ruleMat3?.id ?? null, code: 'R-MAT-003', title: 'ГОСТ материала отсутствует в перечне', description: 'ГОСТ 19281 не найден в перечне применённых стандартов.', requirement: 'Проверить комплектность ссылочных документов.', recommendation: 'Добавить ГОСТ 19281 в перечень применённых стандартов.', gostRef: 'ГОСТ 2.104-2006', field: 'Материал', severity: 'high', status: 'confirmed', source: 'auto', evidence: 'Сталь 09Г2С' },
        { ruleId: ruleSign?.id ?? null, code: 'R-SIGN-003', title: 'Отсутствует подпись нормоконтролера', description: 'Графа "Н.контр." в основной надписи не заполнена.', requirement: 'Передать документ на нормоконтроль.', recommendation: 'Указать фамилию нормоконтролера, поставить подпись и дату.', gostRef: 'ГОСТ 2.104-2006', field: 'Подписи', severity: 'high', status: 'new', source: 'auto', evidence: '' },
      ]
      for (const iss of issuesData) {
        await db.issue.create({ data: { ...iss, documentId: doc1.id } })
      }
      console.log(`✓ Inserted ${issuesData.length} issues for doc1`)
    }

    // === Замечания для второго демо-документа ===
    const doc2 = await db.document.findFirst({ where: { name: 'АБВ.301254.002_Кронштейн_СБ.pdf' } })
    if (doc2) {
      const ruleMat = await db.rule.findUnique({ where: { code: 'R-MAT-001' } })
      const ruleSign = await db.rule.findUnique({ where: { code: 'R-SIGN-004' } })
      const issuesData2 = [
        { ruleId: ruleMat?.id ?? null, code: 'R-MAT-001', title: 'Не указан материал', description: 'Для сборочного чертежа в графе "Материал" указана ссылка на спецификацию, но поле не заполнено корректно.', requirement: 'Указать "*" и ссылку на спецификацию или перечислить основные материалы.', recommendation: 'Заполнить поле "Материал" согласно ГОСТ 2.104.', gostRef: 'ГОСТ 2.104-2006', field: 'Материал', severity: 'medium', status: 'new', source: 'auto', evidence: '' },
        { ruleId: ruleSign?.id ?? null, code: 'R-SIGN-004', title: 'Отсутствует подпись утверждающего', description: 'Графа "Утв." не заполнена.', requirement: 'Указать руководителя, утверждающего документ.', recommendation: 'Получить утверждение руководителя.', gostRef: 'ГОСТ 2.104-2006', field: 'Подписи', severity: 'medium', status: 'rejected', source: 'auto', evidence: '' },
      ]
      for (const iss of issuesData2) {
        await db.issue.create({ data: { ...iss, documentId: doc2.id } })
      }
      console.log(`✓ Inserted ${issuesData2.length} issues for doc2`)
    }
  } else {
    console.log(`↪ Skip demo docs (${existingDocs} already exist)`)
  }

  console.log('✅ Seeding complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
