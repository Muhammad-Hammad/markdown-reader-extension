import { openExtensionOptionsPage, onExtensionCommand, onExtensionInstalled } from './shared/runtime'

onExtensionInstalled(() => {
  void openExtensionOptionsPage()
})

onExtensionCommand((command) => {
  if (command !== 'open_reader') {
    return
  }

  void openExtensionOptionsPage()
})
