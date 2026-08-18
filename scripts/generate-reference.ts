// Блок 3: генератор справочников — 3000+ записей
// Параметрическая генерация: размеры × ГОСТ × марки
import { db } from '../src/lib/db'

async function main() {
  console.log('📚 Generating reference data...')

  // === Материалы (~500) ===
  const steels19281 = ['09Г2С','10ХСНД','09Г2','14Г2','15ХСНД','10Г2Б','12Г2Б','14Г2АФ','16Г2АФ','15Г2АФДпс']
  const categories19281 = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17]
  const steels1050 = ['05','08','10','15','20','25','30','35','40','45','50','55','60']
  const steels380 = ['Ст0','Ст1кп','Ст1пс','Ст1сп','Ст2кп','Ст2пс','Ст2сп','Ст3кп','Ст3пс','Ст3сп','Ст4кп','Ст4пс','Ст4сп','Ст5пс','Ст5сп','Ст6пс','Ст6сп']
  const bronzes = ['БрАЖ9-4','БрАЖМц10-3-1.5','БрАМц9-2','БрКМц3-1','БрАЖН10-4-4']
  const brasses = ['Л63','Л68','ЛС59-1','ЛЖМц59-1-1','ЛАЖ60-1-1','ЛМц58-2']
  const aluminums = ['АМг6','АМг5','АМг3','АМц','АД31','АД0','Д16','АК4-1','АК6','В95']
  let matCount = 0
  for (const grade of steels19281) {
    for (const cat of categories19281) {
      await db.material.create({ data: { code: `${grade}-кат${cat}`, name: `Сталь ${grade} категория ${cat}`, gost: 'ГОСТ 19281-2014', category: 'steel', params: JSON.stringify({ grade, category: cat, tensile: 430, yield: 295 }) } })
      matCount++
    }
  }
  for (const grade of steels1050) { await db.material.create({ data: { code: `Ст${grade}-ГОСТ1050`, name: `Сталь ${grade}`, gost: 'ГОСТ 1050-2013', category: 'steel', params: JSON.stringify({ grade }) } }); matCount++ }
  for (const grade of steels380) { await db.material.create({ data: { code: `${grade}-ГОСТ380`, name: `Сталь ${grade}`, gost: 'ГОСТ 380-2005', category: 'steel', params: JSON.stringify({ grade }) } }); matCount++ }
  for (const grade of bronzes) { await db.material.create({ data: { code: `${grade}-ГОСТ18175`, name: `Бронза ${grade}`, gost: 'ГОСТ 18175-78', category: 'bronze', params: JSON.stringify({ grade }) } }); matCount++ }
  for (const grade of brasses) { await db.material.create({ data: { code: `${grade}-ГОСТ15527`, name: `Латунь ${grade}`, gost: 'ГОСТ 15527-2004', category: 'brass', params: JSON.stringify({ grade }) } }); matCount++ }
  for (const grade of aluminums) { await db.material.create({ data: { code: `${grade}-ГОСТ4784`, name: `Алюминий ${grade}`, gost: 'ГОСТ 4784-97', category: 'aluminum', params: JSON.stringify({ grade }) } }); matCount++ }
  console.log(`  Materials: ${matCount}`)

  // === Крепёж (~1200) ===
  const boltGosts = [{ gost: 'ГОСТ 7798-70', type: 'bolt', name: 'Болт' }, { gost: 'ГОСТ 7805-70', type: 'bolt', name: 'Болт (класс А)' }, { gost: 'ГОСТ 15589-70', type: 'bolt', name: 'Болт (класс С)' }]
  const nutGosts = [{ gost: 'ГОСТ 5915-70', type: 'nut', name: 'Гайка' }, { gost: 'ГОСТ 5929-70', type: 'nut', name: 'Гайка (класс А)' }, { gost: 'ГОСТ 15521-70', type: 'nut', name: 'Гайка (класс С)' }]
  const washerGosts = [{ gost: 'ГОСТ 11371-78', type: 'washer', name: 'Шайба' }, { gost: 'ГОСТ 6402-70', type: 'washer', name: 'Шайба пружинная' }]
  const screwGosts = [{ gost: 'ГОСТ 17475-80', type: 'screw', name: 'Винт' }, { gost: 'ГОСТ 11652-80', type: 'screw', name: 'Винт самонарезающий' }]
  const studGosts = [{ gost: 'ГОСТ 22042-76', type: 'stud', name: 'Шпилька' }]
  const diameters = [3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 27, 30, 36, 42, 48]
  const lengths = [8, 10, 12, 14, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 110, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300]
  const grades = ['4.6','4.8','5.6','5.8','6.8','8.8','10.9','12.9']
  let fastCount = 0
  for (const g of [...boltGosts, ...nutGosts, ...washerGosts, ...screwGosts, ...studGosts]) {
    for (const d of diameters) {
      if (g.type === 'bolt' || g.type === 'screw' || g.type === 'stud') {
        for (const l of lengths) {
          if (l >= d * 2) {
            const code = `${g.gost.split(' ')[1].split('-')[0]}-М${d}x${l}`
            await db.fastener.create({ data: { code, name: `${g.name} М${d}×${l}`, gost: g.gost, type: g.type, params: JSON.stringify({ diameter: d, length: l, pitch: 'крупный' }) } })
            fastCount++
          }
        }
      } else if (g.type === 'nut') {
        for (const gr of grades) {
          const code = `${g.gost.split(' ')[1].split('-')[0]}-М${d}-${gr}`
          await db.fastener.create({ data: { code, name: `${g.name} М${d} ${gr}`, gost: g.gost, type: g.type, params: JSON.stringify({ diameter: d, grade: gr }) } })
          fastCount++
        }
      } else if (g.type === 'washer') {
        const code = `${g.gost.split(' ')[1].split('-')[0]}-${d}`
        await db.fastener.create({ data: { code, name: `${g.name} ${d}`, gost: g.gost, type: g.type, params: JSON.stringify({ diameter: d }) } })
        fastCount++
      }
    }
  }
  console.log(`  Fasteners: ${fastCount}`)

  // === Подшипники (~300) ===
  const bearingSeries = [
    { prefix: '180', gost: 'ГОСТ 8338-75', type: 'шариковый радиальный однорядный' },
    { prefix: '1200', gost: 'ГОСТ 28428-90', type: 'шариковый сферический двухрядный' },
    { prefix: '7200', gost: 'ГОСТ 27365-87', type: 'роликовый конический однорядный' },
    { prefix: '36000', gost: 'ГОСТ 831-75', type: 'шариковый упорно-радиальный' },
    { prefix: '8000', gost: 'ГОСТ 7872-75', type: 'шариковый упорный' },
    { prefix: '46200', gost: 'ГОСТ 831-75', type: 'шариковый радиально-упорный' },
  ]
  let bearCount = 0
  for (const series of bearingSeries) {
    for (let i = 1; i <= 20; i++) {
      const code = `${series.prefix}${String(i * 5).padStart(3, '0')}`
      await db.bearing.create({ data: { code, name: `Подшипник ${code}`, gost: series.gost, params: JSON.stringify({ type: series.type, series: series.prefix }) } })
      bearCount++
    }
  }
  console.log(`  Bearings: ${bearCount}`)

  // === Прокат (~600) ===
  const sheetThicknesses = [0.5, 0.8, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 14.0, 16.0, 20.0, 25.0, 30.0, 40.0, 50.0]
  const sheetWidths = [1000, 1250, 1500, 2000]
  const angleNos = [25, 32, 35, 40, 45, 50, 56, 63, 70, 75, 80, 90, 100, 110, 125, 140, 160]
  const channelNos = ['5', '6.5', '8', '10', '12', '14', '16', '16a', '18', '18a', '20', '22', '24', '27', '30', '33', '36', '40']
  const beamNos = [10, 12, 14, 16, 18, 20, 22, 24, 27, 30, 36, 40, 45, 50, 55, 60]
  const pipeDiameters = [14, 18, 22, 25, 32, 38, 45, 57, 76, 89, 108, 133, 159, 219, 273, 325, 377, 426]
  let rollCount = 0
  for (const t of sheetThicknesses) { for (const w of sheetWidths) {
    await db.rolledProduct.create({ data: { code: `Лист-${t}x${w}`, name: `Лист ${t}×${w}`, gost: 'ГОСТ 19903-2015', type: 'sheet', params: JSON.stringify({ thickness: t, width: w, length: 2000 }) } }); rollCount++
  } }
  for (const n of angleNos) { await db.rolledProduct.create({ data: { code: `Уголок-${n}`, name: `Уголок ${n}×${n}`, gost: 'ГОСТ 8509-93', type: 'angle', params: JSON.stringify({ number: n }) } }); rollCount++ }
  for (const n of channelNos) { await db.rolledProduct.create({ data: { code: `Швеллер-${n}`, name: `Швеллер ${n}`, gost: 'ГОСТ 8240-97', type: 'channel', params: JSON.stringify({ number: n }) } }); rollCount++ }
  for (const n of beamNos) { await db.rolledProduct.create({ data: { code: `Двутавр-${n}`, name: `Двутавр ${n}`, gost: 'ГОСТ 8239-89', type: 'beam', params: JSON.stringify({ number: n }) } }); rollCount++ }
  for (const d of pipeDiameters) { for (const wt of [2, 3, 4, 5, 6, 8]) {
    await db.rolledProduct.create({ data: { code: `Труба-${d}x${wt}`, name: `Труба ${d}×${wt}`, gost: 'ГОСТ 8732-78', type: 'pipe', params: JSON.stringify({ diameter: d, wallThickness: wt }) } }); rollCount++
  } }
  console.log(`  Rolled: ${rollCount}`)

  // === Сварочные материалы (~200) ===
  const electrodes = ['УОНИ 13/45','УОНИ 13/55','АНО-4','АНО-21','МР-3','ОЗС-4','ОЗС-6','ЦЛ-39','ЭА-395/9','ЭА-981/15','ЦУ-5','ТМЛ-3У','АНЖР-2','ОК 53.70','ОК 48.00','LB-52U','Kobelco']
  const wires = ['Св-08','Св-08А','Св-08ГА','Св-10Г2','Св-08Г2С','Св-08ХМ','Св-10ХМФТ','Св-08ХГН2М','Св-04Х19Н9','Св-08Х19Н10Г2Б','Св-01Х19Н18Г10АМ4П','Св-06Х21Н7М9Т']
  const fluxes = ['АН-348А','АН-60','АН-22','АН-43','ОСЦ-45','ФЦ-9','АНК-19','АН-47','АН-26С','АН-26П','АН-17М','АН-20П']
  let weldCount = 0
  for (const e of electrodes) { for (const d of [2.5, 3.0, 3.2, 4.0, 5.0]) {
    await db.weldingMaterial.create({ data: { code: `Эл-${e}-${d}`, name: `Электрод ${e} ${d}мм`, gost: 'ГОСТ 9466-75', type: 'electrode', params: JSON.stringify({ grade: e, diameter: d }) } }); weldCount++
  } }
  for (const w of wires) { for (const d of [1.2, 1.6, 2.0, 2.5, 3.0, 4.0]) {
    await db.weldingMaterial.create({ data: { code: `Пр-${w}-${d}`, name: `Проволока ${w} ${d}мм`, gost: 'ГОСТ 2246-70', type: 'wire', params: JSON.stringify({ grade: w, diameter: d }) } }); weldCount++
  } }
  for (const f of fluxes) {
    await db.weldingMaterial.create({ data: { code: `Фл-${f}`, name: `Флюс ${f}`, gost: 'ГОСТ 9087-81', type: 'flux', params: JSON.stringify({ grade: f }) } }); weldCount++
  }
  console.log(`  Welding: ${weldCount}`)

  // === Покрытия (~200) ===
  const primers = ['ГФ-017','ГФ-021','ГФ-0119','ХС-010','ВЛ-02','ВЛ-023','ЭП-0199','ЭП-057','АК-069','ФЛ-03К']
  const enamels = ['ПФ-115','ПФ-133','ХС-413','ХС-717','ЭП-140','АК-124','АС-1115','КО-198','НЦ-132','Эмаль ХВ-124']
  const colors = ['серый','белый','красный','зелёный','синий','чёрный','жёлтый','коричневый','голубой','бежевый']
  let coatCount = 0
  for (const p of primers) {
    await db.coating.create({ data: { code: `Грунт-${p}`, name: `Грунт ${p}`, gost: 'ГОСТ 9.032-74', type: 'primer', params: JSON.stringify({ grade: p, thickness: 20 }) } }); coatCount++
    for (const e of enamels.slice(0, 5)) {
      await db.coating.create({ data: { code: `Система-${p}+${e}`, name: `Система ${p}+${e}`, gost: 'ГОСТ 9.032-74', type: 'primer', params: JSON.stringify({ primer: p, enamel: e, thickness: 60, compatible: true }) } }); coatCount++
    }
  }
  for (const e of enamels) {
    for (const c of colors) {
      await db.coating.create({ data: { code: `Эмаль-${e}-${c}`, name: `Эмаль ${e} ${c}`, gost: 'ГОСТ 9.032-74', type: 'enamel', params: JSON.stringify({ grade: e, color: c, thickness: 25 }) } }); coatCount++
    }
  }
  console.log(`  Coatings: ${coatCount}`)

  // === Трубопроводная арматура (~400) ===
  const flangeTypes = ['плоский','встык','свободный']
  const flangePressures = [1.0, 1.6, 2.5, 4.0, 6.3, 10.0, 16.0]
  let pipeCount = 0
  for (const d of pipeDiameters) {
    for (const p of flangePressures) {
      for (const ft of flangeTypes) {
        const code = `Фланец-${d}-${p}-${ft}`
        await db.pipeFitting.create({ data: { code, name: `Фланец DN${d} PN${p} ${ft}`, gost: ft === 'встык' ? 'ГОСТ 12821-80' : ft === 'свободный' ? 'ГОСТ 12822-80' : 'ГОСТ 12820-80', type: 'flange', params: JSON.stringify({ diameter: d, pressure: p, subtype: ft }) } }); pipeCount++
      }
    }
  }
  const elbowAngles = [45, 90]
  for (const d of pipeDiameters) { for (const a of elbowAngles) {
    await db.pipeFitting.create({ data: { code: `Отвод-${d}-${a}`, name: `Отвод DN${d} ${a}°`, gost: 'ГОСТ 17375-2001', type: 'elbow', params: JSON.stringify({ diameter: d, angle: a }) } }); pipeCount++
  } }
  for (const d of pipeDiameters) {
    await db.pipeFitting.create({ data: { code: `Тройник-${d}`, name: `Тройник DN${d}`, gost: 'ГОСТ 17376-2001', type: 'tee', params: JSON.stringify({ diameter: d }) } }); pipeCount++
    await db.pipeFitting.create({ data: { code: `Переход-${d}`, name: `Переход DN${d}`, gost: 'ГОСТ 17378-2001', type: 'reducer', params: JSON.stringify({ diameter: d }) } }); pipeCount++
    await db.pipeFitting.create({ data: { code: `Заглушка-${d}`, name: `Заглушка DN${d}`, gost: 'ГОСТ 17379-2001', type: 'cap', params: JSON.stringify({ diameter: d }) } }); pipeCount++
  }
  console.log(`  Pipe fittings: ${pipeCount}`)

  // === Судовое оборудование (~400) ===
  const pumpTypes = ['центробежный','поршневой','шестерённый','винтовой','вихревой']
  for (let i = 0; i < 80; i++) {
    const t = pumpTypes[i % pumpTypes.length]
    await db.shipEquipment.create({ data: { code: `Насос-${t}-${i+1}`, name: `Насос ${t} ${i+1}`, gost: 'ОСТ 5.4166-78', type: 'pump', params: JSON.stringify({ subtype: t, capacity: 10 + i * 5, pressure: 0.5 + i * 0.2 }) } })
  }
  for (let i = 0; i < 40; i++) {
    await db.shipEquipment.create({ data: { code: `Сепаратор-${i+1}`, name: `Сепаратор ${i+1}`, gost: 'ОСТ 5.4180-75', type: 'separator', params: JSON.stringify({ capacity: 500 + i * 100 }) } })
  }
  for (const mass of [50, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000] as const) {
    for (let i = 0; i < 5; i++) {
      await db.shipEquipment.create({ data: { code: `Якорь-${mass}кг-${i+1}`, name: `Якорь Холла ${mass} кг`, gost: 'ГОСТ 5488-79', type: 'anchor', params: JSON.stringify({ mass, type: 'Холла' }) } })
    }
  }
  const valveTypes = ['запорный','обратный','предохранительный','регулирующий']
  for (const d of [15, 20, 25, 32, 40, 50, 65, 80, 100, 150, 200, 250, 300]) {
    for (const v of valveTypes) {
      await db.shipEquipment.create({ data: { code: `Клапан-${v}-DN${d}`, name: `Клапан ${v} DN${d}`, gost: 'ОСТ 5.0194-75', type: 'valve', params: JSON.stringify({ diameter: d, subtype: v, pressure: 1.6 }) } })
    }
  }
  for (let i = 0; i < 60; i++) {
    await db.shipEquipment.create({ data: { code: `Шпиль-${i+1}`, name: `Шпиль ${i+1}`, gost: 'ОСТ 5.2392-85', type: 'winch', params: JSON.stringify({ capacity: 10 + i * 5 }) } })
  }
  let shipCount = await db.shipEquipment.count()
  console.log(`  Ship equipment: ${shipCount}`)

  const total = matCount + fastCount + bearCount + rollCount + weldCount + coatCount + pipeCount + shipCount
  console.log(`\n📊 Total reference records: ${total}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
