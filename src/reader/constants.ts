import type { ReaderMode, ReaderSettings, SourceTypeFilter } from '../shared/types'

export const MODE_CYCLE: ReaderMode[] = ['light', 'dark', 'read', 'low-light', 'ambient', 'focus']

export const FONT_OPTIONS: Array<{ label: string; value: ReaderSettings['fontFamily'] }> = [
  { label: 'System', value: 'system' },
  { label: 'Sans', value: 'sans' },
  { label: 'Serif', value: 'serif' },
  { label: 'Mono', value: 'mono' },
]

export const SOURCE_FILTERS: Array<{ label: string; value: SourceTypeFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Markdown', value: 'markdown' },
  { label: 'Text', value: 'text' },
]

export const KEYBOARD_SHORTCUTS = [
  ['Ctrl+Shift+M', 'Open the reader tab'],
  ['Ctrl+K', 'Open command palette'],
  ['Ctrl+Shift+F', 'Focus content search'],
  ['Ctrl+Shift+L', 'Toggle TOC'],
  ['Ctrl+Shift+D', 'Cycle reader mode'],
  ['/', 'Focus file filter'],
  ['?', 'Open keyboard help'],
] as const
