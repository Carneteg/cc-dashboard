// js/main.js -- Module entry point, imports all tab modules
// tab-wp.js assigns window.showTab, window.setTimeGran, etc. (uses 'tab-'+id prefix)
// tab-agent.js assigns window.loadAgentTab, window.renderAgentTable, etc.
// aeInit is a self-executing named IIFE in tab-agent.js - no import needed
// naInit is exported from tab-agent-eff.js - called on DOMContentLoaded
// v19- tab-agent v17 (timeout+retry), tab-agent-eff v24 (Singelkontakt, AHT trend) with correct FTE from masterdata

import './tab-wp.js?v=19';
import './tab-agent.js?v=17';
import { naInit, csatInit } from './tab-agent-eff.js?v=24';
import './tab-exec.js?v=21';

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
if (upd) upd.textContent = 'Updated ' + new Date().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'});
naInit();
  csatInit();
});
