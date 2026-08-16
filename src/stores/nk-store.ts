'use client'

import { create } from 'zustand'

export type NKView =
  | 'dashboard'
  | 'documents'
  | 'issues'
  | 'knowledge'
  | 'rules'
  | 'projects'
  | 'document-detail'

interface NKStore {
  view: NKView
  setView: (v: NKView) => void

  selectedDocumentId: string | null
  selectDocument: (id: string | null) => void

  // Documents filter override — used by Projects view ("show documents of project X")
  documentsProjectId: string | null
  setDocumentsProjectId: (id: string | null) => void

  // Mobile sidebar
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
}

export const useNKStore = create<NKStore>((set) => ({
  view: 'dashboard',
  setView: (view) => set({ view }),

  selectedDocumentId: null,
  selectDocument: (selectedDocumentId) => set({ selectedDocumentId }),

  documentsProjectId: null,
  setDocumentsProjectId: (documentsProjectId) => set({ documentsProjectId }),

  mobileNavOpen: false,
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
}))
