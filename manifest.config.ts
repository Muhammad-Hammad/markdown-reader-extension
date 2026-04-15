import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Markdown Reader Extension',
  version: '0.1.0',
  description:
    'Local-first markdown reader with nested folders, reader modes, search, export, and MarkView-style ergonomics.',
  permissions: ['storage'],
  host_permissions: ['http://*/*', 'https://*/*', 'file:///*'],
  options_ui: {
    page: 'src/reader/index.html',
    open_in_tab: true,
  },
  action: {
    default_title: 'Markdown Reader',
    default_popup: 'src/popup/index.html',
  },
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  commands: {
    open_reader: {
      suggested_key: {
        default: 'Ctrl+Shift+M',
      },
      description: 'Open the markdown reader workspace',
    },
  },
})
