import { defineManifest } from '@crxjs/vite-plugin'
import { BRAND_DESCRIPTION, BRAND_NAME, BRAND_SHORT_NAME } from './src/shared/brand'

export default defineManifest({
  manifest_version: 3,
  name: BRAND_NAME,
  short_name: BRAND_SHORT_NAME,
  version: '0.1.0',
  description: BRAND_DESCRIPTION,
  permissions: ['storage'],
  host_permissions: ['http://*/*', 'https://*/*', 'file:///*'],
  icons: {
    16: 'brand/waraq-16.png',
    32: 'brand/waraq-32.png',
    48: 'brand/waraq-48.png',
    128: 'brand/waraq-128.png',
  },
  options_ui: {
    page: 'src/reader/index.html',
    open_in_tab: true,
  },
  action: {
    default_title: BRAND_NAME,
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'brand/waraq-16.png',
      32: 'brand/waraq-32.png',
      48: 'brand/waraq-48.png',
    },
  },
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  browser_specific_settings: {
    gecko: {
      data_collection_permissions: {
        required: [],
      },
      id: 'waraq@local-first-reader',
      strict_min_version: '121.0',
    },
  },
  commands: {
    open_reader: {
      suggested_key: {
        default: 'Ctrl+Shift+Y',
      },
      description: 'Open the markdown reader workspace',
    },
  },
})
