type ExtensionRuntimeApi = {
  commands?: {
    onCommand?: {
      addListener: (callback: (command: string) => void) => void
    }
  }
  runtime?: {
    onInstalled?: {
      addListener: (callback: () => void) => void
    }
    openOptionsPage?: () => Promise<void> | void
  }
}

function getExtensionApi(): ExtensionRuntimeApi | null {
  const extensionGlobal = globalThis as typeof globalThis & {
    browser?: ExtensionRuntimeApi
    chrome?: ExtensionRuntimeApi
  }

  return extensionGlobal.browser ?? extensionGlobal.chrome ?? null
}

export async function openExtensionOptionsPage() {
  const openOptionsPage = getExtensionApi()?.runtime?.openOptionsPage

  if (!openOptionsPage) {
    throw new Error('Extension options page is not available in this browser context.')
  }

  await openOptionsPage()
}

export function onExtensionInstalled(callback: () => void) {
  getExtensionApi()?.runtime?.onInstalled?.addListener(callback)
}

export function onExtensionCommand(callback: (command: string) => void) {
  getExtensionApi()?.commands?.onCommand?.addListener(callback)
}
