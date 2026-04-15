chrome.runtime.onInstalled.addListener(() => {
  void chrome.runtime.openOptionsPage()
})

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'open_reader') {
    return
  }

  void chrome.runtime.openOptionsPage()
})
