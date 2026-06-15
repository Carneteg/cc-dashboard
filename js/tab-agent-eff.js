// js/tab-agent-eff.js -- Named Agents efficiency & occupancy module
// Migrated from index.html "NAMED AGENTS DROP-IN SCRIPT"
// naInit() is called by main.js on DOMContentLoaded

function naFmt(n){ return (Math.round(n*100)/100).toLocaleString("en-US"); }
function naEsc(s){ return String(s ?? "").replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }

function naBuildMonths(sel){
var now = new Date(); var opts = [];
for(var i=0;i<6;i++){
var d = new Date(now.getFullYear(), now.getMonth()-i, 1);
var ym = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
var label = d.toLocaleDateString("en-US",{month:"long",year:"numeric"});
opts.push('<option value="'+ym+'">'+label+'</option>');
}
sel.innerHTML = opts.join("");
}

async function renderNamedAgents(month, pool){
var body = document.getElementById("na-body");
var meta = document.getElementById("na-meta");
if(!body) return;
body.innerHTML = '<div class="na-empty">Loading…</div>';
try{
var url = new URL("https://psyelfxaehmtnfdaobyi.supabase.co/functions/v1/cc-dashboard-api/agent-breakdown");
url.searchParams.set("month", month);
if(pool) url.searchParams.set("pool", pool);
var SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzeWVsZnhhZWhtdG5mZGFvYnlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTM2NzksImV4cCI6MjA5NjU4OTY3OX0.Nenlc-8pab7hfLtkRDovXyr_QL5cnBwZlRY9jmGaOAs";
var fcrUrl = "https://psyelfxaehmtnfdaobyi.supabase.co/rest/v1/rpc/get_agent_fcr";
var [res, fcrRes] = await Promise.all([
  fetch(url),
  fetch(fcrUrl, {method:'POST', headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,'Content-Type':'application/json'}, body:JSON.stringify({p_year_month:month})})
]);
if(!res.ok) throw new Error("HTTP " + res.status);
var data = await res.json();
var fcrData = fcrRes.ok ? await fcrRes.json() : [];
var agents = data.agents || [];
var ACTIVE_ROSTER = ["Tobias Carneteg","Therese Nordtvedt","Ketil Olsen","Kari Engebåten","Martin Apiwat Eriksson","Arkadiusz Zawodnik","Mats Larsen","Ilse Larsson","Ian Masite","Honya Mohammed","Hege Anita Aarnesen","Johanna Martinsson","Jimmy Skille"];
agents = agents.filter(function(a){
var norm=function(s){return s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();};
return ACTIVE_ROSTER.some(function(r){return norm(r)===norm(a.agent_name);});
});
var norm=function(s){return s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();};
var fcrMap={};
(Array.isArray(fcrData)?fcrData:[]).forEach(function(f){ fcrMap[norm(f.agent_name)]=f; });
if(meta) meta.textContent = (agents.length) + " agents · " + naFmt(data.total_handled||0) + " tickets";
if(!agents.length){
body.innerHTML = '<div class="na-empty">No agent data for this period.</div>';
return;
}
var max = Math.max.apply(null, agents.map(function(a){return a.handled_tickets;}));
if(max < 1) max = 1;
function fmtTime(mins){
var h = Math.floor(mins/60), m = Math.round(mins%60);
return h > 0 ? h+"h "+m+"m" : m+"m";
}
function fcrColor(pct){
if(pct>=20) return 'color:#22c55e';
if(pct>=10) return 'color:#f59e0b';
return 'color:#ef4444';
}
var rows = agents.map(function(a, i){
var w = Math.max(3, Math.round((a.handled_tickets / max) * 90));
var ahtMins = a.avg_handle_minutes || 0;
var totalMins = ahtMins * a.cc_scope_tickets;
var ahtTxt = a.measured ? naFmt(ahtMins) : naFmt(ahtMins)+"*";
var drillId = "na-drill-"+i;
var fcrRow = fcrMap[norm(a.agent_name)];
var fcrPct = fcrRow ? Number(fcrRow.fcr_pct) : null;
var avgRep = fcrRow ? Number(fcrRow.avg_replies) : null;
var fcrTxt = fcrPct !== null ? naFmt(fcrPct)+"%" : "–";
var repTxt = avgRep !== null ? naFmt(avgRep) : "–";
var fcrStyle = fcrPct !== null ? fcrColor(fcrPct) : '';
var poolRows = (a.pools||[]).filter(function(p){return p.handled_tickets>0;}).map(function(p){
var pMins = (p.eff_aht_weighted||0) * (p.cc_scope_tickets||p.handled_tickets);
return "<tr class='na-drill-pool'>"
+"<td style='padding-left:32px;color:#64748b;font-size:12px'>└ "+naEsc(p.pool)+"</td>"
+"<td class='num' style='color:#64748b;font-size:12px'>"+naFmt(p.handled_tickets)+"</td>"
+"<td class='num' style='color:#64748b;font-size:12px'>"+naFmt(p.cc_scope_tickets||0)+"</td>"
+"<td class='num' style='color:#64748b;font-size:12px'>"+(p.eff_aht_weighted||0)+"</td>"
+"<td class='num' style='color:#64748b;font-size:12px'>"+fmtTime(pMins)+"</td>"
+"<td class='num' style='color:#64748b;font-size:12px'>–</td>"
+"<td class='num' style='color:#64748b;font-size:12px'>–</td>"
+"</tr>";
}).join("");
return "<tr class='na-row' style='cursor:pointer' data-drill='"+drillId+"'>"
+"<td><div class='na-name'>"+naEsc(a.agent_name)+" <span class='na-expand' style='font-size:10px;color:#94a3b8'>▶</span></div></td>"
+"<td class='num'><div class='na-bar-wrap'><span>"+naFmt(a.handled_tickets)+"</span>"
+"<span class='na-bar-track'><span class='na-bar' style='width:"+w+"px;display:block'></span></span></div></td>"
+"<td class='num'>"+naFmt(a.cc_scope_tickets)+"</td>"
+"<td class='num'>"+ahtTxt+"</td>"
+"<td class='num'>"+fmtTime(totalMins)+"</td>"
+"<td class='num' style='"+fcrStyle+"'>"+fcrTxt+"</td>"
+"<td class='num'>"+repTxt+"</td>"
+"</tr>"
+"<tbody id='"+drillId+"' style='display:none'>"+poolRows+"</tbody>";
}).join("");
var totalTimeMins = agents.reduce(function(s,a){return s+(a.avg_handle_minutes||0)*a.cc_scope_tickets;},0);
var totalFcr = agents.reduce(function(s,a){ var f=fcrMap[norm(a.agent_name)]; return s+(f?Number(f.fcr):0); },0);
var totalTicketsMeta = agents.reduce(function(s,a){ var f=fcrMap[norm(a.agent_name)]; return s+(f?Number(f.tickets):0); },0);
var teamFcrPct = totalTicketsMeta>0 ? Math.round(100*totalFcr/totalTicketsMeta*10)/10 : null;
body.innerHTML = "<table>"
+"<thead><tr><th>Agent</th><th class='num'>Handled</th><th class='num'>CC-scope</th><th class='num'>AHT (min)</th><th class='num'>Total Time</th><th class='num' title='Tickets resolved in single touch (reply_count = 1)'>FCR %</th><th class='num' title='Average replies per ticket — lower is better'>Avg Replies</th></tr></thead>"
+"<tbody>"+rows+"</tbody>"
+"<tfoot><tr><td>Total ("+agents.length+" agents)</td><td class='num'>"+naFmt(data.total_handled||0)+"</td><td class='num'>"+naFmt(agents.reduce(function(s,a){return s+a.cc_scope_tickets;},0))+"</td><td class='num'></td><td class='num'>"+fmtTime(totalTimeMins)+"</td><td class='num' style='"+(teamFcrPct!==null?fcrColor(teamFcrPct):'')+"'>"+(teamFcrPct!==null?teamFcrPct+'%':'–')+"</td><td class='num'></td></tr></tfoot>"
+"</table>"
+"<p style='font-size:11px;color:#94a3b8;margin:6px 0 0'>* AHT = pool-weighted estimate (Freshdesk time tracking not enabled). FCR = single-touch resolution rate.</p>";
}catch(e){
if(body) body.innerHTML = '<div class="na-error">Could not load agent data: ' + naEsc(e.message) + '</div>';
}
}
// Drill-down click delegation
document.addEventListener("click", function(e){
  var row = e.target.closest("[data-drill]");
  if(!row) return;
  var id = row.getAttribute("data-drill");
  var d = document.getElementById(id);
  var exp = row.querySelector(".na-expand");
  if(d){ d.style.display = d.style.display==='none' ? 'contents' : 'none'; }
  if(exp){ exp.textContent = (d && d.style.display!=='none') ? '▼' : '▶'; }
});

