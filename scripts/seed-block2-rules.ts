// Блок 2: параметризованные правила 320 → 500+
// Каждое правило: code, name, gost, paragraph, severity, category, method, gostField
// Ссылаются на справочники (Блок 3) через params
import { db } from '../src/lib/db'

interface RuleSeed {
  code: string
  name: string
  description: string
  category: string
  method: string
  severity: string
  gostField: string
  standardCode?: string
  params?: Record<string, any> // параметризованные данные для правила
}

const RULES: RuleSeed[] = [
  // === 2.1 Сварка судостроительная (+25) ===
  { code: 'R-WELD-031', name: 'Катет углового шва по толщине детали', description: 'Катет углового шва должен соответствовать толщине детали по ОСТ 5.РД', category: 'welding', method: 'semantic', severity: 'high', gostField: 'Сварка', standardCode: 'ОСТ 5Р.0206-2002', params: { min: 3, max: 20, byThickness: true } },
  { code: 'R-WELD-032', name: 'Обозначение сварного шва по ГОСТ 2.312', description: 'Структура обозначения сварного шва должна соответствовать ГОСТ 2.312', category: 'welding', method: 'vision', severity: 'high', gostField: 'Сварка', standardCode: 'ГОСТ 2.312-72' },
  { code: 'R-WELD-033', name: 'Тип соединения С/У/Т по ГОСТ 5264', description: 'Тип сварного соединения должен быть из перечня ГОСТ 5264', category: 'welding', method: 'vision', severity: 'medium', gostField: 'Сварка', standardCode: 'ГОСТ 5264-80', params: { types: ['С1','С2','С3','С4','С5','С6','С7','С8','У1','У2','У3','У4','У5','У6','У7','У8','У9','Т1','Т2','Т3','Т4','Т5','Т6','Т7','Т8','Т9'] } },
  { code: 'R-WELD-034', name: 'Тип соединения С/У/Т по ГОСТ 14771', description: 'Тип сварного соединения в защитном газе по ГОСТ 14771', category: 'welding', method: 'vision', severity: 'medium', gostField: 'Сварка', standardCode: 'ГОСТ 14771-76', params: { types: ['С1','С2','С3','С4','С5','С6','С7','У1','У2','У3','У4','У5','У6','У7','Т1','Т2','Т3','Т4'] } },
  { code: 'R-WELD-035', name: 'Контроль ВИК для категории I', description: 'Сварные швы категории I требуют визуально-измерительного контроля', category: 'welding', method: 'semantic', severity: 'high', gostField: 'Сварка', standardCode: 'ГОСТ Р ИСО 17635-2015', params: { category: 'I', methods: ['ВИК'] } },
  { code: 'R-WELD-036', name: 'Контроль УЗК для категории I', description: 'Сварные швы категории I требуют ультразвукового контроля', category: 'welding', method: 'semantic', severity: 'high', gostField: 'Сварка', standardCode: 'ГОСТ Р ИСО 17640-2017', params: { category: 'I', methods: ['УЗК'] } },
  { code: 'R-WELD-037', name: 'Контроль РК для категории I', description: 'Сварные швы категории I требуют радиографического контроля', category: 'welding', method: 'semantic', severity: 'high', gostField: 'Сварка', standardCode: 'ГОСТ Р ИСО 17636-1-2017', params: { category: 'I', methods: ['РК'] } },
  { code: 'R-WELD-038', name: 'Сварочные материалы в ТТ', description: 'В ТТ должны быть указаны марки электродов/проволоки/флюса', category: 'welding', method: 'semantic', severity: 'medium', gostField: 'Сварка', standardCode: 'ГОСТ 2246-70', params: { refTable: 'WeldingMaterial' } },
  { code: 'R-WELD-039', name: 'Марка электрода из справочника', description: 'Марка электрода должна быть из справочника WeldingMaterial', category: 'welding', method: 'semantic', severity: 'medium', gostField: 'Сварка', standardCode: 'ГОСТ 9466-75', params: { refTable: 'WeldingMaterial', type: 'electrode' } },
  { code: 'R-WELD-040', name: 'Марка проволоки из справочника', description: 'Марка сварочной проволоки должна быть из справочника', category: 'welding', method: 'semantic', severity: 'medium', gostField: 'Сварка', standardCode: 'ГОСТ 2246-70', params: { refTable: 'WeldingMaterial', type: 'wire' } },
  { code: 'R-WELD-041', name: 'Флюс из справочника', description: 'Марка флюса должна быть из справочника WeldingMaterial', category: 'welding', method: 'semantic', severity: 'low', gostField: 'Сварка', standardCode: 'ГОСТ 9087-81', params: { refTable: 'WeldingMaterial', type: 'flux' } },
  { code: 'R-WELD-042', name: 'ГОСТ 5264 в перечне при сварке', description: 'При наличии ручной дуговой сварки ГОСТ 5264 в перечне', category: 'welding', method: 'semantic', severity: 'high', gostField: 'Перечень ГОСТ', standardCode: 'ГОСТ 5264-80' },
  { code: 'R-WELD-043', name: 'ГОСТ 14771 в перечне при сварке в газе', description: 'При сварке в защитном газе ГОСТ 14771 в перечне', category: 'welding', method: 'semantic', severity: 'high', gostField: 'Перечень ГОСТ', standardCode: 'ГОСТ 14771-76' },
  { code: 'R-WELD-044', name: 'Термообработка шва для толстостенных', description: 'Для деталей толщиной >20мм — термообработка шва', category: 'welding', method: 'semantic', severity: 'medium', gostField: 'Сварка', standardCode: 'ГОСТ 2.312-72', params: { minThickness: 20 } },
  { code: 'R-WELD-045', name: 'Подварка корня шва', description: 'Для двусторонних швов — подварка корня обязательна', category: 'welding', method: 'semantic', severity: 'medium', gostField: 'Сварка', standardCode: 'ГОСТ 2.312-72' },
  { code: 'R-WELD-046', name: 'Шов по замкнутому контуру — обозначение', description: 'Шов по замкнутому контуру обозначается символом ○', category: 'welding', method: 'vision', severity: 'low', gostField: 'Сварка', standardCode: 'ГОСТ 2.312-72' },
  { code: 'R-WELD-047', name: 'Монтажный шов — обозначение флажком', description: 'Монтажный шов обозначается флажком на выноске', category: 'welding', method: 'vision', severity: 'medium', gostField: 'Сварка', standardCode: 'ГОСТ 2.312-72' },
  { code: 'R-WELD-048', name: 'Прерывистый шов — длина и шаг', description: 'Для прерывистых швов указываются длина проваренного участка и шаг', category: 'welding', method: 'vision', severity: 'medium', gostField: 'Сварка', standardCode: 'ГОСТ 2.312-72' },
  { code: 'R-WELD-049', name: 'Снятие усиления шва', description: 'При необходимости снятия усиления — обозначение в ТТ', category: 'welding', method: 'semantic', severity: 'low', gostField: 'Сварка', standardCode: 'ГОСТ 2.312-72' },
  { code: 'R-WELD-050', name: 'Подготовка кромок под сварку', description: 'Разделка кромок указывается на чертеже', category: 'welding', method: 'vision', severity: 'medium', gostField: 'Сварка', standardCode: 'ГОСТ 5264-80' },
  { code: 'R-WELD-051', name: 'Защитный газ указан', description: 'При сварке в защитном газе — тип газа указан в ТТ', category: 'welding', method: 'semantic', severity: 'medium', gostField: 'Сварка', standardCode: 'ГОСТ 14771-76' },
  { code: 'R-WELD-052', name: 'Катет шва для таврового соединения', description: 'Катет таврового шва указан и в пределах 3-20мм', category: 'welding', method: 'vision', severity: 'medium', gostField: 'Сварка', standardCode: 'ГОСТ 5264-80', params: { min: 3, max: 20 } },
  { code: 'R-WELD-053', name: 'Категория шва указана', description: 'Для ответственных конструкций категория шва указана', category: 'welding', method: 'semantic', severity: 'medium', gostField: 'Сварка', standardCode: 'ОСТ 5Р.0206-2002', params: { categories: ['I','II','III','IV'] } },
  { code: 'R-WELD-054', name: 'Дефекты швов по ГОСТ 30242', description: 'Сварные швы не должны иметь дефектов по ГОСТ 30242', category: 'welding', method: 'vision', severity: 'high', gostField: 'Сварка', standardCode: 'ГОСТ 30242-97' },
  { code: 'R-WELD-055', name: 'Сертификат Регистра на сварочные материалы', description: 'Сварочные материалы должны иметь сертификат Регистра', category: 'welding', method: 'semantic', severity: 'high', gostField: 'Сварка', standardCode: 'Регистр. ПКС. Часть II «Корпус»' },

  // === 2.2 Корпусные конструкции (+20) ===
  { code: 'R-HULL-001', name: 'Минимальная толщина обшивки корпуса', description: 'Толщина обшивки корпуса не менее требуемой Регистром', category: 'shipbuilding', method: 'semantic', severity: 'high', gostField: 'Корпус', standardCode: 'Регистр. ПКС. Часть II «Корпус»', params: { refTable: 'RolledProduct', minThickness: true } },
  { code: 'R-HULL-002', name: 'Минимальная толщина листов настила', description: 'Толщина настила палубы не менее требуемой', category: 'shipbuilding', method: 'semantic', severity: 'high', gostField: 'Корпус', standardCode: 'Регистр. ПКС. Часть II «Корпус»' },
  { code: 'R-HULL-003', name: 'Подкрепления под оборудование', description: 'В районах установки оборудования — усиленный набор', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Корпус', standardCode: 'Регистр. ПКС. Часть II «Корпус»' },
  { code: 'R-HULL-004', name: 'Ссылка на теоретический чертёж', description: 'Должна быть ссылка на теоретический чертёж корпуса', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Корпус', standardCode: 'ГОСТ 2.201-80' },
  { code: 'R-HULL-005', name: 'Районирование корпуса', description: 'Корпус должен быть разбит на районы с указанием толщин', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Корпус', standardCode: 'Регистр. ПКС. Часть II «Корпус»' },
  { code: 'R-HULL-006', name: 'Шпация набора указана', description: 'Шпация поперечного/продольного набора указана', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Корпус', standardCode: 'Регистр. ПКС. Часть II «Корпус»' },
  { code: 'R-HULL-007', name: 'Высота сечения балок набора', description: 'Высота сечения балок набора корпуса указана', category: 'building', method: 'semantic', severity: 'medium', gostField: 'Корпус', standardCode: 'Регистр. ПКС. Часть II «Корпус»' },
  { code: 'R-HULL-008', name: 'Толщина стенки балок набора', description: 'Толщина стенки балок набора корпуса указана', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Корпус', standardCode: 'Регистр. ПКС. Часть II «Корпус»' },
  { code: 'R-HULL-009', name: 'Толщина полки балок набора', description: 'Толщина полки балок набора корпуса указана', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Корпус', standardCode: 'Регистр. ПКС. Часть II «Корпус»' },
  { code: 'R-HULL-010', name: 'Переборки водонепроницаемые', description: 'Водонепроницаемые переборки — толщина и шаг набора', category: 'shipbuilding', method: 'semantic', severity: 'high', gostField: 'Корпус', standardCode: 'Регистр. ПКС. Часть IV «Остойчивость»' },
  { code: 'R-HULL-011', name: 'Ледовые усиления — маркировка', description: 'Ледовые усиления маркируются на чертеже корпуса', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Корпус', standardCode: 'Регистр. ПКС. Часть XV «Ледовые усиления»' },
  { code: 'R-HULL-012', name: 'Антикавитационная защита', description: 'Для районов гребных винтов — защита от кавитации', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Корпус', standardCode: 'Регистр. ПКС. Часть II «Корпус»' },
  { code: 'R-HULL-013', name: 'Коррозионный износ — припуск', description: 'Припуск на коррозионный износ указан', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Корпус', standardCode: 'Регистр. ПКС. Часть II «Корпус»' },
  { code: 'R-HULL-014', name: 'Материал корпуса из справочника', description: 'Марка стали корпуса из справочника Material', category: 'shipbuilding', method: 'semantic', severity: 'high', gostField: 'Материал', standardCode: 'ГОСТ 19281-2014', params: { refTable: 'Material', category: 'shipbuilding' } },
  { code: 'R-HULL-015', name: 'Сертификат Регистра на материал корпуса', description: 'Материал корпуса должен иметь сертификат Регистра', category: 'shipbuilding', method: 'semantic', severity: 'high', gostField: 'Материал', standardCode: 'Регистр. ПКС. Часть II «Корпус»' },
  { code: 'R-HULL-016', name: 'Шов — непрерывный/прерывистый', description: 'Для корпусных конструкций характер шва указан', category: 'shipbuilding', method: 'vision', severity: 'low', gostField: 'Сварка', standardCode: 'ГОСТ 2.312-72' },
  { code: 'R-HULL-017', name: 'Катет шва корпусных конструкций', description: 'Катет шва не менее 0.7×толщины детали', category: 'shipbuilding', method: 'vision', severity: 'medium', gostField: 'Сварка', standardCode: 'ОСТ 5.0006-72' },
  { code: 'R-HULL-018', name: 'Доступ для сварки и контроля', description: 'Конструкция должна обеспечивать доступ для сварки и контроля', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Корпус', standardCode: 'ОСТ 5.9200-74' },
  { code: 'R-HULL-019', name: 'Допуски на корпусные конструкции', description: 'Допуски по ОСТ 5.9201-75 указаны', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Допуски', standardCode: 'ОСТ 5.9201-75' },
  { code: 'R-HULL-020', name: 'Маркировка деталей корпуса', description: 'Детали корпуса должны иметь маркировку по ГОСТ 2.314', category: 'shipbuilding', method: 'semantic', severity: 'low', gostField: 'Маркировка', standardCode: 'ГОСТ 2.314-68' },

  // === 2.3 Трубопроводы судовые (+15) ===
  { code: 'R-PIPE-001', name: 'Материал труб по среде', description: 'Материал труб соответствует рабочей среде по ОСТ 5.528', category: 'shipbuilding', method: 'semantic', severity: 'high', gostField: 'Трубопроводы', standardCode: 'ОСТ 5.0155-75', params: { refTable: 'PipeFitting' } },
  { code: 'R-PIPE-002', name: 'Диаметр труб по расходу', description: 'Диаметр труб соответствует расчётному расходу', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Трубопроводы', standardCode: 'ОСТ 5.0155-75' },
  { code: 'R-PIPE-003', name: 'Компенсаторы температурных расширений', description: 'Для горячих трубопроводов — компенсаторы', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Трубопроводы', standardCode: 'ОСТ 5.0271-76' },
  { code: 'R-PIPE-004', name: 'Испытания на герметичность', description: 'В ТТ указано давление и вид испытаний', category: 'shipbuilding', method: 'semantic', severity: 'high', gostField: 'Трубопроводы', standardCode: 'ОСТ 5.0091-74' },
  { code: 'R-PIPE-005', name: 'Маркировка трасс трубопроводов', description: 'Трассы промаркированы по назначению', category: 'shipbuilding', method: 'semantic', severity: 'low', gostField: 'Трубопроводы', standardCode: 'ОСТ 5.0155-75' },
  { code: 'R-PIPE-006', name: 'Труба из справочника', description: 'Труба должна найтись в справочнике RolledProduct', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Трубопроводы', standardCode: 'ГОСТ 8732-78', params: { refTable: 'RolledProduct', type: 'pipe' } },
  { code: 'R-PIPE-007', name: 'Фланец из справочника', description: 'Фланец должен найтись в справочнике PipeFitting', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Трубопроводы', standardCode: 'ГОСТ 12821-80', params: { refTable: 'PipeFitting', type: 'flange' } },
  { code: 'R-PIPE-008', name: 'Отвод из справочника', description: 'Отвод трубопровода из справочника PipeFitting', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Трубопроводы', standardCode: 'ГОСТ 17375-2001', params: { refTable: 'PipeFitting', type: 'elbow' } },
  { code: 'R-PIPE-009', name: 'Тройник из справочника', description: 'Тройник трубопровода из справочника PipeFitting', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Трубопроводы', standardCode: 'ГОСТ 17376-2001', params: { refTable: 'PipeFitting', type: 'tee' } },
  { code: 'R-PIPE-010', name: 'Крепления трубопроводов', description: 'Крепления трубопроводов указаны по ОСТ 5.0524', category: 'shipbuilding', method: 'semantic', severity: 'low', gostField: 'Трубопроводы', standardCode: 'ОСТ 5.0524-77' },
  { code: 'R-PIPE-011', name: 'Арматура судовая', description: 'Арматура из справочника ShipEquipment', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Трубопроводы', standardCode: 'ОСТ 5.0194-75', params: { refTable: 'ShipEquipment', type: 'valve' } },
  { code: 'R-PIPE-012', name: 'Баллоны судовые', description: 'Баллоны по ОСТ 5.0953 с указанием объёма и давления', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Трубопроводы', standardCode: 'ОСТ 5.0953-76' },
  { code: 'R-PIPE-013', name: 'Противопожарные системы', description: 'Противопожарные системы по ОСТ 5.1011', category: 'shipbuilding', method: 'semantic', severity: 'high', gostField: 'Трубопроводы', standardCode: 'ОСТ 5.1011-77' },
  { code: 'R-PIPE-014', name: 'Шпигаты', description: 'Шпигаты по ОСТ 5.0601 с указанием размера', category: 'shipbuilding', method: 'semantic', severity: 'low', gostField: 'Трубопроводы', standardCode: 'ОСТ 5.0601-78' },
  { code: 'R-PIPE-015', name: 'Мачты и рангоут', description: 'Мачты по ОСТ 5.1140 с указанием типа', category: 'shipbuilding', method: 'semantic', severity: 'low', gostField: 'Судовые устройства', standardCode: 'ОСТ 5.1140-76' },

  // === 2.4 Требования РС/РР (+10) ===
  { code: 'R-REG-001', name: 'Ссылка на правила Регистра', description: 'Документ должен ссылаться на применимые правила РС', category: 'shipbuilding', method: 'semantic', severity: 'high', gostField: 'Регистр', standardCode: 'Регистр. ПКС. Часть I «Классификация»' },
  { code: 'R-REG-002', name: 'Минимальная толщина по классу судна', description: 'Толщина обшивки соответствует классу судна', category: 'shipbuilding', method: 'semantic', severity: 'high', gostField: 'Корпус', standardCode: 'Регистр. ПКС. Часть II «Корпус»', params: { byClass: true } },
  { code: 'R-REG-003', name: 'Сертификат Регистра на материал', description: 'Материал должен иметь сертификат Регистра', category: 'shipbuilding', method: 'semantic', severity: 'high', gostField: 'Материал', standardCode: 'Регистр. ПКС. Часть II «Корпус»' },
  { code: 'R-REG-004', name: 'Согласование с Регистром', description: 'Документ согласован с Регистром (РД 5Р.0007)', category: 'shipbuilding', method: 'semantic', severity: 'high', gostField: 'Регистр', standardCode: 'РД 5Р.0007-2005' },
  { code: 'R-REG-005', name: 'Остойчивость по Регистру', description: 'Остойчивость проверена по требованиям Регистра', category: 'shipbuilding', method: 'semantic', severity: 'high', gostField: 'Остойчивость', standardCode: 'Регистр. ПКС. Часть IV «Остойчивость»' },
  { code: 'R-REG-006', name: 'Непотопляемость по Регистру', description: 'Непотопляемость проверена по требованиям Регистра', category: 'shipbuilding', method: 'semantic', severity: 'high', gostField: 'Непотопляемость', standardCode: 'Регистр. ПКС. Часть V «Деление на отсеки»' },
  { code: 'R-REG-007', name: 'Пожарная защита по Регистру', description: 'Пожарная защита соответствует требованиям Регистра', category: 'shipbuilding', method: 'semantic', severity: 'high', gostField: 'Пожар', standardCode: 'Регистр. ПКС. Часть VI «Пожарная защита»' },
  { code: 'R-REG-008', name: 'Механизмы по Регистру', description: 'Механизмы соответствуют требованиям Регистра', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Механизмы', standardCode: 'Регистр. ПКС. Часть VII «Механические установки»' },
  { code: 'R-REG-009', name: 'Электрооборудование по Регистру', description: 'Электрооборудование соответствует требованиям Регистра', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Электрооборудование', standardCode: 'Регистр. ПКС. Часть X «Электрическое оборудование»' },
  { code: 'R-REG-010', name: 'Автоматизация по Регистру', description: 'Системы автоматизации соответствуют требованиям Регистра', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Автоматизация', standardCode: 'Регистр. ПКС. Часть XIV «Автоматизация»' },

  // === 2.5 Антикоррозионная защита (+10) ===
  { code: 'R-PAINT-001', name: 'Степень очистки поверхности', description: 'Степень очистки поверхности перед окраской указана', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Покрытие', standardCode: 'ГОСТ 9.402-2004', params: { refTable: 'Coating', type: 'preparation' } },
  { code: 'R-PAINT-002', name: 'Толщина покрытия', description: 'Толщина покрытия указана в мкм', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Покрытие', standardCode: 'ГОСТ 9.407-2015' },
  { code: 'R-PAINT-003', name: 'Совместимость грунт/эмаль', description: 'Грунт и эмаль совместимы по справочнику Coating', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Покрытие', standardCode: 'ГОСТ 9.032-74', params: { refTable: 'Coating', check: 'compatibility' } },
  { code: 'R-PAINT-004', name: 'Грунт из справочника', description: 'Марка грунта из справочника Coating', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Покрытие', standardCode: 'ГОСТ 9.032-74', params: { refTable: 'Coating', type: 'primer' } },
  { code: 'R-PAINT-005', name: 'Эмаль из справочника', description: 'Марка эмали из справочника Coating', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Покрытие', standardCode: 'ГОСТ 9.032-74', params: { refTable: 'Coating', type: 'enamel' } },
  { code: 'R-PAINT-006', name: 'Район применения покрытия', description: 'Район применения покрытия указан (У/УХЛ/М/О)', category: 'shipbuilding', method: 'semantic', severity: 'low', gostField: 'Покрытие', standardCode: 'ГОСТ 15150-69' },
  { code: 'R-PAINT-007', name: 'Цвет покрытия по RAL', description: 'Цвет покрытия указан по каталогу RAL', category: 'shipbuilding', method: 'semantic', severity: 'low', gostField: 'Покрытие', standardCode: 'ГОСТ 9.407-2015' },
  { code: 'R-PAINT-008', name: 'Количество слоёв покрытия', description: 'Количество слоёв покрытия указано', category: 'shipbuilding', method: 'semantic', severity: 'low', gostField: 'Покрытие', standardCode: 'ГОСТ 9.032-74' },
  { code: 'R-PAINT-009', name: 'Шпатлёвка при необходимости', description: 'Шпатлёвка указана при неровностях поверхности', category: 'shipbuilding', method: 'semantic', severity: 'low', gostField: 'Покрытие', standardCode: 'ГОСТ 20833-75' },
  { code: 'R-PAINT-010', name: 'Метод нанесения покрытия', description: 'Метод нанесения (кисть/распылитель/окунание) указан', category: 'shipbuilding', method: 'semantic', severity: 'low', gostField: 'Покрытие', standardCode: 'ГОСТ 9.032-74' },

  // === 2.6 Допуски/посадки/шероховатость (+40) ===
  // Квалитеты по ГОСТ 25346
  { code: 'R-TOL-001', name: 'Квалитет IT5 — точные детали', description: 'Для точных деталей квалитет не грубее IT5', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Допуски', standardCode: 'ГОСТ 25346-2013', params: { grade: 5, applicable: 'precision' } },
  { code: 'R-TOL-002', name: 'Квалитет IT6 — подшипниковые посадки', description: 'Для подшипниковых посадок квалитет не грубее IT6', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Допуски', standardCode: 'ГОСТ 25346-2013', params: { grade: 6, applicable: 'bearing' } },
  { code: 'R-TOL-003', name: 'Квалитет IT7 — зубчатые колёса', description: 'Для посадок зубчатых колёс квалитет не грубее IT7', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Допуски', standardCode: 'ГОСТ 25346-2013', params: { grade: 7, applicable: 'gear' } },
  { code: 'R-TOL-004', name: 'Квалитет IT8 — общие допуски', description: 'Для общих допусков квалитет не грубее IT8', category: 'tolerances', method: 'vision', severity: 'low', gostField: 'Допуски', standardCode: 'ГОСТ 25346-2013', params: { grade: 8, applicable: 'general' } },
  { code: 'R-TOL-005', name: 'Квалитет IT12 — свободные размеры', description: 'Для свободных размеров квалитет не грубее IT12', category: 'tolerances', method: 'semantic', severity: 'low', gostField: 'Допуски', standardCode: 'ГОСТ 30893.1-2002', params: { grade: 12, applicable: 'free' } },
  // Посадки по ГОСТ 25347
  { code: 'R-FIT-001', name: 'Посадка H7/js6 — переходная', description: 'Для точных сборок — посадка H7/js6', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Посадки', standardCode: 'ГОСТ 25347-82', params: { hole: 'H7', shaft: 'js6' } },
  { code: 'R-FIT-002', name: 'Посадка H7/k6 — переходная', description: 'Для зубчатых колёс — посадка H7/k6', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Посадки', standardCode: 'ГОСТ 25347-82', params: { hole: 'H7', shaft: 'k6' } },
  { code: 'R-FIT-003', name: 'Посадка H7/m6 — переходная', description: 'Для тяжело нагруженных — H7/m6', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Посадки', standardCode: 'ГОСТ 25347-82', params: { hole: 'H7', shaft: 'm6' } },
  { code: 'R-FIT-004', name: 'Посадка H7/n6 — глухая', description: 'Для неразъёмных — H7/n6', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Посадки', standardCode: 'ГОСТ 25347-82', params: { hole: 'H7', shaft: 'n6' } },
  { code: 'R-FIT-005', name: 'Посадка H7/p6 — прессовая', description: 'Для прессовых — H7/p6', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Посадки', standardCode: 'ГОСТ 25347-82', params: { hole: 'H7', shaft: 'p6' } },
  { code: 'R-FIT-006', name: 'Посадка H7/g6 — скользящая', description: 'Для точного центрирования — H7/g6', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Посадки', standardCode: 'ГОСТ 25347-82', params: { hole: 'H7', shaft: 'g6' } },
  { code: 'R-FIT-007', name: 'Посадка H7/f7 — ходовая', description: 'Для подвижных — H7/f7', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Посадки', standardCode: 'ГОСТ 25347-82', params: { hole: 'H7', shaft: 'f7' } },
  { code: 'R-FIT-008', name: 'Посадка H7/e8 — легкоходовая', description: 'Для быстроходных — H7/e8', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Посадки', standardCode: 'ГОСТ 25347-82', params: { hole: 'H7', shaft: 'e8' } },
  { code: 'R-FIT-009', name: 'Посадка H7/d8 — теплоходовая', description: 'Для теплонагруженных — H7/d8', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Посадки', standardCode: 'ГОСТ 25347-82', params: { hole: 'H7', shaft: 'd8' } },
  { code: 'R-FIT-010', name: 'Посадка H11/d11 — свободная', description: 'Для грубых — H11/d11', category: 'tolerances', method: 'vision', severity: 'low', gostField: 'Посадки', standardCode: 'ГОСТ 25347-82', params: { hole: 'H11', shaft: 'd11' } },
  // Шероховатость
  { code: 'R-ROUGH-001', name: 'Ra для IT5', description: 'Для квалитета IT5 шероховатость Ra не более 0.32', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Шероховатость', standardCode: 'ГОСТ 2789-73', params: { grade: 5, maxRa: 0.32 } },
  { code: 'R-ROUGH-002', name: 'Ra для IT6', description: 'Для квалитета IT6 шероховатость Ra не более 0.63', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Шероховатость', standardCode: 'ГОСТ 2789-73', params: { grade: 6, maxRa: 0.63 } },
  { code: 'R-ROUGH-003', name: 'Ra для IT7', description: 'Для квалитета IT7 шероховатость Ra не более 1.25', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Шероховатость', standardCode: 'ГОСТ 2789-73', params: { grade: 7, maxRa: 1.25 } },
  { code: 'R-ROUGH-004', name: 'Ra для IT8', description: 'Для квалитета IT8 шероховатость Ra не более 2.5', category: 'tolerances', method: 'vision', severity: 'low', gostField: 'Шероховатость', standardCode: 'ГОСТ 2789-73', params: { grade: 8, maxRa: 2.5 } },
  { code: 'R-ROUGH-005', name: 'Ra для IT12', description: 'Для свободных размеров Ra не более 12.5', category: 'tolerances', method: 'semantic', severity: 'low', gostField: 'Шероховатость', standardCode: 'ГОСТ 2789-73', params: { grade: 12, maxRa: 12.5 } },
  { code: 'R-ROUGH-006', name: 'Шероховатость по ГОСТ 2.309', description: 'Обозначение шероховатости по ГОСТ 2.309', category: 'tolerances', method: 'vision', severity: 'low', gostField: 'Шероховатость', standardCode: 'ГОСТ 2.309-73' },
  { code: 'R-ROUGH-007', name: 'Неуказанная шероховатость в ТТ', description: 'Неуказанная шероховатость указана в ТТ', category: 'tolerances', method: 'semantic', severity: 'medium', gostField: 'Шероховатость', standardCode: 'ГОСТ 2.309-73' },
  { code: 'R-ROUGH-008', name: 'Шероховатость рабочих поверхностей', description: 'Рабочие поверхности имеют указанную шероховатость', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Шероховатость', standardCode: 'ГОСТ 2789-73' },
  // Допуски формы
  { code: 'R-FORM-001', name: 'Допуск прямолинейности', description: 'Допуск прямолинейности указан для направляющих', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Допуски формы', standardCode: 'ГОСТ 2.308-2011' },
  { code: 'R-FORM-002', name: 'Допуск плоскостности', description: 'Допуск плоскостности указан для базовых поверхностей', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Допуски формы', standardCode: 'ГОСТ 2.308-2011' },
  { code: 'R-FORM-003', name: 'Допуск круглости', description: 'Допуск круглости указан для цилиндрических поверхностей', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Допуски формы', standardCode: 'ГОСТ 2.308-2011' },
  { code: 'R-FORM-004', name: 'Допуск цилиндричности', description: 'Допуск цилиндричности для ответственных цилиндров', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Допуски формы', standardCode: 'ГОСТ 2.308-2011' },
  { code: 'R-FORM-005', name: 'Допуск профиля продольного сечения', description: 'Допуск профиля продольного сечения для цилиндров', category: 'tolerances', method: 'vision', severity: 'low', gostField: 'Допуски формы', standardCode: 'ГОСТ 2.308-2011' },
  // Допуски расположения
  { code: 'R-LOC-001', name: 'Допуск параллельности', description: 'Допуск параллельности указан для баз', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Допуски расположения', standardCode: 'ГОСТ 2.308-2011' },
  { code: 'R-LOC-002', name: 'Допуск перпендикулярности', description: 'Допуск перпендикулярности указан для торцов', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Допуски расположения', standardCode: 'ГОСТ 2.308-2011' },
  { code: 'R-LOC-003', name: 'Допуск соосности', description: 'Допуск соосности для ответственных посадок', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Допуски расположения', standardCode: 'ГОСТ 2.308-2011' },
  { code: 'R-LOC-004', name: 'Допуск симметричности', description: 'Допуск симметричности для шпоночных пазов', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Допуски расположения', standardCode: 'ГОСТ 2.308-2011' },
  { code: 'R-LOC-005', name: 'Допуск позиционный', description: 'Допуск позиционный для отверстий', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Допуски расположения', standardCode: 'ГОСТ 2.308-2011' },
  { code: 'R-LOC-006', name: 'Допуск пересечения осей', description: 'Допуск пересечения осей для ответственных узлов', category: 'tolerances', method: 'vision', severity: 'low', gostField: 'Допуски расположения', standardCode: 'ГОСТ 2.308-2011' },
  { code: 'R-LOC-007', name: 'Допуск биения торцевого', description: 'Допуск торцевого биения для вращающихся деталей', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Допуски расположения', standardCode: 'ГОСТ 2.308-2011' },
  { code: 'R-LOC-008', name: 'Допуск биения радиального', description: 'Допуск радиального биения для валов', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Допуски расположения', standardCode: 'ГОСТ 2.308-2011' },
  { code: 'R-LOC-009', name: 'Допуск полного биения', description: 'Допуск полного биения для высокооборотных валов', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Допуски расположения', standardCode: 'ГОСТ 2.308-2011' },
  { code: 'R-LOC-010', name: 'База для допусков указана', description: 'База для допусков формы и расположения указана', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Допуски расположения', standardCode: 'ГОСТ 2.308-2011' },
  { code: 'R-LOC-011', name: 'Суммарный допуск', description: 'Суммарные допуски формы и расположения указаны', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Допуски расположения', standardCode: 'ГОСТ 2.308-2011' },
  { code: 'R-LOC-012', name: 'Неуказанные допуски формы', description: 'Неуказанные допуски формы в ТТ по ГОСТ 30893.2', category: 'tolerances', method: 'semantic', severity: 'low', gostField: 'Допуски формы', standardCode: 'ГОСТ 30893.2-2002' },

  // === 2.7 Крепёж (+20) ===
  { code: 'R-FAST-001', name: 'Болт из справочника', description: 'Болт в спецификации найден в справочнике Fastener', category: 'tolerances', method: 'semantic', severity: 'medium', gostField: 'Крепёж', standardCode: 'ГОСТ 7798-70', params: { refTable: 'Fastener', type: 'bolt' } },
  { code: 'R-FAST-002', name: 'Гайка из справочника', description: 'Гайка в спецификации найдена в справочнике Fastener', category: 'tolerances', method: 'semantic', severity: 'medium', gostField: 'Крепёж', standardCode: 'ГОСТ 5915-70', params: { refTable: 'Fastener', type: 'nut' } },
  { code: 'R-FAST-003', name: 'Шайба из справочника', description: 'Шайба найдена в справочнике Fastener', category: 'tolerances', method: 'semantic', severity: 'low', gostField: 'Крепёж', standardCode: 'ГОСТ 11371-78', params: { refTable: 'Fastener', type: 'washer' } },
  { code: 'R-FAST-004', name: 'Шпилька из справочника', description: 'Шпилька найдена в справочнике Fastener', category: 'tolerances', method: 'semantic', severity: 'medium', gostField: 'Крепёж', standardCode: 'ГОСТ 22042-76', params: { refTable: 'Fastener', type: 'stud' } },
  { code: 'R-FAST-005', name: 'Винт из справочника', description: 'Винт найден в справочнике Fastener', category: 'tolerances', method: 'semantic', severity: 'medium', gostField: 'Крепёж', standardCode: 'ГОСТ 17475-80', params: { refTable: 'Fastener', type: 'screw' } },
  { code: 'R-FAST-006', name: 'Класс прочности болта', description: 'Класс прочности болта указан по ГОСТ ISO 898-1', category: 'tolerances', method: 'semantic', severity: 'medium', gostField: 'Крепёж', standardCode: 'ГОСТ ISO 898-1', params: { grades: ['4.6','4.8','5.6','5.8','6.8','8.8','10.9','12.9'] } },
  { code: 'R-FAST-007', name: 'Класс прочности гайки', description: 'Класс прочности гайки указан', category: 'tolerances', method: 'semantic', severity: 'medium', gostField: 'Крепёж', standardCode: 'ГОСТ 1759.5-87', params: { grades: ['4','5','6','8','10','12'] } },
  { code: 'R-FAST-008', name: 'Совместимость болт/гайка', description: 'Класс прочности гайки не ниже класса болта', category: 'tolerances', method: 'semantic', severity: 'medium', gostField: 'Крепёж', standardCode: 'ГОСТ 1759.0-87' },
  { code: 'R-FAST-009', name: 'Покрытие крепежа', description: 'Покрытие крепежа указано по ГОСТ 9.303', category: 'tolerances', method: 'semantic', severity: 'low', gostField: 'Крепёж', standardCode: 'ГОСТ 9.303-84' },
  { code: 'R-FAST-010', name: 'Шайба пружинная под болт', description: 'Под болт установлена пружинная шайба', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Крепёж', standardCode: 'ГОСТ 6402-70' },
  { code: 'R-FAST-011', name: 'Длина болта из справочника', description: 'Длина болта из стандартного ряда', category: 'tolerances', method: 'semantic', severity: 'low', gostField: 'Крепёж', standardCode: 'ГОСТ 7798-70', params: { refTable: 'Fastener', check: 'length' } },
  { code: 'R-FAST-012', name: 'Диаметр резьбы из стандартного ряда', description: 'Диаметр резьбы из ряда М3-М48', category: 'tolerances', method: 'semantic', severity: 'medium', gostField: 'Крепёж', standardCode: 'ГОСТ 8724-2002', params: { diameters: ['M3','M4','M5','M6','M8','M10','M12','M16','M20','M24','M30','M36','M42','M48'] } },
  { code: 'R-FAST-013', name: 'Шаг резьбы крупный/мелкий', description: 'Шаг резьбы указан (крупный или мелкий)', category: 'tolerances', method: 'semantic', severity: 'low', gostField: 'Крепёж', standardCode: 'ГОСТ 8724-2002' },
  { code: 'R-FAST-014', name: 'Подшипник из справочника', description: 'Подшипник найден в справочнике Bearing', category: 'tolerances', method: 'semantic', severity: 'medium', gostField: 'Подшипники', standardCode: 'ГОСТ 8338-75', params: { refTable: 'Bearing' } },
  { code: 'R-FAST-015', name: 'Посадка подшипника H7/js6', description: 'Для подшипников посадка H7/js6 или H7/k6', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Посадки', standardCode: 'ГОСТ 25347-82', params: { applicable: 'bearing' } },
  { code: 'R-FAST-016', name: 'Стопорение подшипника', description: 'Стопорение подшипника от проворота', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Подшипники', standardCode: 'ГОСТ 8338-75' },
  { code: 'R-FAST-017', name: 'Уплотнение подшипника', description: 'Уплотнение подшипникового узла', category: 'tolerances', method: 'vision', severity: 'medium', gostField: 'Подшипники', standardCode: 'ГОСТ 8752-79' },
  { code: 'R-FAST-018', name: 'Смазка подшипника указана', description: 'В ТТ указана марка смазки для подшипника', category: 'tolerances', method: 'semantic', severity: 'low', gostField: 'Подшипники', standardCode: 'ГОСТ 8338-75' },
  { code: 'R-FAST-019', name: 'Крепёж судовой из ОСТ', description: 'Судовой крепёж по ОСТ 5.9064/9065/9066/9067', category: 'shipbuilding', method: 'semantic', severity: 'medium', gostField: 'Крепёж', standardCode: 'ОСТ 5.9064-75', params: { refTable: 'Fastener', category: 'shipbuilding' } },
  { code: 'R-FAST-020', name: 'Момент затяжки (справочно)', description: 'Для ответственных соединений момент затяжки', category: 'tolerances', method: 'semantic', severity: 'low', gostField: 'Крепёж', standardCode: 'ГОСТ 1759.4-87' },
]

async function main() {
  console.log(`📐 Adding ${RULES.length} parameterized rules...`)
  let inserted = 0, updated = 0
  for (const r of RULES) {
    const std = r.standardCode ? await db.standard.findUnique({ where: { code: r.standardCode } }) : null
    const existing = await db.rule.findUnique({ where: { code: r.code } })
    if (existing) {
      await db.rule.update({
        where: { id: existing.id },
        data: {
          name: r.name, description: r.description, category: r.category,
          method: r.method, severity: r.severity, gostField: r.gostField,
          standardId: std?.id ?? null,
          expression: r.params ? JSON.stringify(r.params) : null,
        },
      })
      updated++
    } else {
      await db.rule.create({
        data: {
          code: r.code, name: r.name, description: r.description,
          category: r.category, method: r.method, severity: r.severity,
          gostField: r.gostField, enabled: true,
          standardId: std?.id ?? null,
          expression: r.params ? JSON.stringify(r.params) : null,
        },
      })
      inserted++
    }
  }
  console.log(`  ✓ ${inserted} new, ${updated} updated`)
  const total = await db.rule.count()
  console.log(`\n📊 Total rules: ${total}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
