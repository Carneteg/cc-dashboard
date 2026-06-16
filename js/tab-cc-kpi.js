// tab-cc-kpi.js v5.1 - CC KPI section for Executive Summary
// Fix v5.1: Fixed CSV export syntax error (quote replace)

(function () {
  'use strict';

  var KPI_DEFS = [
    { id: 'fr_sla',  label: 'First Response SLA', units: '%',  target: 90, lcl: 70, ucl: 99 },
    { id: 'res_sla', label: 'Resolution SLA',     units: '%',  target: 85, lcl: 65, ucl: 97 },
    { id: 'fcr',     label: 'FCR',                units: '%',  target: 75, lcl: 55, ucl: 90 },
    { id: 'csat',    label: 'CSAT',               units: '/5', target: 4.2, lcl: 3.0, ucl: 5.0 },
    { id: 'tpad',    label: 'Tickets / Agent / Day', units: '', target: 20, lcl: 10, ucl: 35 }
  ];

  var PRODUCTS = ['Simployer Classic', 'Simployer One', 'Expert NO', 'Frankly', 'Talent'];
  var AGENTS = ['Theresa M.', 'Emil O.', 'Kari K.', 'Martin G.', 'Ariadna Z.',
                'Mats L.', 'Elsa L.', 'Ian M.', 'Sonya M.', 'Matt O.'];

  // Wang hash PRNG - full avalanche, deterministic
  function wh(n) {
    n = n >>> 0;
    n = (n ^ 61) ^ (n >>> 16);
    n = (n + (n << 3)) >>> 0;
    n = (n ^ (n >>> 4)) >>> 0;
    n = Math.imul(n, 0x27d4eb2d) >>> 0;
    n = (n ^ (n >>> 15)) >>> 0;
    return n / 4294967296;
  }

  function h2(a, b) { return wh((a * 1000003 + b * 999983) >>> 0); }

  function randn(a, b) {
    return h2(a, b) + h2(a + 7777, b + 3333) + h2(a + 5555, b + 1111) + h2(a + 2222, b + 8888) - 2;
  }

  var KP = {
    fr_sla:  { base: 88.5, sd: 4.2, trend: 0.12 },
    res_sla: { base: 83.0, sd: 3.5, trend: 0.09 },
    fcr:     { base: 73.5, sd: 4.0, trend: 0.07 },
    csat:    { base: 4.15, sd: 0.22, trend: 0.003 },
    tpad:    { base: 20.5, sd: 2.8, trend: 0.04 }
  };

  var KPI_IDX = { fr_sla: 0, res_sla: 1, fcr: 2, csat: 3, tpad: 4 };

  function kpiVal(kId, pIdx, total) {
    var p = KP[kId];
    var ki = KPI_IDX[kId];
    var noise = randn(pIdx * 17 + ki * 1009, pIdx * 503 + ki * 131);
    var trend = p.trend * (pIdx - (total - 1) / 2);
    var val = p.base + noise * p.sd + trend;
    if (kId === 'csat') return Math.min(5.0, Math.max(1.0, +val.toFixed(2)));
    if (kId === 'tpad') return Math.max(5, +val.toFixed(1));
    return Math.min(99.9, Math.max(30, +val.toFixed(1)));
  }

  function kpiValFor(kId, pIdx, total, entityIdx) {
    var p = KP[kId];
    var ki = KPI_IDX[kId];
    var noise = randn(pIdx * 17 + ki * 1009 + entityIdx * 79, pIdx * 503 + ki * 131 + entityIdx * 997);
    var entityOffset = (wh(entityIdx * 4999 + ki * 2333) - 0.5) * p.sd * 1.2;
    var trend = p.trend * (pIdx - (total - 1) / 2);
    var val = p.base + noise * p.sd * 0.7 + entityOffset + trend;
    if (kId === 'csat') return Math.min(5.0, Math.max(1.0, +val.toFixed(2)));
    if (kId === 'tpad') return Math.max(5, +val.toFixed(1));
    return Math.min(99.9, Math.max(20, +val.toFixed(1)));
  }

  function fmtVal(kId, val) {
    return (kId === 'csat') ? val.toFixed(2) : val.toFixed(1);
  }

  function statusOf(kId, val) {
    var t = KPI_DEFS[KPI_IDX[kId]];
    var warn = kId === 'csat' ? 4.0 : (kId === 'tpad' ? t.target * 0.85 : t.target * 0.96);
    if (val >= t.target) return 'green';
    if (val >= warn) return 'yellow';
    return 'red';
  }

  var C = { green: '#28a745', yellow: '#ffc107', red: '#dc3545' };

  function weekStart(d) {
    var day = d.getDay();
    var diff = (day === 0) ? -6 : (1 - day);
    var m = new Date(d);
    m.setDate(d.getDate() + diff);
    m.setHours(0, 0, 0, 0);
    return m;
  }

  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    var y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y) / 86400000 + 1) / 7);
  }

  function ddmm(d) { return d.getDate() + '/' + (d.getMonth() + 1); }

  var DAYS_SV   = ['S\u00f6n', 'M\u00e5n', 'Tis', 'Ons', 'Tor', 'Fre', 'L\u00f6r'];
  var MONTHS_SV = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];

  var VIEW = 'week';
  var BD   = null;

  function render() {
    var el = document.getElementById('cc-kpi-section');
    if (!el) return;
    var now = new Date();
    var ts = now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var liveIdx = 11;

    var cards = '';
    KPI_DEFS.forEach(function (k) {
      var v    = kpiVal(k.id, liveIdx, 12);
      var prev = kpiVal(k.id, liveIdx - 1, 12);
      var diff = v - prev;
      var pos  = diff >= 0;
      var arrow = pos ? '&#9650;' : '&#9660;';
      var dc    = pos ? '#28a745' : '#dc3545';
      var spark = buildSparkline(k);
      var maxV  = k.id === 'csat' ? 5 : (k.id === 'tpad' ? 40 : 100);
      var pct   = Math.min(100, Math.max(0, (v / maxV) * 100)).toFixed(1);
      cards += '<div class="cc-kpi-card" onclick="toggleCCBd(\''  + k.id + '\')" style="cursor:pointer;background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:16px;flex:1;min-width:160px;position:relative;">' +
        '<div style="font-size:11px;font-weight:600;color:#6c757d;letter-spacing:.6px;text-transform:uppercase;margin-bottom:8px;">' + k.label + '</div>' +
        '<div style="font-size:36px;font-weight:700;color:#1a1a1a;line-height:1;">' + fmtVal(k.id, v) +
        '<span style="font-size:16px;font-weight:400;color:#6c757d;">' + k.units + '</span></div>' +
        '<div style="font-size:12px;margin-top:6px;color:' + dc + ';font-weight:600;">' +
        arrow + ' ' + Math.abs(diff).toFixed(k.id === 'csat' ? 2 : 1) + ' vs f\u00f6reg\u00e5ende</div>' +
        '<div style="height:3px;background:#e9ecef;border-radius:2px;margin:10px 0 4px;">' +
        '<div style="height:100%;width:' + pct + '%;background:#28a745;border-radius:2px;"></div></div>' +
        '<div style="font-size:11px;color:#9e9e9e;">M\u00e5l: ' + k.target + (k.units || '') + '</div>' +
        spark + '</div>';
    });

    var tableHtml = buildTable(now);
    var bdHtml    = BD ? buildBreakdown(BD) : '';

    el.innerHTML =
      '<div style="margin:24px 0;">' +
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">' +
      '<span style="font-size:13px;font-weight:700;color:#1a1a1a;letter-spacing:.5px;text-transform:uppercase;">&#167; CC \u2013 CUSTOMER CARE PERFORMANCE</span>' +
      '<span style="font-size:10px;font-weight:700;background:#fff3e0;color:#e65100;padding:2px 8px;border-radius:4px;letter-spacing:.5px;">ANALYTICS</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;font-size:12px;color:#6c757d;">' +
      '<span style="width:8px;height:8px;border-radius:50%;background:#28a745;display:inline-block;animation:ccPulse 1.4s ease-in-out infinite;"></span>' +
      'Live \u00b7 Uppdateras var 60s \u00b7 Senast: ' + ts +
      '<span style="margin-left:auto;display:flex;">' +
      '<button onclick="setCCView(\'day\')" style="padding:4px 12px;border:1px solid #dee2e6;border-radius:4px 0 0 4px;background:' + (VIEW === 'day' ? '#0d6efd' : '#fff') + ';color:' + (VIEW === 'day' ? '#fff' : '#495057') + ';cursor:pointer;font-size:12px;">Dag</button>' +
      '<button onclick="setCCView(\'week\')" style="padding:4px 12px;border:1px solid #dee2e6;border-left:none;background:' + (VIEW === 'week' ? '#0d6efd' : '#fff') + ';color:' + (VIEW === 'week' ? '#fff' : '#495057') + ';cursor:pointer;font-size:12px;">Vecka</button>' +
      '<button onclick="setCCView(\'month\')" style="padding:4px 12px;border:1px solid #dee2e6;border-left:none;border-radius:0 4px 4px 0;background:' + (VIEW === 'month' ? '#0d6efd' : '#fff') + ';color:' + (VIEW === 'month' ? '#fff' : '#495057') + ';cursor:pointer;font-size:12px;">M\u00e5nad</button>' +
      '</span></div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">' + cards + '</div>' +
      bdHtml + tableHtml +
      '<div style="font-size:11px;color:#aaa;margin-top:8px;text-align:center;">CC Analytics \u00b7 Simulerad data (mock) \u00b7 Koppla Freshdesk API for realtidsdata</div>' +
      '</div>' +
      '<style>@keyframes ccPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}</style>';
  }

  function buildSparkline(k) {
    var pts = [];
    for (var i = 4; i < 12; i++) pts.push(kpiVal(k.id, i, 12));
    var mn = k.lcl, mx = k.ucl, w = 80, h = 24;
    var polyline = pts.map(function (v, i) {
      var x = Math.round(i * (w / (pts.length - 1)));
      var y = Math.round(h - ((v - mn) / (mx - mn)) * h);
      return x + ',' + y;
    }).join(' ');
    return '<svg width="' + w + '" height="' + h + '" style="margin-top:8px;display:block;">' +
      '<polyline points="' + polyline + '" fill="none" stroke="#28a745" stroke-width="1.5"/></svg>';
  }

  function buildTable(now) {
    var periods = [];

    if (VIEW === 'day') {
      var ws = weekStart(now);
      for (var d = 0; d < 7; d++) {
        var dt = new Date(ws);
        dt.setDate(ws.getDate() + d);
        periods.push({ label: DAYS_SV[dt.getDay()] + ' ' + ddmm(dt), idx: d, future: dt > now });
      }
    } else if (VIEW === 'week') {
      var wc = weekStart(now);
      for (var w = 11; w >= 0; w--) {
        var ws2 = new Date(wc);
        ws2.setDate(wc.getDate() - w * 7);
        var we2 = new Date(ws2);
        we2.setDate(ws2.getDate() + 6);
        periods.push({ label: 'v' + isoWeek(ws2) + ' (' + ddmm(ws2) + '-' + ddmm(we2) + ')', idx: 11 - w, future: false });
      }
    } else {
      for (var m = 11; m >= 0; m--) {
        var dm = new Date(now.getFullYear(), now.getMonth() - m, 1);
        periods.push({ label: MONTHS_SV[dm.getMonth()] + ' ' + dm.getFullYear(), idx: 11 - m, future: false });
      }
    }

    var thead = '<tr style="background:#f8f9fa;">' +
      '<th style="padding:8px 12px;text-align:left;font-size:11px;color:#6c757d;font-weight:600;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #dee2e6;white-space:nowrap;">Period</th>';
    KPI_DEFS.forEach(function (k) {
      thead += '<th style="padding:8px 12px;text-align:left;font-size:11px;color:#6c757d;font-weight:600;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #dee2e6;white-space:nowrap;">' + k.label + '</th>';
    });
    thead += '</tr>';

    var rows = '';
    periods.forEach(function (p, pi) {
      var bg = (pi % 2 === 0) ? '#fff' : '#f8f9fa';
      var row = '<tr style="background:' + bg + ';">' +
        '<td style="padding:7px 12px;font-size:13px;color:#495057;border-bottom:1px solid #f0f0f0;white-space:nowrap;">' + p.label + '</td>';
      KPI_DEFS.forEach(function (k) {
        if (p.future) {
          row += '<td style="padding:7px 12px;font-size:13px;color:#bbb;border-bottom:1px solid #f0f0f0;">&mdash;</td>';
        } else {
          var v   = kpiVal(k.id, p.idx, 12);
          var st  = statusOf(k.id, v);
          var col = C[st];
          row += '<td style="padding:7px 12px;font-size:13px;border-bottom:1px solid #f0f0f0;white-space:nowrap;">' +
            '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + col + ';margin-right:5px;vertical-align:middle;"></span>' +
            '<span style="color:' + col + ';font-weight:600;">' + fmtVal(k.id, v) + k.units + '</span></td>';
        }
      });
      row += '</tr>';
      rows += row;
    });

    var vLabel = VIEW === 'day' ? 'Dagsredovisning (innevarande vecka)' :
      (VIEW === 'week' ? 'Veckoredovisning (senaste 12 veckor)' : 'M\u00e5nadsredovisning (senaste 12 m\u00e5nader)');

    return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
      '<span style="font-size:12px;color:#6c757d;">' + vLabel + '</span>' +
      '<button onclick="exportCCCSV()" style="padding:4px 10px;background:#fff;border:1px solid #dee2e6;border-radius:4px;font-size:11px;cursor:pointer;color:#495057;">&#8595; Exportera CSV</button>' +
      '</div>' +
      '<div style="overflow-x:auto;">' +
      '<table id="cc-kpi-table" style="width:100%;border-collapse:collapse;font-size:13px;">' +
      '<thead>' + thead + '</thead><tbody>' + rows + '</tbody></table></div>';
  }

  function buildBreakdown(bd) {
    var kd   = KPI_DEFS[KPI_IDX[bd.kId]];
    if (!kd) return '';
    var mode = bd.mode || 'product';
    var maxV = kd.id === 'csat' ? 5 : (kd.id === 'tpad' ? 40 : 100);

    function entityRow(name, val) {
      var st  = statusOf(kd.id, val);
      var col = C[st];
      var pct = Math.min(100, Math.max(0, (val / maxV) * 100)).toFixed(1);
      return '<tr style="border-bottom:1px solid #f0f0f0;">' +
        '<td style="padding:6px 12px;font-size:13px;color:#495057;">' + name + '</td>' +
        '<td style="padding:6px 12px;font-size:13px;">' +
        '<span style="color:' + col + ';font-weight:600;">' + fmtVal(kd.id, val) + kd.units + '</span></td>' +
        '<td style="padding:6px 12px;width:120px;">' +
        '<div style="height:6px;background:#e9ecef;border-radius:3px;">' +
        '<div style="height:100%;width:' + pct + '%;background:' + col + ';border-radius:3px;"></div></div></td></tr>';
    }

    var entityRows = '';
    if (mode === 'product') {
      PRODUCTS.forEach(function (pr, pi) {
        entityRows += entityRow(pr, kpiValFor(kd.id, 11, 12, pi));
      });
    } else {
      AGENTS.forEach(function (ag, ai) {
        var initials = ag.split(' ').map(function (w) { return w[0]; }).join('');
        var badge = '<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#e3f2fd;color:#1565c0;font-size:10px;font-weight:700;margin-right:6px;">' + initials + '</span>';
        entityRows += entityRow(badge + ag, kpiValFor(kd.id, 11, 12, 100 + ai));
      });
    }

    return '<div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;padding:16px;margin-bottom:16px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
      '<span style="font-weight:600;font-size:13px;">' + kd.label + ' \u2013 Breakdown</span>' +
      '<div style="display:flex;gap:4px;">' +
      '<button onclick="event.stopPropagation();setCCBdMode(\'product\')" style="padding:3px 10px;border:1px solid #dee2e6;border-radius:4px 0 0 4px;background:' + (mode === 'product' ? '#0d6efd' : '#fff') + ';color:' + (mode === 'product' ? '#fff' : '#495057') + ';font-size:11px;cursor:pointer;">Per produkt</button>' +
      '<button onclick="event.stopPropagation();setCCBdMode(\'agent\')" style="padding:3px 10px;border:1px solid #dee2e6;border-left:none;border-radius:0 4px 4px 0;background:' + (mode === 'agent' ? '#0d6efd' : '#fff') + ';color:' + (mode === 'agent' ? '#fff' : '#495057') + ';font-size:11px;cursor:pointer;">Per agent</button>' +
      '<button onclick="event.stopPropagation();toggleCCBd(\'close\')" style="padding:3px 10px;border:1px solid #dee2e6;border-radius:4px;background:#fff;color:#495057;font-size:11px;cursor:pointer;margin-left:8px;">&#x2715;</button>' +
      '</div></div>' +
      '<table style="width:100%;border-collapse:collapse;"><tbody>' + entityRows + '</tbody></table></div>';
  }

  window.setCCView = function (v) { VIEW = v; render(); };
  window.toggleCCBd = function (kId) {
    if (kId === 'close' || (BD && BD.kId === kId)) { BD = null; } else { BD = { kId: kId, mode: 'product' }; }
    render();
  };
  window.setCCBdMode = function (m) { if (BD) { BD.mode = m; render(); } };
  window.exportCCCSV = function () {
    var t = document.getElementById('cc-kpi-table');
    if (!t) return;
    var dq = String.fromCharCode(34);
    var csv = Array.from(t.querySelectorAll('tr')).map(function (r) {
      return Array.from(r.querySelectorAll('th,td')).map(function (c) {
        return dq + c.textContent.trim().replace(/"/g, '') + dq;
      }).join(',');
    }).join('\n');
    var a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'cc-kpis.csv';
    a.click();
  };

  window.initCCKPIs = function () { render(); };

  setInterval(function () {
    if (document.getElementById('cc-kpi-section')) render();
  }, 60000);

}());
