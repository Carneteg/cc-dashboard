// js/tab-cc-kpi.js — Customer Care KPI Section v1
// Renders §CC · CUSTOMER CARE PERFORMANCE inside Executive Summary
// Mock-ready: generates realistic data if no API is available
// Auto-refreshes every 60s · Day/Week/Month views · Breakdown per product & agent

(function () {
  'use strict';

  // ── KPI definitions ──────────────────────────────────────────────────────
  const KPI_DEFS = [
    { id: 'fr_sla',    label: 'First Response SLA', unit: '%', target: 90, higherIsBetter: true,  description: 'Tickets answered within SLA target' },
    { id: 'res_sla',   label: 'Resolution SLA',     unit: '%', target: 85, higherIsBetter: true,  description: 'Tickets resolved within SLA target' },
    { id: 'fcr',       label: 'FCR',                unit: '%', target: 75, higherIsBetter: true,  description: 'First Contact Resolution – no reopening' },
    { id: 'csat',      label: 'CSAT',               unit: '/5', target: 4.2, higherIsBetter: true, description: 'Customer Satisfaction Score (1–5)' },
    { id: 'tpd',       label: 'Tickets / Agent / Day', unit: '', target: 20, higherIsBetter: true, description: 'Avg handled tickets per agent per working day' },
  ];

  const PRODUCTS = ['Simployer Classic', 'Simployer One', 'Expert NO', 'Frankly', 'Talent'];
  const AGENTS   = ['Therese N.', 'Emil G.', 'Kari K.', 'Martin Å.', 'Arkadiusz Z.', 'Mats L.', 'Ilse L.', 'Ian M.', 'Honya M.', 'Anett N.'];

  // ── Seeded PRNG for stable mock data ──────────────────────────────────────
  function seededRand(seed) {
    let s = seed;
    return function () {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  // ── Mock data generators ──────────────────────────────────────────────────
  function mockVal(kpi, seed) {
    const r = seededRand(seed)();
    if (kpi.id === 'fr_sla')  return +(85 + r * 12).toFixed(1);
    if (kpi.id === 'res_sla') return +(80 + r * 12).toFixed(1);
    if (kpi.id === 'fcr')     return +(68 + r * 16).toFixed(1);
    if (kpi.id === 'csat')    return +(4.0 + r * 0.8).toFixed(2);
    if (kpi.id === 'tpd')     return +(16 + r * 14).toFixed(1);
    return 0;
  }

  function getDayRows() {
    const rows = [];
    const now  = new Date();
    const mon  = new Date(now);
    mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    for (let d = 0; d < 7; d++) {
      const dt = new Date(mon);
      dt.setDate(mon.getDate() + d);
      const seed = dt.getFullYear() * 10000 + (dt.getMonth() + 1) * 100 + dt.getDate();
      const isFuture = dt > now;
      rows.push({ label: dt.toLocaleDateString('sv-SE', { weekday: 'short', month: 'numeric', day: 'numeric' }), seed, isFuture });
    }
    return rows;
  }

  function getWeekRows() {
    const rows = [];
    const now  = new Date();
    for (let w = 11; w >= 0; w--) {
      const start = new Date(now);
      start.setDate(now.getDate() - ((now.getDay() + 6) % 7) - w * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const weekNum = getWeekNumber(start);
      const seed = start.getFullYear() * 1000 + weekNum;
      rows.push({ label: 'v' + weekNum + ' (' + start.toLocaleDateString('sv-SE', { month: 'numeric', day: 'numeric' }) + '–' + end.toLocaleDateString('sv-SE', { month: 'numeric', day: 'numeric' }) + ')', seed });
    }
    return rows;
  }

  function getMonthRows() {
    const rows = [];
    const now  = new Date();
    for (let m = 11; m >= 0; m--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const seed = dt.getFullYear() * 100 + dt.getMonth();
      rows.push({ label: dt.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short' }), seed });
    }
    return rows;
  }

  function getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  }

  function getLiveVal(kpi) {
    const r = seededRand(Date.now() % 999983)();
    return mockVal(kpi, Math.floor(Date.now() / 60000) * 7 + kpi.id.length);
  }

  function getProductBreakdown(kpi, seed) {
    return PRODUCTS.map((p, i) => ({
      name: p,
      value: mockVal(kpi, seed * 31 + i * 17)
    }));
  }

  function getAgentBreakdown(kpi, seed) {
    return AGENTS.map((a, i) => ({
      name: a,
      value: mockVal(kpi, seed * 13 + i * 41)
    }));
  }

  // ── Status helpers ────────────────────────────────────────────────────────
  function statusClass(kpi, val) {
    const ratio = kpi.higherIsBetter ? val / kpi.target : kpi.target / val;
    if (ratio >= 1.0)  return 'cc-ok';
    if (ratio >= 0.9)  return 'cc-warn';
    return 'cc-crit';
  }

  function statusDot(kpi, val) {
    const cls = statusClass(kpi, val);
    const color = cls === 'cc-ok' ? '#28a745' : cls === 'cc-warn' ? '#ffc107' : '#dc3545';
    return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + color + ';margin-right:5px;"></span>';
  }

  function trendArrow(curr, prev) {
    if (curr === null || prev === null) return '<span style="color:#999">—</span>';
    return curr >= prev
      ? '<span style="color:#28a745;font-size:13px;">▲</span>'
      : '<span style="color:#dc3545;font-size:13px;">▼</span>';
  }

  // ── Sparkline (SVG) ───────────────────────────────────────────────────────
  function sparkline(values, target, color) {
    if (!values || values.length < 2) return '';
    const W = 80, H = 24;
    const min = Math.min(...values) * 0.97;
    const max = Math.max(...values) * 1.03;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - min) / (max - min)) * H;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    const ty = H - ((target - min) / (max - min)) * H;
    return '<svg width="' + W + '" height="' + H + '" style="vertical-align:middle">' +
      '<line x1="0" y1="' + ty.toFixed(1) + '" x2="' + W + '" y2="' + ty.toFixed(1) + '" stroke="#ccc" stroke-dasharray="2,2" stroke-width="1"/>' +
      '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.5"/>' +
      '</svg>';
  }

  // ── Table CSV export ──────────────────────────────────────────────────────
  function tableToCSV(tableId) {
    const tbl = document.getElementById(tableId);
    if (!tbl) return;
    const rows = [...tbl.querySelectorAll('tr')].map(r =>
      [...r.querySelectorAll('th,td')].map(c => '"' + c.innerText.replace(/"/g, '""') + '"').join(',')
    );
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = tableId + '.csv';
    a.click();
  }

  // ── CSS injection ─────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('cc-kpi-styles')) return;
    const s = document.createElement('style');
    s.id = 'cc-kpi-styles';
    s.textContent = `
      .cc-kpi-section { margin-top: 24px; }
      .cc-kpi-live-bar { display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap; }
      .cc-live-dot { width:10px;height:10px;border-radius:50%;background:#28a745;animation:ccPulse 1.5s infinite; }
      @keyframes ccPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }
      .cc-live-label { font-size:12px;color:#666; }
      .cc-view-btns { display:flex;gap:4px;margin-left:auto; }
      .cc-view-btn { padding:3px 10px;font-size:11px;border:1px solid var(--border);border-radius:4px;background:none;color:var(--text3);cursor:pointer;transition:.15s; }
      .cc-view-btn.active { background:var(--accent);color:#fff;border-color:var(--accent); }
      .cc-kpi-cards { display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:16px; }
      .cc-kpi-card { background:#fff;border:1px solid var(--border);border-radius:8px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.06);position:relative;cursor:pointer;transition:.15s; }
      .cc-kpi-card:hover { box-shadow:0 3px 8px rgba(0,0,0,.12); }
      .cc-kpi-card.cc-ok    { border-left:3px solid #28a745; }
      .cc-kpi-card.cc-warn  { border-left:3px solid #ffc107; }
      .cc-kpi-card.cc-crit  { border-left:3px solid #dc3545; }
      .cc-card-label { font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px; }
      .cc-card-value { font-size:26px;font-weight:700;color:var(--text2);line-height:1; }
      .cc-card-unit  { font-size:13px;color:var(--text3);margin-left:2px; }
      .cc-card-delta { font-size:11px;margin-top:4px;color:#666; }
      .cc-card-desc  { font-size:10px;color:#999;margin-top:2px; }
      .cc-expand-btn { position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;color:#999;font-size:14px;padding:2px 4px;border-radius:3px; }
      .cc-expand-btn:hover { background:#f0f0f0; }
      .cc-breakdown { display:none;border:1px solid var(--border);border-radius:8px;background:#fff;padding:14px;margin-top:8px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06); }
      .cc-breakdown.open { display:block; }
      .cc-bd-tabs { display:flex;gap:4px;margin-bottom:12px; }
      .cc-bd-tab { padding:4px 12px;font-size:11px;border:1px solid var(--border);border-radius:4px;background:none;cursor:pointer; }
      .cc-bd-tab.active { background:#e8f5e9;border-color:#28a745;color:#28a745;font-weight:600; }
      .cc-bd-panel { display:none; }
      .cc-bd-panel.active { display:block; }
      .cc-tbl { width:100%;border-collapse:collapse;font-size:12px; }
      .cc-tbl th { background:#f8f9fa;padding:6px 10px;text-align:left;font-weight:600;color:var(--text3);border-bottom:2px solid var(--border);cursor:pointer;white-space:nowrap; }
      .cc-tbl th:hover { background:#eee; }
      .cc-tbl td { padding:6px 10px;border-bottom:1px solid #f0f0f0;vertical-align:middle; }
      .cc-tbl tr:nth-child(even) td { background:#fafafa; }
      .cc-tbl tr:hover td { background:#f0f7ff; }
      .cc-tbl .future td { color:#bbb;font-style:italic; }
      .cc-ok   { color:#28a745; }
      .cc-warn { color:#ffc107; }
      .cc-crit { color:#dc3545; }
      .cc-bar-fill { height:6px;border-radius:3px;display:inline-block;vertical-align:middle;margin-left:6px; }
      .cc-csv-btn { font-size:10px;padding:2px 7px;border:1px solid #ccc;border-radius:3px;background:#fff;cursor:pointer;color:#666;margin-left:8px; }
      .cc-csv-btn:hover { background:#f5f5f5; }
      .cc-section-header { display:flex;align-items:center;gap:8px;margin-bottom:10px; }
      .cc-section-title { font-size:13px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em; }
      .tag.analytics { background:#fff3e0;color:#e65100; }
    `;
    document.head.appendChild(s);
  }

  // ── Main render ───────────────────────────────────────────────────────────
  let _view = 'day';
  let _refreshTimer = null;
  let _lastUpdate = new Date();

  function renderCCKPIs() {
    const container = document.getElementById('cc-kpi-section');
    if (!container) return;

    injectStyles();

    const rows = _view === 'day' ? getDayRows() : _view === 'week' ? getWeekRows() : getMonthRows();
    const liveVals = KPI_DEFS.map(k => ({ kpi: k, val: getLiveVal(k) }));

    // KPI summary cards
    const cards = KPI_DEFS.map((kpi, ki) => {
      const lv = liveVals[ki].val;
      const sc = statusClass(kpi, lv);
      const prevSeed = rows.length > 1 ? rows[rows.length - 2].seed : rows[0].seed;
      const prevVal  = mockVal(kpi, prevSeed + ki);
      const delta    = (lv - prevVal).toFixed(kpi.id === 'csat' ? 2 : 1);
      const sign     = delta >= 0 ? '+' : '';
      const sparkVals = rows.slice(-7).map((r, ri) => mockVal(kpi, r.seed + ki));
      const color = sc === 'cc-ok' ? '#28a745' : sc === 'cc-warn' ? '#ffc107' : '#dc3545';
      return `<div class="cc-kpi-card ${sc}" id="cc-card-${kpi.id}" onclick="toggleCCBreakdown('${kpi.id}')">
        <button class="cc-expand-btn" title="Drill down">⌄</button>
        <div class="cc-card-label">${kpi.label}</div>
        <div style="display:flex;align-items:baseline;gap:4px">
          <span class="cc-card-value ${sc}">${kpi.id === 'csat' ? lv.toFixed(2) : lv.toFixed(1)}</span>
          <span class="cc-card-unit">${kpi.unit}</span>
        </div>
        <div class="cc-card-delta">${trendArrow(lv, prevVal)} ${sign}${delta} vs föregående</div>
        <div style="margin-top:6px">${sparkline(sparkVals, kpi.target, color)}</div>
        <div class="cc-card-desc">Mål: ${kpi.target}${kpi.unit}</div>
      </div>`;
    }).join('');

    // Full table (all KPIs × rows)
    const tableId = 'cc-main-table-' + _view;
    const thead = '<tr><th onclick="sortCCTable(this)">Period</th>' +
      KPI_DEFS.map(k => '<th onclick="sortCCTable(this)">' + k.label + '</th>').join('') + '</tr>';

    const tbody = rows.map((row, ri) => {
      const cells = KPI_DEFS.map((kpi, ki) => {
        if (row.isFuture) return '<td>—</td>';
        const v   = mockVal(kpi, row.seed + ki);
        const sc  = statusClass(kpi, v);
        const disp = kpi.id === 'csat' ? v.toFixed(2) : v.toFixed(1);
        return '<td>' + statusDot(kpi, v) + '<span class="' + sc + '">' + disp + kpi.unit + '</span></td>';
      }).join('');
      const cls = row.isFuture ? 'future' : '';
      return '<tr class="' + cls + '"><td>' + row.label + '</td>' + cells + '</tr>';
    }).join('');

    // Breakdown panels (one per KPI)
    const breakdowns = KPI_DEFS.map((kpi, ki) => {
      const latestSeed = rows[rows.length - 1].seed;
      const prodData   = getProductBreakdown(kpi, latestSeed + ki);
      const agentData  = getAgentBreakdown(kpi, latestSeed + ki);
      const maxProd    = Math.max(...prodData.map(p => p.value));
      const maxAgent   = Math.max(...agentData.map(a => a.value));

      const prodRows  = prodData.map(p => {
        const sc = statusClass(kpi, p.value);
        const pct = (p.value / maxProd * 100).toFixed(0);
        const color = sc === 'cc-ok' ? '#28a745' : sc === 'cc-warn' ? '#ffc107' : '#dc3545';
        return '<tr><td>' + p.name + '</td><td><span class="' + sc + '">' + (kpi.id==='csat'?p.value.toFixed(2):p.value.toFixed(1)) + kpi.unit + '</span>' +
          '<span class="cc-bar-fill" style="width:' + pct + 'px;background:' + color + '"></span></td></tr>';
      }).join('');

      const agentRows = [...agentData].sort((a, b) => b.value - a.value).map((a, i) => {
        const sc = statusClass(kpi, a.value);
        const pct = (a.value / maxAgent * 100).toFixed(0);
        const color = sc === 'cc-ok' ? '#28a745' : sc === 'cc-warn' ? '#ffc107' : '#dc3545';
        const initials = a.name.split(/[. ]/)[0].charAt(0) + (a.name.split(/[. ]/)[1] || '').charAt(0);
        return '<tr><td style="display:flex;align-items:center;gap:6px"><span style="background:#e3f2fd;color:#1565c0;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700">' + initials + '</span>' + a.name + '</td>' +
          '<td><span class="' + sc + '">' + (kpi.id==='csat'?a.value.toFixed(2):a.value.toFixed(1)) + kpi.unit + '</span>' +
          '<span class="cc-bar-fill" style="width:' + pct + 'px;background:' + color + '"></span></td></tr>';
      }).join('');

      const bdTableProd  = 'cc-bd-prod-'  + kpi.id;
      const bdTableAgent = 'cc-bd-agent-' + kpi.id;

      return `<div class="cc-breakdown" id="cc-bd-${kpi.id}">
        <div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:8px">${kpi.label} – Breakdown (senaste period)</div>
        <div class="cc-bd-tabs">
          <button class="cc-bd-tab active" onclick="switchCCBdTab('${kpi.id}','prod',this)">Per produkt</button>
          <button class="cc-bd-tab" onclick="switchCCBdTab('${kpi.id}','agent',this)">Per agent</button>
        </div>
        <div class="cc-bd-panel active" id="cc-bd-${kpi.id}-prod">
          <button class="cc-csv-btn" onclick="ccExportCSV('${bdTableProd}')">⬇ CSV</button>
          <table class="cc-tbl" id="${bdTableProd}">
            <thead><tr><th>Produkt</th><th>${kpi.label}</th></tr></thead>
            <tbody>${prodRows}</tbody>
          </table>
        </div>
        <div class="cc-bd-panel" id="cc-bd-${kpi.id}-agent">
          <button class="cc-csv-btn" onclick="ccExportCSV('${bdTableAgent}')">⬇ CSV</button>
          <table class="cc-tbl" id="${bdTableAgent}">
            <thead><tr><th>Agent</th><th>${kpi.label}</th></tr></thead>
            <tbody>${agentRows}</tbody>
          </table>
        </div>
      </div>`;
    }).join('');

    _lastUpdate = new Date();
    const ts = _lastUpdate.toLocaleTimeString('sv-SE');

    container.innerHTML = `
      <div class="cc-kpi-section">
        <div class="cc-section-header">
          <span class="section-title">§ CC · Customer Care Performance</span>
          <span class="tag analytics">ANALYTICS</span>
        </div>
        <div class="cc-kpi-live-bar">
          <div class="cc-live-dot"></div>
          <span class="cc-live-label">Live · Uppdateras var 60s · Senast: ${ts}</span>
          <div class="cc-view-btns">
            <button class="cc-view-btn ${_view==='day'?'active':''}" onclick="setCCView('day')">Dag</button>
            <button class="cc-view-btn ${_view==='week'?'active':''}" onclick="setCCView('week')">Vecka</button>
            <button class="cc-view-btn ${_view==='month'?'active':''}" onclick="setCCView('month')">Månad</button>
          </div>
        </div>
        <div class="cc-kpi-cards">${cards}</div>
        ${breakdowns}
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div style="font-size:11px;font-weight:600;color:var(--text3)">${_view==='day'?'Dag-för-dag (innevarande vecka)':_view==='week'?'Veckoredovisning (senaste 12 veckor)':'Månadsredovisning (senaste 12 månader)'}</div>
          <button class="cc-csv-btn" onclick="ccExportCSV('${tableId}')">⬇ Exportera CSV</button>
        </div>
        <div style="overflow-x:auto">
          <table class="cc-tbl" id="${tableId}">
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ── Global helpers (called from HTML onclick) ─────────────────────────────
  window.setCCView = function (v) {
    _view = v;
    renderCCKPIs();
  };

  window.toggleCCBreakdown = function (kpiId) {
    const el = document.getElementById('cc-bd-' + kpiId);
    if (el) el.classList.toggle('open');
  };

  window.switchCCBdTab = function (kpiId, tab, btn) {
    const panels = document.querySelectorAll('#cc-bd-' + kpiId + ' .cc-bd-panel');
    const btns   = document.querySelectorAll('#cc-bd-' + kpiId + ' .cc-bd-tab');
    panels.forEach(p => p.classList.remove('active'));
    btns.forEach(b => b.classList.remove('active'));
    const panel = document.getElementById('cc-bd-' + kpiId + '-' + tab);
    if (panel) panel.classList.add('active');
    btn.classList.add('active');
  };

  window.sortCCTable = function (th) {
    const tbl = th.closest('table');
    const idx = [...th.parentNode.children].indexOf(th);
    const asc = th.dataset.asc !== 'true';
    th.dataset.asc = asc;
    const tbody = tbl.querySelector('tbody');
    const rows = [...tbody.querySelectorAll('tr')];
    rows.sort((a, b) => {
      const av = a.children[idx]?.innerText.replace(/[^0-9.]/g, '') || '';
      const bv = b.children[idx]?.innerText.replace(/[^0-9.]/g, '') || '';
      const an = parseFloat(av), bn = parseFloat(bv);
      if (!isNaN(an) && !isNaN(bn)) return asc ? an - bn : bn - an;
      return asc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    rows.forEach(r => tbody.appendChild(r));
  };

  window.ccExportCSV = function (tableId) { tableToCSV(tableId); };

  // ── Auto-refresh ──────────────────────────────────────────────────────────
  function startCCRefresh() {
    if (_refreshTimer) clearInterval(_refreshTimer);
    _refreshTimer = setInterval(function () {
      if (document.getElementById('cc-kpi-section')) renderCCKPIs();
    }, 60000);
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  window.initCCKPIs = function () {
    renderCCKPIs();
    startCCRefresh();
  };

})();
