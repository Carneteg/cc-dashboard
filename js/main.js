// js/main.js  --  Global init, error wiring
// Note: showTab is defined and assigned to window in tab-wp.js (it uses 'tab-'+id prefix)
// Note: aeInit is a self-executing named IIFE in tab-agent.js, no import needed
import { loadAgentTab }   from './tab-agent.js';
import { naInit }         from './tab-agent-eff.js';

// Global error boundary
window.addEventListener('unhandledrejection', ev => {
  console.error('[cc-dashboard] Unhandled promise rejection:', ev.reason);
});
window.onerror = (msg, src, line, col, err) => {
  console.error('[cc-dashboard] Global error:', msg, src + ':' + line + ':' + col, err);
};

// Bootstrap on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const upd = document.getElementById('upd');
  if (upd) upd.textContent = 'Uppdaterat ' + new Date().toLocaleTimeString('sv-SE', {hour:'2-digit', minute:'2-digit'});
  naInit();
});
