import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface Plan {
  id: 'free' | 'pro' | 'enterprise'
  name: string
  price: number
  currency: string
  interval: 'month' | 'year'
  maxDocuments: number
  maxChecks: number
  maxUsers: number
  maxApiRequests: number
  features: string[]
  highlighted?: boolean
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Старт',
    price: 0,
    currency: 'RUB',
    interval: 'month',
    maxDocuments: 50,
    maxChecks: 100,
    maxUsers: 3,
    maxApiRequests: 500,
    features: [
      'До 50 документов в месяц',
      'До 100 проверок',
      'Базовые детерминированные правила (17 шт.)',
      'База знаний ГОСТ/ОСТ (420 стандартов)',
      '1 проект',
      'Email-поддержка',
    ],
  },
  {
    id: 'pro',
    name: 'Профи',
    price: 49500,
    currency: 'RUB',
    interval: 'month',
    maxDocuments: 500,
    maxChecks: 2000,
    maxUsers: 15,
    maxApiRequests: 10000,
    highlighted: true,
    features: [
      'До 500 документов в месяц',
      'До 2000 проверок',
      'VLM-распознавание штампов (ГОСТ 2.104)',
      'LLM-семантические проверки',
      'Все детерминированные правила',
      'API-доступ (read + write)',
      'Неограниченное число проектов',
      'Аудит-лог и история проверок',
      'Приоритетная поддержка (чат 24/7)',
    ],
  },
  {
    id: 'enterprise',
    name: 'Предприятие',
    price: 199500,
    currency: 'RUB',
    interval: 'month',
    maxDocuments: 10000,
    maxChecks: 50000,
    maxUsers: 100,
    maxApiRequests: 100000,
    features: [
      'До 10 000 документов в месяц',
      'До 50 000 проверок',
      'Безлимит проектов и организаций',
      'Кастомные правила и стандарты предприятия',
      'On-premise / private cloud deployment',
      'SSO (SAML, OIDC) и Active Directory',
      'Интеграция с PDM/PLM (Teamcenter, Windchill)',
      'SLA 99.9% и выделенный менеджер',
      'Обучение персонала и аудит процессов',
    ],
  },
]

export async function GET() {
  return NextResponse.json({ items: PLANS })
}