window.renderNamedAgents = renderNamedAgents;

// ============================================================
// AGENT TREND MODULE
// ============================================================
async function loadAgentTrend(containerEl){
  if(!containerEl) return;
  containerEl.innerHTML = '<div style="color:#64748b;font-size:13px;padding:16px">Loading trend data…</div>';
  try{
    var now = new Date();
    var months = [];
    for(var i=5; i>=0; i--){
      var d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      months.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));
    }
    var ACTIVE_ROSTER = ["Tobias Carneteg","Therese Nordtvedt","Ketil Olsen","Kari Engeb\u00e5ten","Martin Apiwat Eriksson","Arkadiusz Zawodnik","Mats Larsen","Ilse Larsson","Ian Masite","Honya Mohammed","Hege Anita Aarnesen","Johanna Martinsson","Jimmy Skille"];
    var norm=function(s){return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();};
    var results = await Promise.all(months.map(function(m){
      var url = new URL("https://psyelfxaehmtnfdaobyi.supabase.co/functions/v1/cc-dashboard-api/agent-breakdown");
      url.searchParams.set("month", m);
      return fetch(url).then(r=>r.ok?r.json():{agents:[]})
        .then(function(d){
          var agMap = {};
          (d.agents||[]).filter(function(a){
            return ACTIVE_ROSTER.some(function(r){return norm(r)===norm(a.agent_name);});
          }).forEach(function(a){ agMap[norm(a.agent_name)] = a; });
          return {month:m, agents:agMap};
        });
    }));
    var agentNames = Object.keys(results.reduce(function(acc, r){
      Object.keys(r.agents).forEach(function(k){acc[k]=1;}); return acc;
    }, {}));
    if(!agentNames.length){
      containerEl.innerHTML='<div style="color:#94a3b8;font-size:13px;padding:16px">No trend data available.</div>';
      return;
    }
    var html = '<div style="margin-top:28px">'
      +'<div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:8px">AHT Trend (6 months)</div>'
      +'<div style="font-size:11px;color:#94a3b8;margin-bottom:12px">Pool-estimated AHT per agent per month. Green/red cell = below/above team average for that month.</div>'
      +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:600px">'
      +'<thead><tr style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #f1f5f9">'
      +'<th style="text-align:left;padding:7px 10px">Agent</th>'
      +months.map(function(m){ return '<th style="text-align:center;padding:7px 8px">'+m.slice(5)+'</th>'; }).join('')
      +'<th style="text-align:right;padding:7px 10px">6m Trend</th>'
      +'</tr></thead><tbody>';
    agentNames.forEach(function(agKey){
      var ahtValues = months.map(function(m,i){
        var a = results[i].agents[agKey];
        return a ? Number(a.avg_handle_minutes||0) : null;
      });
      var defined = ahtValues.filter(function(v){return v!==null && v>0;});
      if(!defined.length) return;
      var latest = defined[defined.length-1];
      var first = defined[0];
      var trendDiff = latest - first;
      var trendColor = trendDiff <= -1 ? '#22c55e' : trendDiff >= 1 ? '#ef4444' : '#94a3b8';
      var trendTxt = (trendDiff > 0 ? '+' : '') + trendDiff.toFixed(1) + ' min';
      var realName = '';
      results.forEach(function(r){if(r.agents[agKey])realName=r.agents[agKey].agent_name;});
      var teamAvgs = months.map(function(m,i){
        var vals = Object.values(results[i].agents).map(function(a){return Number(a.avg_handle_minutes||0);}).filter(function(v){return v>0;});
        return vals.length ? vals.reduce(function(s,v){return s+v;},0)/vals.length : 0;
      });
      html += '<tr style="border-top:1px solid #f1f5f9">'
        +'<td style="padding:8px 10px;font-size:12px;color:#334155;white-space:nowrap">'+naEsc(realName.split(' ').slice(0,2).join(' '))+'</td>'
        +ahtValues.map(function(v, i){
          var avg = teamAvgs[i];
          var bg = v === null ? '#f8fafc' : v > avg*1.15 ? '#fff5f5' : v < avg*0.85 ? '#f0fdf4' : '#fff';
          var txt = v !== null && v > 0 ? naFmt(v) : '\u2013';
          return '<td style="text-align:center;padding:8px;font-size:12px;color:#475569;background:'+bg+'">'+txt+'</td>';
        }).join('')
        +'<td style="text-align:right;padding:8px 10px;font-size:12px;font-weight:600;color:'+trendColor+'">'+trendTxt+'</td>'
        +'</tr>';
    });
    html += '</tbody></table></div></div>';
    containerEl.innerHTML = html;
  }catch(e){
    containerEl.innerHTML='<div style="color:#fca5a5;font-size:13px;padding:16px">Error loading trend: '+naEsc(e.message)+'</div>';
  }
}

