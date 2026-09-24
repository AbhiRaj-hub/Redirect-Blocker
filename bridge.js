const CFG = '__pbr_cfg', LOG = '__pbr_log';

chrome.runtime.sendMessage({ type: 'getState' })
  .then((r) => document.dispatchEvent(new CustomEvent(CFG, { detail: JSON.stringify({ enabled: r?.enabled !== false }) })))
  .catch(() => {});

document.addEventListener(LOG, (e) => {
  try { chrome.runtime.sendMessage({ type: 'blocked', ...JSON.parse(e.detail) }); } catch {}
});
