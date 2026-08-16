'use client'

import { Image, FileText, Box, Boxes, File, FileCog } from 'lucide-react'
import type { DocumentSource } from '@/lib/types'
import { sourceTypeLabel } from './nk-format'

export function SourceIcon({
  sourceType,
  className,
}: {
  sourceType: DocumentSource
  className?: string
}) {
  let Icon = File
  switch (sourceType) {
    case 'scan':
      Icon = Image
      break
    case 'pdf':
      Icon = FileText
      break
    case 'dwg':
    case 'dxf':
    case 'cdw':
      Icon = Box
      break
    case 'sldprt':
    case 'sldasm':
    case 'slddrw':
      Icon = Boxes
      break
    case 'spw':
      Icon = FileCog
      break
  }
  return <Icon className={className ?? 'size-4'} />
}

export function SourceBadge({ sourceType }: { sourceType: DocumentSource }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <SourceIcon sourceType={sourceType} className="size-3.5" />
      {sourceTypeLabel(sourceType)}
    </span>
  )
}