window.loadAgentTrend = loadAgentTrend;


function naInit(){
var monthSel = document.getElementById("na-month");
var poolSel = document.getElementById("na-pool");
if(!monthSel || !poolSel) return;
naBuildMonths(monthSel);
// Wire to existing ag-filter-period if present
var agPeriod = document.getElementById("ag-filter-period");
if(agPeriod){
var syncMonth = function(){ monthSel.value = agPeriod.value.substring(0,7); renderNamedAgents(monthSel.value, poolSel.value); };
agPeriod.addEventListener("change", syncMonth);
monthSel.value = agPeriod.value ? agPeriod.value.substring(0,7) : monthSel.value;
} else {
monthSel.addEventListener("change", function(){ renderNamedAgents(monthSel.value, poolSel.value); });
}
poolSel.addEventListener("change", function(){ renderNamedAgents(monthSel.value, poolSel.value); });
renderNamedAgents(monthSel.value, poolSel.value);

// Load 6-month AHT trend
var trendEl = document.getElementById("na-trend");
if(trendEl) loadAgentTrend(trendEl);
}


// ============================================================
// CSAT MODULE — Historical CSAT per agent & CC-group
// Reads from cc_csat_history via Supabase REST (anon, public)
// ============================================================
var _CSAT_API = "https://psyelfxaehmtnfdaobyi.supabase.co/rest/v1/cc_csat_history";
var _CSAT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzeWVsZnhhZWhtdG5mZGFvYnlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTM2NzksImV4cCI6MjA5NjU4OTY3OX0.Nenlc-8pab7hfLtkRDovXy5dVU-oDSNE01STdV-WbJ8";
var _csatCache = {};

