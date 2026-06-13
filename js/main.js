// js/main.js  --  Tab router, global init, event wiring
import { initWP, showTab as _showTab, loadOverview } from './tab-wp.js';

const _initialised = new Set();

export function showTab(tabId, btn) {
  document.querySelectorAll('.tc').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  const el = document.getElementById(tabId);
  if (el) el.classList.add('active');
  if (btn) btn.classList.add('active');

  if (!_initialised.has(tabId)) {
    _initialised.add(tabId);
    if (tabId === 'wp')       initWP();
    if (tabId === 'overview') typeof loadOverview === 'function' && loadOverview();
    if (tabId === 'agent')    typeof loadAgentTab === 'function' && loadAgentTab();
  }
}

// Re-export showTab to window so HTML onclick handlers work
window.showTab = showTab;

// Global error boundary
window.addEventListener('unhandledrejection', ev => {
  console.error('[cc-dashboard] Unhandled promise rejection:', ev.reason);
});
window.onerror = (msg, src, line, col, err) => {
  console.error('[cc-dashboard] Global error:', msg, src + ':' + line + ':' + col, err);
};

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  const upd = document.getElementById('upd');
  if (upd) upd.textContent = 'Uppdaterat ' + new Date().toLocaleTimeString('sv-SE', {hour:'2-digit', minute:'2-digit'});

  const activeBtn = document.querySelector('nav button.active');
  if (activeBtn) {
    const id = activeBtn.getAttribute('onclick')?.match(/showTab\('(\w+)'/)?.[1];
    if (id) showTab(id, activeBtn);
  } else {
    const wpBtn = document.querySelector('nav button[onclick*=\'wp\']');
    showTab('wp', wpBtn);
  }
});
