'use client'

import * as React from 'react'
import { getConfig, saveConfig } from '@/lib/config-loader'

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <div className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-bold text-cyan-400 mb-6">НК-Контроль — Инженерная консоль</h1>
        <p className="text-zinc-400 mb-8">Порт 3333 · «Матрица» · Конфигурация системы</p>
        <SystemSection />
        <OcrSection />
        <ModelsSection />
        <RulesSection />
        <BenchSection />
        <ConfigSection />
      </div>
    </div>
  )
}

function SystemSection() {
  const [health, setHealth] = React.useState<any>(null)
  React.useEffect(() => {
    fetch('/api/admin/health').then(r => r.json()).then(setHealth).catch(() => {})
  }, [])
  return (
    <Section title="СИСТЕМА" color="cyan">
      <div className="grid grid-cols-2 gap-4">
        <Metric label="Status" value={health?.status || '...'} />
        <Metric label="Uptime" value={health?.uptime || '...'} />
        <Metric label="RAM (used)" value={health?.memory ? `${(health.memory.used / 1048576).toFixed(0)} MB` : '...'} />
        <Metric label="CPU" value={health?.cpu || '...'} />
      </div>
    </Section>
  )
}

function OcrSection() {
  return (
    <Section title="OCR" color="emerald">
      <Row label="Engine" value="paddleocr" />
      <Row label="PaddleOCR URL" value="http://localhost:8100" />
      <Row label="Tesseract lang" value="rus+eng" />
      <Row label="Confidence cutoff" value="0.4" />
      <Row label="DPI target" value="300" />
      <Row label="Downscale max" value="1000px" />
      <Row label="Zone crop" value="true" />
    </Section>
  )
}

function ModelsSection() {
  return (
    <Section title="МОДЕЛИ" color="amber">
      <Row label="LLM mode" value="cloud_vlm" />
      <Row label="VLM model" value="glm-4.5v" />
      <Row label="LLM model" value="glm-4.6" />
      <Row label="Ollama URL" value="http://localhost:11434" />
      <Row label="Ollama model" value="qwen2.5:14b-instruct" />
      <Row label="local_only" value="false" />
    </Section>
  )
}

function RulesSection() {
  return (
    <Section title="ПРАВИЛА" color="violet">
      <Row label="Categories" value="stamp, material, welding, format, geometry, specification, semantic, cad_attr, tolerances, shipbuilding" />
      <Row label="Industry module" value="shipbuilding" />
    </Section>
  )
}

function BenchSection() {
  return (
    <Section title="БЕНЧ" color="rose">
      <Row label="Auto-run" value="false" />
      <Row label="Release gate" value="true" />
      <Row label="Synthetic" value="GREEN 100/100" />
      <Row label="DXF" value="GREEN 20/20" />
      <Row label="Realistic" value="RED (PaddleOCR OOM)" />
    </Section>
  )
}

function ConfigSection() {
  return (
    <Section title="КОНФИГ" color="slate">
      <Row label="config.yaml" value="в корне проекта" />
      <Row label="Порт main" value="1111" />
      <Row label="Порт admin" value="3333" />
      <Row label="DB" value="SQLite (db/custom.db)" />
    </Section>
  )
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  const colorMap: Record<string, string> = {
    cyan: 'text-cyan-400 border-cyan-900',
    emerald: 'text-emerald-400 border-emerald-900',
    amber: 'text-amber-400 border-amber-900',
    violet: 'text-violet-400 border-violet-900',
    rose: 'text-rose-400 border-rose-900',
    slate: 'text-slate-400 border-slate-800',
  }
  return (
    <div className={`mb-6 rounded-lg border ${colorMap[color] || ''} bg-zinc-900/50 p-5`}>
      <h2 className={`text-sm font-bold ${colorMap[color]?.split(' ')[0] || 'text-zinc-400'} mb-3`}>{title}</h2>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200">{value}</span>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-zinc-800/50 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-lg font-bold text-zinc-200">{value}</div>
    </div>
  )
}