async function csatFetch(params) {
  var key = JSON.stringify(params);
  if (_csatCache[key] && Date.now() - _csatCache[key].t < 60000) return _csatCache[key].d;
  var url = new URL(_CSAT_API);
  url.searchParams.set('select', '*');
  url.searchParams.set('order', 'year_month.asc');
  if (params.pool_slug) url.searchParams.set('pool_slug', 'eq.' + params.pool_slug);
  if (params.agent_id)  url.searchParams.set('agent_id',  'eq.' + params.agent_id);
  if (params.from_month) url.searchParams.set('year_month', 'gte.' + params.from_month);
  var res = await fetch(url.toString(), {
    headers: { 'apikey': _CSAT_KEY, 'Authorization': 'Bearer ' + _CSAT_KEY }
  });
  if (!res.ok) throw new Error('CSAT API ' + res.status);
  var data = await res.json();
  _csatCache[key] = { d: data, t: Date.now() };
  return data;
}

function csatScoreColor(score) {
  if (!score) return '#94a3b8';
  if (score >= 4.5) return '#16a34a';
  if (score >= 4.0) return '#4f46e5';
  if (score >= 3.5) return '#d97706';
  return '#ef4444';
}
function csatPctColor(pct) {
  if (!pct) return '#94a3b8';
  if (pct >= 90) return '#16a34a';
  if (pct >= 80) return '#4f46e5';
  if (pct >= 70) return '#d97706';
  return '#ef4444';
}
function csatTrend(rows) {
  if (rows.length < 2) return '';
  var last  = parseFloat(rows[rows.length-1].csat_score) || 0;
  var prev  = parseFloat(rows[rows.length-2].csat_score) || 0;
  var delta = last - prev;
  if (Math.abs(delta) < 0.02) return '<span style="color:#94a3b8">→</span>';
  return delta > 0
    ? '<span style="color:#16a34a">▲ +' + delta.toFixed(2) + '</span>'
    : '<span style="color:#ef4444">▼ ' + delta.toFixed(2) + '</span>';
}

