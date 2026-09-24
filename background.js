const KEY = 'disabledHosts';

const hostOf = (u) => {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; }
};

async function isEnabled(url) {
  const disabled = (await chrome.storage.local.get(KEY))[KEY] || [];
  return !disabled.includes(hostOf(url));
}

async function bump(tabId, entry) {
  const k = `t${tabId}`;
  const cur = (await chrome.storage.session.get(k))[k] || { count: 0, log: [] };
  cur.count++;
  cur.log = [entry, ...cur.log].slice(0, 20);
  await chrome.storage.session.set({ [k]: cur });
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#d93025' });
  chrome.action.setBadgeText({ tabId, text: String(cur.count) });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tab = sender.tab;
  if (!tab) return;
  if (msg.type === 'getState') {
    isEnabled(tab.url).then((enabled) => sendResponse({ enabled }));
    return true; // async response
  }
  if (msg.type === 'blocked') bump(tab.id, { kind: msg.kind, url: msg.url });
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') {
    chrome.storage.session.remove(`t${tabId}`);
    chrome.action.setBadgeText({ tabId, text: '' });
  }
});
chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(`t${tabId}`));