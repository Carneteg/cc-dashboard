// js/main.js  --  Tab router, global init, event wiring
const _initialised = new Set();

export function showTab(tabId, btn) {
  document.querySelectorAll('.tc').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  const pane = document.getElementById('tab-' + tabId);
  if (pane) pane.classList.add('active');
  if (btn) btn.classList.add('active');
  if (!_initialised.has(tabId)) { _initialised.add(tabId); _initTab(tabId); }
}

function _initTab(tabId) {
  switch (tabId) {
    case 'wp':       if (typeof initWP         === 'function') initWP(); break;
    case 'classify': if (typeof initClassifyTab === 'function') initClassifyTab(); break;
    case 'agent':    if (typeof loadAgentTab    === 'function') loadAgentTab(); break;
    case 'overview': if (typeof loadOverview    === 'function') loadOverview(); break;
    case 'aht':      if (typeof loadAHT         === 'function') loadAHT(); break;
    case 'prognos':  if (typeof initPrognos     === 'function') initPrognos(); break;
    case 'setup':    if (typeof loadSetupTab    === 'function') loadSetupTab(); break;
    default: break;
  }
}

window.addEventListener('error', e =>
  console.error('[cc-dashboard]', e.message, e.filename, e.lineno));
window.addEventListener('unhandledrejection', e =>
  console.error('[cc-dashboard] rejected:', e.reason));

window.showTab = showTab;

document.addEventListener('DOMContentLoaded', () => {
  const firstBtn = document.querySelector('nav button');
  if (firstBtn) {
    const m = (firstBtn.getAttribute('onclick') || '').match(/showTab\('(\w+)'/);
    if (m) showTab(m[1], firstBtn);
  }
});