// Build sparkline of CSAT trend
function csatSparkline(rows, width) {
  width = width || 120;
  if (!rows.length) return '';
  var scores = rows.map(r => parseFloat(r.csat_score) || 0);
  var min = Math.min(...scores) - 0.1;
  var max = Math.max(...scores) + 0.1;
  var range = max - min || 1;
  var pts = scores.map((s, i) => {
    var x = Math.round((i / Math.max(scores.length - 1, 1)) * (width - 4)) + 2;
    var y = Math.round(20 - ((s - min) / range) * 16);
    return x + ',' + y;
  }).join(' ');
  var lastColor = csatScoreColor(scores[scores.length - 1]);
  return '<svg width="' + width + '" height="22" style="vertical-align:middle">'
    + '<polyline points="' + pts + '" fill="none" stroke="' + lastColor + '" stroke-width="1.5" stroke-linejoin="round"/>'
    + '</svg>';
}

async function renderCsatSection() {
  var el = document.getElementById('csat-section');
  if (!el) return;

  var monthSel = document.getElementById('csat-month-filter');
  var viewSel  = document.getElementById('csat-view-filter');
  var selectedMonth = monthSel ? monthSel.value : '';
  var view = viewSel ? viewSel.value : 'group';

  el.innerHTML = '<div style="color:#64748b;font-size:12px;padding:20px;">Loading CSAT data…</div>';

  try {
    // Always load CC-total group history
    var groupRows = await csatFetch({ pool_slug: 'cc_total' });
    // Pool-level rows for current month
    var poolRows = selectedMonth ? await csatFetch({ from_month: selectedMonth }) : [];
    poolRows = poolRows.filter(r => r.pool_slug !== 'cc_total');

    // Current month totals for KPI bar
    var curGroup = groupRows.filter(r => !selectedMonth || r.year_month === selectedMonth);
    var latestGroup = selectedMonth ? (groupRows.find(function(r){return r.year_month===selectedMonth;}) || groupRows[groupRows.length-1] || {}) : (groupRows[groupRows.length-1] || {});

    // ── KPI bar ──
    var kpiHtml = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">';
    var score = parseFloat(latestGroup.csat_score) || 0;
    var pct   = parseFloat(latestGroup.positive_pct) || 0;
    var resp  = latestGroup.responses || 0;
    var ratedPct = latestGroup.total_tickets > 0 ? Math.round(latestGroup.rated_tickets / latestGroup.total_tickets * 100) : 0;
    var sColor = csatScoreColor(score);
    var pColor = csatPctColor(pct);
    kpiHtml += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;box-shadow:0 2px 6px rgba(0,0,0,.05)">'
      + '<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">CSAT Score (CC)</div>'
      + '<div style="font-size:28px;font-weight:800;color:' + sColor + ';line-height:1">' + (score ? score.toFixed(2) : '—') + '</div>'
      + '<div style="font-size:11px;color:#94a3b8;margin-top:4px">avg 1–5 · ' + (selectedMonth||'latest') + ' ' + csatTrend(groupRows) + '</div>'
      + '</div>';
    kpiHtml += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;box-shadow:0 2px 6px rgba(0,0,0,.05)">'
      + '<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Satisfied (≥4/5)</div>'
      + '<div style="font-size:28px;font-weight:800;color:' + pColor + ';line-height:1">' + (pct ? pct.toFixed(0) + '%' : '—') + '</div>'
      + '<div style="font-size:11px;color:#94a3b8;margin-top:4px">share of responses</div>'
      + '</div>';
    kpiHtml += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;box-shadow:0 2px 6px rgba(0,0,0,.05)">'
      + '<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Responses</div>'
      + '<div style="font-size:28px;font-weight:800;color:#1e293b;line-height:1">' + resp + '</div>'
      + '<div style="font-size:11px;color:#94a3b8;margin-top:4px">rated tickets</div>'
      + '</div>';
    kpiHtml += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;box-shadow:0 2px 6px rgba(0,0,0,.05)">'
      + '<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Response rate</div>'
      + '<div style="font-size:28px;font-weight:800;color:#1e293b;line-height:1">' + (ratedPct ? ratedPct + '%' : '—') + '</div>'
      + '<div style="font-size:11px;color:#94a3b8;margin-top:4px">of total tickets</div>'
      + '</div>';
    kpiHtml += '</div>';

    // ── Historical trend table (CC-total) ──
    var trendHtml = '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:18px 20px;margin-bottom:16px;box-shadow:0 2px 6px rgba(0,0,0,.05)">'
      + '<div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:14px;display:flex;align-items:center;gap:8px">'
      + 'CC Total — Monthly CSAT history'
      + '<span style="font-size:10px;font-weight:600;background:#ede9fe;color:#4f46e5;padding:2px 7px;border-radius:10px">' + groupRows.length + ' months</span>'
      + csatSparkline(groupRows, 160)
      + '</div>'
      + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
      + '<thead><tr>'
      + '<th style="background:#f8fafc;padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0">Month</th>'
      + '<th style="background:#f8fafc;padding:8px 10px;text-align:right;font-size:11px;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0">Score</th>'
      + '<th style="background:#f8fafc;padding:8px 10px;text-align:right;font-size:11px;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0">Satisfied</th>'
      + '<th style="background:#f8fafc;padding:8px 10px;text-align:right;font-size:11px;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0">Responses</th>'
      + '<th style="background:#f8fafc;padding:8px 10px;text-align:right;font-size:11px;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0">Total tickets</th>'
      + '<th style="background:#f8fafc;padding:8px 10px;text-align:right;font-size:11px;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0">Resp. rate</th>'
      + '</tr></thead><tbody>';

    var revRows = [...groupRows].reverse();
    revRows.forEach(function(r) {
      var sc = parseFloat(r.csat_score) || 0;
      var pp = parseFloat(r.positive_pct) || 0;
      var respRate = r.total_tickets > 0 ? Math.round((r.rated_tickets || r.responses) / r.total_tickets * 100) : 0;
      var isSelected = r.year_month === selectedMonth;
      trendHtml += '<tr style="border-bottom:1px solid #f1f5f9;' + (isSelected ? 'background:#ede9fe;' : '') + '">'
        + '<td style="padding:8px 10px;font-weight:' + (isSelected ? '700' : '500') + '">' + r.year_month + '</td>'
        + '<td style="padding:8px 10px;text-align:right;font-weight:700;color:' + csatScoreColor(sc) + '">' + (sc ? sc.toFixed(2) : '—') + '</td>'
        + '<td style="padding:8px 10px;text-align:right;color:' + csatPctColor(pp) + '">' + (pp ? pp.toFixed(0) + '%' : '—') + '</td>'
        + '<td style="padding:8px 10px;text-align:right">' + (r.responses || 0) + '</td>'
        + '<td style="padding:8px 10px;text-align:right">' + (r.total_tickets || 0) + '</td>'
        + '<td style="padding:8px 10px;text-align:right;color:#64748b">' + (respRate ? respRate + '%' : '—') + '</td>'
        + '</tr>';
    });
    trendHtml += '</tbody></table></div></div>';

    // ── Pool breakdown for selected month ──
    var poolHtml = '';
    if (poolRows.length > 0) {
      var POOL_COLORS = { switchboard:'#1f6f8b', classic:'#4338ca', s1:'#16a34a', frankly:'#b45309', talent:'#9333ea' };
      var POOL_NAMES  = { switchboard:'Switchboard', classic:'Classic', s1:'S1', frankly:'Frankly', talent:'Talent' };
      poolHtml = '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:18px 20px;margin-bottom:16px;box-shadow:0 2px 6px rgba(0,0,0,.05)">'
        + '<div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:14px">By pool — ' + (selectedMonth || 'latest') + '</div>'
        + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px">';
      poolRows.filter(r => r.year_month === (selectedMonth || poolRows[poolRows.length-1].year_month)).forEach(function(r) {
        var sc = parseFloat(r.csat_score) || 0;
        var pp = parseFloat(r.positive_pct) || 0;
        var color = POOL_COLORS[r.pool_slug] || '#64748b';
        var name  = POOL_NAMES[r.pool_slug] || r.pool_slug;
        poolHtml += '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:3px solid ' + color + ';border-radius:8px;padding:12px 14px">'
          + '<div style="font-size:11px;font-weight:700;color:' + color + ';margin-bottom:8px">' + name + '</div>'
          + '<div style="font-size:22px;font-weight:800;color:' + csatScoreColor(sc) + ';line-height:1;margin-bottom:4px">' + (sc ? sc.toFixed(2) : '—') + '</div>'
          + '<div style="font-size:11px;color:' + csatPctColor(pp) + ';margin-bottom:4px">' + (pp ? pp.toFixed(0) + '% satisfied' : '') + '</div>'
          + '<div style="font-size:10px;color:#94a3b8">' + (r.responses || 0) + ' responses / ' + (r.total_tickets || 0) + ' tickets</div>'
          + '</div>';
      });
      poolHtml += '</div></div>';
    }

    // ── Note about agent-level ──
    var agentNote = '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;font-size:11px;color:#64748b;line-height:1.6">'
      + '<strong>i Agent-level CSAT:</strong> When Freshdesk CSAT ratings include responder data, individual agent scores will appear here automatically. '
      + 'Currently showing group and pool-level data. Source: <code>cc_csat_history</code> · updated manually or via Freshdesk webhook.'
      + '</div>';

    el.innerHTML = kpiHtml + trendHtml + poolHtml + agentNote;

  } catch(e) {
    el.innerHTML = '<div style="background:#fff1f2;border:1px solid #fecaca;border-radius:8px;padding:16px;color:#dc2626;font-size:12px">CSAT data could not be loaded: ' + e.message + '</div>';
  }
}

function csatBuildMonths(sel) {
  var now = new Date(); var opts = ['<option value="">All months</option>'];
  for (var i = 0; i < 12; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    var label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    opts.push('<option value="' + ym + '">' + label + '</option>');
  }
  sel.innerHTML = opts.join('');
}

function csatInit() {
  var monthSel = document.getElementById('csat-month-filter');
  if (!monthSel) return;
  csatBuildMonths(monthSel);
  // Default to current month
  var now = new Date();
  var curYM = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  monthSel.value = curYM;
  monthSel.addEventListener('change', renderCsatSection);
  renderCsatSection();
}

window.csatInit = csatInit;
window.renderCsatSection = renderCsatSection;

export { naInit, renderNamedAgents, csatInit };
// CSAT month-filter fix
