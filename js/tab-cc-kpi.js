// js/tab-cc-kpi.js — Customer Care KPI Section v2
// FIX: proper hash-based PRNG, realistic variance, trend + noise per KPI

(function () {
  'use strict';

  const KPI_DEFS = [
    { id: 'fr_sla',  label: 'First Response SLA',      unit: '%',  target: 90,  higherIsBetter: true,  description: 'Tickets answered within SLA target' },
    { id: 'res_sla', label: 'Resolution SLA',           unit: '%',  target: 85,  higherIsBetter: true,  description: 'Tickets resolved within SLA target' },
    { id: 'fcr',     label: 'FCR',                      unit: '%',  target: 75,  higherIsBetter: true,  description: 'First Contact Resolution – no reopening' },
    { id: 'csat',    label: 'CSAT',                     unit: '/5', target: 4.2, higherIsBetter: true,  description: 'Customer Satisfaction Score (1–5)' },
    { id: 'tpd',     label: 'Tickets / Agent / Day',    unit: '',   target: 20,  higherIsBetter: true,  description: 'Avg handled tickets per agent per working day' },
  ];

  const PRODUCTS = ['Simployer Classic', 'Simployer One', 'Expert NO', 'Frankly', 'Talent'];
  const AGENTS   = ['Therese N.', 'Emil G.', 'Kari K.', 'Martin Å.', 'Arkadiusz Z.',
                    'Mats L.', 'Ilse L.', 'Ian M.', 'Honya M.', 'Anett N.'];

  // ── Wang hash – full avalanche, no LCG sequential drift ──────────────────
  // Two seeds differing by 1 produce completely different outputs.
  function wangHash(n) {
    n = (n ^ 61) ^ (n >>> 16);
    n = (n + (n << 3)) >>> 0;
    n = (n ^ (n >>> 4)) >>> 0;
    n = Math.imul(n, 0x27d4eb2d) >>> 0;
    n = (n ^ (n >>> 15)) >>> 0;
    return n / 0xffffffff;
  }

  // Combine seed + two salts for independent draws
  function hash2(seed, salt1, salt2) {
    return wangHash((seed * 2654435761 + salt1 * 40503 + salt2 * 6271) >>> 0);
  }

  // ── KPI-specific realistic baselines and variance ─────────────────────────
  // Each KPI has: base, weeklySD (std-dev %), trend (per-week drift),
  // and an autocorrelation so consecutive weeks aren't totally independent.
  const KPI_PROFILE = {
    fr_sla:  { base: 88.5, sd: 3.2,  trend:  0.12, min: 72, max: 98   },
    res_sla: { base: 83.0, sd: 3.8,  trend:  0.08, min: 68, max: 96   },
    fcr:     { base: 72.0, sd: 4.5,  trend:  0.15, min: 58, max: 88   },
    csat:    { base: 4.05, sd: 0.18, trend:  0.004,min: 3.5, max: 4.8 },
    tpd:     { base: 19.5, sd: 2.8,  trend:  0.06, min: 12, max: 32   },
  };

  // Generate a value for a KPI at a given period index (0=oldest, 11=latest)
  // periodIdx: 0-11 for weeks/months, day: 0-6 for days
  function kpiVal(kpi, periodIdx, totalPeriods, uniqueSeed) {
    const p = KPI_PROFILE[kpi.id];
    // Trend: gradual improvement toward target over the period window
    const trendAdj = p.trend * periodIdx;
    // Noise: 2 independent hash draws -> Box-Muller normal approximation
    const u1 = Math.max(1e-9, hash2(uniqueSeed, periodIdx * 7 + 1, kpi.id.length));
    const u2 = hash2(uniqueSeed, periodIdx * 7 + 2, kpi.id.length * 13);
    const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    // Seasonal: slightly worse at start of month (simulated)
    const seasonalDip = (periodIdx % 4 === 0) ? -p.sd * 0.4 : 0;
    const raw = p.base + trendAdj + z * p.sd + seasonalDip;
    const val = Math.max(p.min, Math.min(p.max, raw));
    return kpi.id === 'csat' ? +val.toFixed(2) : +val.toFixed(1);
  }

  // ── Period row generators ─────────────────────────────────────────────────
  function getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  }

  // uniqueSeed: hash of (year*10000 + month*100 + day) for good dispersion
  function dateSeed(dt) {
    return wangHash((dt.getFullYear() * 10000 + (dt.getMonth() + 1) * 100 + dt.getDate()) * 2654435761 >>> 0) * 1e9 | 0;
  }
  function weekSeed(dt) {
    const wn = getWeekNumber(dt);
    return wangHash((dt.getFullYear() * 1000 + wn) * 2654435761 >>> 0) * 1e9 | 0;
  }
  function monthSeed(dt) {
    return wangHash((dt.getFullYear() * 100 + dt.getMonth()) * 2654435761 >>> 0) * 1e9 | 0;
  }

  function getDayRows() {
    const rows = []; const now = new Date();
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    for (let d = 0; d < 7; d++) {
      const dt = new Date(mon); dt.setDate(mon.getDate() + d);
      const isFuture = dt > now;
      rows.push({ label: dt.toLocaleDateString('sv-SE', { weekday: 'short', month: 'numeric', day: 'numeric' }), seed: dateSeed(dt), isFuture, periodIdx: d });
    }
    return rows;
  }

  function getWeekRows() {
    const rows = []; const now = new Date();
    for (let w = 11; w >= 0; w--) {
      const start = new Date(now); start.setDate(now.getDate() - ((now.getDay() + 6) % 7) - w * 7);
      const end = new Date(start); end.setDate(start.getDate() + 6);
      const wn = getWeekNumber(start);
      rows.push({
        label: 'v' + wn + ' (' + start.toLocaleDateString('sv-SE', { month: 'numeric', day: 'numeric' }) + '–' + end.toLocaleDateString('sv-SE', { month: 'numeric', day: 'numeric' }) + ')',
        seed: weekSeed(start), periodIdx: 11 - w
      });
    }
    return rows;
  }

  function getMonthRows() {
    const rows = []; const now = new Date();
    for (let m = 11; m >= 0; m--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - m, 1);
      rows.push({ label: dt.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short' }), seed: monthSeed(dt), periodIdx: 11 - m });
    }
    return rows;
  }

  function getProductBreakdown(kpi, periodIdx, seed) {
    return PRODUCTS.map((p, i) => {
      const pSeed = wangHash((seed * 31 + i * 17) * 2654435761 >>> 0) * 1e9 | 0;
      return { name: p, value: kpiVal(kpi, periodIdx, 12, pSeed + i) };
    });
  }

  function getAgentBreakdown(kpi, periodIdx, seed) {
    return AGENTS.map((a, i) => {
      const aSeed = wangHash((seed * 13 + i * 41) * 2654435761 >>> 0) * 1e9 | 0;
      return { name: a, value: kpiVal(kpi, periodIdx, 12, aSeed + i * 3) };
    });
  }

  // ── Status helpers ────────────────────────────────────────────────────────
  function statusClass(kpi, val) {
    const ratio = kpi.higherIsBetter ? val / kpi.target : kpi.target / val;
    if (ratio >= 1.0)  return 'cc-ok';
    if (ratio >= 0.93) return 'cc-warn';
    return 'cc-crit';
  }

  function statusDot(kpi, val) {
    const cls = statusClass(kpi, val);
    const color = cls === 'cc-ok' ? '#28a745' : cls === 'cc-warn' ? '#ffc107' : '#dc3545';
    return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + color + ';margin-right:5px;flex-shrink:0"></span>';
  }

  function trendArrow(curr, prev) {
    if (curr === null || prev === null || prev === undefined) return '<span style="color:#999">—</span>';
    const delta = curr - prev;
    if (Math.abs(delta) < 0.05) return '<span style="color:#999">→</span>';
    return delta > 0
      ? '<span style="color:#28a745;font-size:13px;">▲</span>'
      : '<span style="color:#dc3545;font-size:13px;">▼</span>';
  }

  // ── Sparkline ─────────────────────────────────────────────────────────────
  function sparkline(values, target, color) {
    if (!values || values.length < 2) return '';
    const W = 80, H = 24;
    const allVals = [...values, target];
    const min = Math.min(...allVals) * 0.97;
    const max = Math.max(...allVals) * 1.03;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - min) / (max - min + 0.001)) * H;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    const ty = H - ((target - min) / (max - min + 0.001)) * H;
    return '<svg width="' + W + '" height="' + H + '" style="vertical-align:middle">' +
      '<line x1="0" y1="' + ty.toFixed(1) + '" x2="' + W + '" y2="' + ty.toFixed(1) + '" stroke="#ccc" stroke-dasharray="2,2" stroke-width="1"/>' +
      '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.5"/>' +
      '<circle cx="' + ((values.length-1)/(values.length-1)*W).toFixed(1) + '" cy="' + (H - ((values[values.length-1]-min)/(max-min+0.001))*H).toFixed(1) + '" r="2.5" fill="' + color + '"/>' +
      '</svg>';
  }

  // ── CSV export ────────────────────────────────────────────────────────────
  function tableToCSV(tableId) {
    const tbl = document.getElementById(tableId);
    if (!tbl) return;
    const rows = [...tbl.querySelectorAll('tr')].map(r =>
      [...r.querySelectorAll('th,td')].map(c => '"' + c.innerText.replace(/"/g, '""') + '"').join(',')
    );
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = tableId + '.csv'; a.click();
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('cc-kpi-styles')) return;
    const s = document.createElement('style');
    s.id = 'cc-kpi-styles';
    s.textContent = `
      .cc-kpi-section{margin-top:24px}
      .cc-kpi-live-bar{display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap}
      .cc-live-dot{width:10px;height:10px;border-radius:50%;background:#28a745;animation:ccPulse 1.5s infinite;flex-shrink:0}
      @keyframes ccPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}
      .cc-live-label{font-size:12px;color:#666}
      .cc-view-btns{display:flex;gap:4px;margin-left:auto}
      .cc-view-btn{padding:3px 10px;font-size:11px;border:1px solid var(--border);border-radius:4px;background:none;color:var(--text3);cursor:pointer;transition:.15s}
      .cc-view-btn.active{background:var(--accent);color:#fff;border-color:var(--accent)}
      .cc-kpi-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:16px}
      .cc-kpi-card{background:#fff;border:1px solid var(--border);border-radius:8px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.06);position:relative;cursor:pointer;transition:.15s}
      .cc-kpi-card:hover{box-shadow:0 3px 8px rgba(0,0,0,.12)}
      .cc-kpi-card.cc-ok{border-left:3px solid #28a745}
      .cc-kpi-card.cc-warn{border-left:3px solid #ffc107}
      .cc-kpi-card.cc-crit{border-left:3px solid #dc3545}
      .cc-card-label{font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
      .cc-card-value{font-size:26px;font-weight:700;line-height:1}
      .cc-card-unit{font-size:13px;color:var(--text3);margin-left:2px}
      .cc-card-delta{font-size:11px;margin-top:4px;color:#666;display:flex;align-items:center;gap:3px}
      .cc-card-desc{font-size:10px;color:#999;margin-top:2px}
      .cc-expand-btn{position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;color:#999;font-size:14px;padding:2px 4px;border-radius:3px}
      .cc-expand-btn:hover{background:#f0f0f0}
      .cc-breakdown{display:none;border:1px solid var(--border);border-radius:8px;background:#fff;padding:14px;margin-top:8px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
      .cc-breakdown.open{display:block}
      .cc-bd-tabs{display:flex;gap:4px;margin-bottom:12px}
      .cc-bd-tab{padding:4px 12px;font-size:11px;border:1px solid var(--border);border-radius:4px;background:none;cursor:pointer}
      .cc-bd-tab.active{background:#e8f5e9;border-color:#28a745;color:#28a745;font-weight:600}
      .cc-bd-panel{display:none}
      .cc-bd-panel.active{display:block}
      .cc-tbl{width:100%;border-collapse:collapse;font-size:12px}
      .cc-tbl th{background:#f8f9fa;padding:6px 10px;text-align:left;font-weight:600;color:var(--text3);border-bottom:2px solid var(--border);cursor:pointer;white-space:nowrap;user-select:none}
      .cc-tbl th:hover{background:#eee}
      .cc-tbl td{padding:6px 10px;border-bottom:1px solid #f0f0f0;vertical-align:middle}
      .cc-tbl td:first-child{white-space:nowrap}
      .cc-tbl tr:nth-child(even) td{background:#fafafa}
      .cc-tbl tr:hover td{background:#f0f7ff}
      .cc-tbl tr.future td{color:#bbb;font-style:italic}
      .cc-ok{color:#28a745}
      .cc-warn{color:#ffc107}
      .cc-crit{color:#dc3545}
      .cc-bar-fill{height:6px;border-radius:3px;display:inline-block;vertical-align:middle;margin-left:6px}
      .cc-csv-btn{font-size:10px;padding:2px 7px;border:1px solid #ccc;border-radius:3px;background:#fff;cursor:pointer;color:#666;margin-bottom:6px}
      .cc-csv-btn:hover{background:#f5f5f5}
      .cc-section-header{display:flex;align-items:center;gap:8px;margin-bottom:10px}
      .tag.analytics{background:#fff3e0;color:#e65100}
    `;
    document.head.appendChild(s);
  }

  // ── State ──────────────────────────────────────────────────────────────────
  let _view = 'day';
  let _refreshTimer = null;

  // ── Main render ───────────────────────────────────────────────────────────
  function renderCCKPIs() {
    const container = document.getElementById('cc-kpi-section');
    if (!container) return;
    injectStyles();

    const rows = _view === 'day' ? getDayRows() : _view === 'week' ? getWeekRows() : getMonthRows();
    const total = rows.length;

    // Summary cards use the LATEST non-future row (consistent with table)
    const latestRow = [...rows].reverse().find(r => !r.isFuture) || rows[rows.length - 1];
    const prevRow   = rows[rows.indexOf(latestRow) - 1] || null;

    const cards = KPI_DEFS.map(kpi => {
      const lv   = kpiVal(kpi, latestRow.periodIdx, total, latestRow.seed);
      const prev = prevRow ? kpiVal(kpi, prevRow.periodIdx, total, prevRow.seed) : null;
      const sc   = statusClass(kpi, lv);
      const delta = prev !== null ? (lv - prev).toFixed(kpi.id === 'csat' ? 2 : 1) : null;
      const sign  = delta !== null && +delta >= 0 ? '+' : '';
      const sparkVals = rows.filter(r => !r.isFuture).slice(-7).map(r => kpiVal(kpi, r.periodIdx, total, r.seed));
      const color = sc === 'cc-ok' ? '#28a745' : sc === 'cc-warn' ? '#ffc107' : '#dc3545';
      const dispVal = kpi.id === 'csat' ? lv.toFixed(2) : lv.toFixed(1);

      return `<div class="cc-kpi-card ${sc}" id="cc-card-${kpi.id}" onclick="toggleCCBreakdown('${kpi.id}')">
        <button class="cc-expand-btn" title="Drill down">⌄</button>
        <div class="cc-card-label">${kpi.label}</div>
        <div style="display:flex;align-items:baseline;gap:4px">
          <span class="cc-card-value ${sc}">${dispVal}</span>
          <span class="cc-card-unit">${kpi.unit}</span>
        </div>
        <div class="cc-card-delta">${trendArrow(lv, prev)} ${delta !== null ? sign + delta + ' vs föregående' : '–'}</div>
        <div style="margin-top:6px">${sparkline(sparkVals, kpi.target, color)}</div>
        <div class="cc-card-desc">Mål: ${kpi.target}${kpi.unit}</div>
      </div>`;
    }).join('');

    // Full table
    const tableId = 'cc-main-table-' + _view;
    const thead = '<tr><th onclick="sortCCTable(this)">Period ↕</th>' +
      KPI_DEFS.map(k => '<th onclick="sortCCTable(this)">' + k.label + '</th>').join('') + '</tr>';

    const tbody = rows.map(row => {
      if (row.isFuture) {
        return '<tr class="future"><td>' + row.label + '</td>' + KPI_DEFS.map(() => '<td>—</td>').join('') + '</tr>';
      }
      const cells = KPI_DEFS.map((kpi, ki) => {
        const v   = kpiVal(kpi, row.periodIdx, total, row.seed);
        const sc  = statusClass(kpi, v);
        const disp = kpi.id === 'csat' ? v.toFixed(2) : v.toFixed(1);
        return '<td style="display:flex;align-items:center">' + statusDot(kpi, v) + '<span class="' + sc + '">' + disp + kpi.unit + '</span></td>';
      }).join('');
      return '<tr><td>' + row.label + '</td>' + cells + '</tr>';
    }).join('');

    // Breakdowns
    const breakdowns = KPI_DEFS.map(kpi => {
      const lr = latestRow;
      const prodData  = getProductBreakdown(kpi, lr.periodIdx, lr.seed);
      const agentData = getAgentBreakdown(kpi, lr.periodIdx, lr.seed);
      const maxProd   = Math.max(...prodData.map(p => p.value));
      const maxAgent  = Math.max(...agentData.map(a => a.value));

      const prodRows = prodData.map(p => {
        const sc = statusClass(kpi, p.value);
        const pct = (p.value / maxProd * 100).toFixed(0);
        const color = sc === 'cc-ok' ? '#28a745' : sc === 'cc-warn' ? '#ffc107' : '#dc3545';
        return '<tr><td>' + p.name + '</td><td style="display:flex;align-items:center"><span class="' + sc + '">' +
          (kpi.id === 'csat' ? p.value.toFixed(2) : p.value.toFixed(1)) + kpi.unit + '</span>' +
          '<span class="cc-bar-fill" style="width:' + pct + 'px;background:' + color + '"></span></td></tr>';
      }).join('');

      const agentRows = [...agentData].sort((a, b) => b.value - a.value).map(a => {
        const sc = statusClass(kpi, a.value);
        const pct = (a.value / maxAgent * 100).toFixed(0);
        const color = sc === 'cc-ok' ? '#28a745' : sc === 'cc-warn' ? '#ffc107' : '#dc3545';
        const initials = a.name.split(/[. ]/g).filter(Boolean).slice(0,2).map(x=>x[0]).join('');
        return '<tr><td style="display:flex;align-items:center;gap:6px"><span style="background:#e3f2fd;color:#1565c0;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0">' + initials + '</span>' + a.name + '</td>' +
          '<td style="display:flex;align-items:center"><span class="' + sc + '">' +
          (kpi.id === 'csat' ? a.value.toFixed(2) : a.value.toFixed(1)) + kpi.unit + '</span>' +
          '<span class="cc-bar-fill" style="width:' + pct + 'px;background:' + color + '"></span></td></tr>';
      }).join('');

      const bdP = 'cc-bd-prod-' + kpi.id;
      const bdA = 'cc-bd-agent-' + kpi.id;

      return `<div class="cc-breakdown" id="cc-bd-${kpi.id}">
        <div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:8px">${kpi.label} – Breakdown (senaste period)</div>
        <div class="cc-bd-tabs">
          <button class="cc-bd-tab active" onclick="event.stopPropagation();switchCCBdTab('${kpi.id}','prod',this)">Per produkt</button>
          <button class="cc-bd-tab"        onclick="event.stopPropagation();switchCCBdTab('${kpi.id}','agent',this)">Per agent</button>
        </div>
        <div class="cc-bd-panel active" id="cc-bd-${kpi.id}-prod">
          <button class="cc-csv-btn" onclick="event.stopPropagation();ccExportCSV('${bdP}')">⬇ CSV</button>
          <table class="cc-tbl" id="${bdP}"><thead><tr><th>Produkt</th><th>${kpi.label}</th></tr></thead><tbody>${prodRows}</tbody></table>
        </div>
        <div class="cc-bd-panel" id="cc-bd-${kpi.id}-agent">
          <button class="cc-csv-btn" onclick="event.stopPropagation();ccExportCSV('${bdA}')">⬇ CSV</button>
          <table class="cc-tbl" id="${bdA}"><thead><tr><th>Agent</th><th>${kpi.label}</th></tr></thead><tbody>${agentRows}</tbody></table>
        </div>
      </div>`;
    }).join('');

    const ts = new Date().toLocaleTimeString('sv-SE');
    const viewLabel = _view === 'day' ? 'Dag-för-dag (innevarande vecka)' : _view === 'week' ? 'Veckoredovisning (senaste 12 veckor)' : 'Månadsredovisning (senaste 12 månader)';

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
            <button class="cc-view-btn ${_view==='day'?'active':''}"   onclick="setCCView('day')">Dag</button>
            <button class="cc-view-btn ${_view==='week'?'active':''}"  onclick="setCCView('week')">Vecka</button>
            <button class="cc-view-btn ${_view==='month'?'active':''}" onclick="setCCView('month')">Månad</button>
          </div>
        </div>
        <div class="cc-kpi-cards">${cards}</div>
        ${breakdowns}
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div style="font-size:11px;font-weight:600;color:var(--text3)">${viewLabel}</div>
          <button class="cc-csv-btn" onclick="ccExportCSV('${tableId}')">⬇ Exportera CSV</button>
        </div>
        <div style="overflow-x:auto">
          <table class="cc-tbl" id="${tableId}">
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
        <div style="font-size:11px;color:#999;text-align:center;padding-top:6px">
          CC Analytics · Simulerad data (mock) · Koppla mot Freshdesk API för realtidsdata
        </div>
      </div>`;
  }

  // ── Global helpers ────────────────────────────────────────────────────────
  window.setCCView = function(v) { _view = v; renderCCKPIs(); };

  window.toggleCCBreakdown = function(kpiId) {
    const el = document.getElementById('cc-bd-' + kpiId);
    if (el) el.classList.toggle('open');
  };

  window.switchCCBdTab = function(kpiId, tab, btn) {
    document.querySelectorAll('#cc-bd-' + kpiId + ' .cc-bd-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('#cc-bd-' + kpiId + ' .cc-bd-tab').forEach(b => b.classList.remove('active'));
    const panel = document.getElementById('cc-bd-' + kpiId + '-' + tab);
    if (panel) panel.classList.add('active');
    btn.classList.add('active');
  };

  window.sortCCTable = function(th) {
    const tbl = th.closest('table');
    const idx = [...th.parentNode.children].indexOf(th);
    const asc = th.dataset.asc !== 'true'; th.dataset.asc = asc;
    const tbody = tbl.querySelector('tbody');
    [...tbody.querySelectorAll('tr')].sort((a, b) => {
      const av = a.children[idx]?.innerText.replace(/[^0-9.-]/g, '') || '';
      const bv = b.children[idx]?.innerText.replace(/[^0-9.-]/g, '') || '';
      const an = parseFloat(av), bn = parseFloat(bv);
      if (!isNaN(an) && !isNaN(bn)) return asc ? an - bn : bn - an;
      return asc ? av.localeCompare(bv) : bv.localeCompare(av);
    }).forEach(r => tbody.appendChild(r));
  };

  window.ccExportCSV = function(tableId) { tableToCSV(tableId); };

  // ── Auto-refresh ──────────────────────────────────────────────────────────
  function startCCRefresh() {
    if (_refreshTimer) clearInterval(_refreshTimer);
    _refreshTimer = setInterval(function() {
      if (document.getElementById('cc-kpi-section')) renderCCKPIs();
    }, 60000);
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  window.initCCKPIs = function() { renderCCKPIs(); startCCRefresh(); };

})();
