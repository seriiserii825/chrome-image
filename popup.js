const btn = document.getElementById('toggleBtn');
const status = document.getElementById('status');

async function getTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getState(tabId) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => !!document.querySelector('[data-img-inspector]'),
  });
  return result[0].result;
}

async function updateUI(tabId) {
  const active = await getState(tabId);
  btn.textContent = active ? 'Hide Image Info' : 'Show Image Info';
  btn.className = active ? 'active' : '';
  status.textContent = active
    ? `Showing info on this page`
    : 'Click to inspect images on this page';
}

btn.addEventListener('click', async () => {
  const tab = await getTab();
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js'],
  });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.__imageInspectorToggle?.(),
  });
  await updateUI(tab.id);
});

getTab().then(tab => updateUI(tab.id));
