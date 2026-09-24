const $ = (id) => document.getElementById(id);
const KEY = 'disabledHosts';
const hostOf = (u) => {
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.hostname.replace(/^www\./, '') : null; }
  catch { return null; }
};

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const host = tab && hostOf(tab.url);
  if (!host) { $('host').textContent = 'Not available on this page'; return; }
  $('host').textContent = host;

  const render = async () => {
    const disabled = (await chrome.storage.local.get(KEY))[KEY] || [];
    const on = !disabled.includes(host);
    const btn = $('toggle');
    btn.disabled = false;
    btn.dataset.on = on;
    btn.textContent = on ? 'Protection ON for this site' : 'Protection OFF for this site';
    const k = `t${tab.id}`;
    const s = (await chrome.storage.session.get(k))[k] || { count: 0, log: [] };
    $('count').textContent = `${s.count} blocked on this page`;
    $('log').replaceChildren(...s.log.map((l) => {
      const li = document.createElement('li');
      li.textContent = `${l.kind}: ${l.url}`;
      return li;
    }));
  };

  $('toggle').onclick = async () => {
    const disabled = new Set((await chrome.storage.local.get(KEY))[KEY] || []);
    disabled.has(host) ? disabled.delete(host) : disabled.add(host);
    await chrome.storage.local.set({ [KEY]: [...disabled] });
    await render();
    chrome.tabs.reload(tab.id);
  };
  render();
})();
