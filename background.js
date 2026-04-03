chrome.action.onClicked.addListener(async (tab) => {
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js'],
  });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.__imageInspectorToggle?.(),
  });
});
