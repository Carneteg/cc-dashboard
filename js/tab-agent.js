// js/tab-agent.js  --  Agent tab + Individual agent level module
// Migrated from index.html inline scripts (AGENT TAB v26 + INDIVIDUAL AGENT LEVEL v27)
// Functions assigned to window for HTML onclick compatibility

// ---- Runtime dependencies: api() helper + Swedish calendar ----
var _agApiBase = "https://psyelfxaehmtnfdaobyi.supabase.co/functions/v1/cc-dashboard-api";
var _agAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzeWVsZnhhZWhtdG5mZGFvYnlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4NTI5MDQsImV4cCI6MjA2NDQyODkwNH0.I1oHCVFQLCkBKhtBi4dHpiyf2DUWcRSnF7fNQqpEFdQ";
var _agApiCache = {};
function api(p){
  if(_agApiCache[p] && Date.now()-_agApiCache[p].t < 30000) return Promise.resolve(_agApiCache[p].d);
  return fetch(_agApiBase+p,{headers:{'apikey':_agAnonKey,'Authorization':'Bearer '+_agAnonKey}}).then(r=>r.json()).then(function(d){_agApiCache[p]={d:d,t:Date.now()};return d;});
}
function swedishHolidays(yr){
var s=new Set();
function add(m,d){s.add(yr+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'));}
// Fixed holidays
add(1,1);add(1,6);add(5,1);add(6,6);add(12,24);add(12,25);add(12,26);add(12,31);
// Easter-based (Gauss algorithm)
var a=yr%19,b=Math.floor(yr/100),c=yr%100;
var d2=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
var h=(19*a+b-d2-g+15)%30,i=Math.floor(c/4),k=c%4;
var l=(32+2*e+2*i-h-k)%7,m2=Math.floor((a+11*h+22*l)/451);
var month=Math.floor((h+l-7*m2+114)/31),day=((h+l-7*m2+114)%31)+1;
var easter=new Date(yr,month-1,day);
function addEaster(offset){var d3=new Date(easter);d3.setDate(d3.getDate()+offset);add(d3.getMonth()+1,d3.getDate());}
addEaster(-2);addEaster(0);addEaster(1);addEaster(39);addEaster(49);addEaster(50);
// Midsommar (Friday between Jun 19-25)
var ms=new Date(yr,5,19);while(ms.getDay()!==5)ms.setDate(ms.getDate()+1);add(ms.getMonth()+1,ms.getDate());
// Alla helgons dag (Saturday Oct 31 - Nov 6)
var ah=new Date(yr,9,31);while(ah.getDay()!==6)ah.setDate(ah.getDate()+1);add(ah.getMonth()+1,ah.getDate());
return s;
}
function swedishWorkingDays(yr,mo){
var h=swedishHolidays(yr),cnt=0,d=new Date(yr,mo-1,1);
while(d.getMonth()===mo-1){var dw=d.getDay();if(dw!==0&&dw!==6){var ds=yr+'-'+String(mo).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');if(!h.has(ds))cnt++;}d.setDate(d.getDate()+1);}
return cnt;
}

// ========================================
// AGENT TAB v26 - Riktig data fran API
// ========================================
var _agentTabData = null;
var _agentDailyData = null;

async function loadAgentTab() {
  window._agentL = true;
  var periodSel = document.getElementById('ag-filter-period');
  var ym = periodSel ? periodSel.value : '2026-05';
  var tsEl = document.getElementById('ag-updated-ts');
  if (tsEl) tsEl.textContent = 'Uppdaterat ' + new Date().toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'}) + ' - Visar: ' + ym;
  var tbody = document.getElementById('ag-team-table-body');
  if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:#7a8799;">Laddar data...</td></tr>';
  try {
    var ahtData = await api('/aht-stats?months=4');
    var months = ahtData.months || [];
    var selectedMonth = months.find(function(m){return m.year_month===ym;});
    if (!selectedMonth && months.length > 0) selectedMonth = months[months.length-1];
    _agentTabData = selectedMonth;
    window._agProductData = null;
    await loadAgentDailyDataFunc(ym);
    renderAgentKPIs(selectedMonth, ym);
    renderAgentTable();
    renderAgentAbsenceDetail(ym);
  } catch(e) {
    var tbody2 = document.getElementById('ag-team-table-body');
    if (tbody2) tbody2.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:#ef4444;">Fel vid laddning: '+(e.message||e)+'</td></tr>';
    console.error('loadAgentTab error:', e);
  }
}

async function loadAgentDailyDataFunc(ym) {
  try {
    var wfData = await api('/workforce?months=3');
    if (wfData && wfData.daily && wfData.daily.length > 0) {
      var ym7 = ym.substring(0,7);
      _agentDailyData = (wfData.daily||[]).filter(function(d){return d.stat_date&&d.stat_date.substring(0,7)===ym7;});
      return;
    }
    var trendData = await api('/trend');
    if (trendData && trendData.trend && trendData.trend.length > 0) {
      var ym7b = ym.substring(0,7);
      _agentDailyData = (trendData.trend||[])
        .filter(function(d){return d.day&&d.day.substring(0,7)===ym7b;})
        .map(function(d){return {stat_date:d.day,ticket_count:d.tickets,pool_slug:null};});
      return;
    }
    _agentDailyData = null;
  } catch(e) { _agentDailyData = null; }
}
function detectAbsenceDaysForPool(poolSlug) {
  if (!_agentDailyData) return {absenceDays:0,activeDays:0,totalWorkdays:0};
  var poolData = _agentDailyData.filter(function(d){return d.pool_slug===poolSlug;});
  var totalWorkdays=0, activeDays=0, absenceDays=0, absenceDates=[];
  poolData.forEach(function(d){
    if (!d.stat_date) return;
    var dt = new Date(d.stat_date+'T12:00:00');
    var dow = dt.getDay();
    if (dow===0||dow===6) return;
    totalWorkdays++;
    if ((d.ticket_count||0) > 0) { activeDays++; }
    else { absenceDays++; absenceDates.push(d.stat_date); }
  });
  return {absenceDays:absenceDays, activeDays:activeDays, totalWorkdays:totalWorkdays, absenceDates:absenceDates};
}

function renderAgentKPIs(monthData, ym) {
  if (!monthData) return;
  var pools = monthData.pools||[];
  var totalTickets = pools.reduce(function(s,p){return s+(p.raw_tickets||0);},0);
  var totalFteReq = pools.reduce(function(s,p){return s+(p.filtered_fte||0);},0);
  var totalFteSupply = pools.reduce(function(s,p){return s+(p.fte_supply||0);},0);
  var totalGap = totalFteSupply - totalFteReq;
  var activePools = pools.filter(function(p){return p.raw_tickets>0;});
  var avgAHT = activePools.length>0 ? activePools.reduce(function(s,p){return s+(p.effective_aht||0);},0)/activePools.length : 0;
  var kpiGrid = document.getElementById('ag-kpi-grid');
  if (!kpiGrid) return;
  kpiGrid.innerHTML = [
    '<div class="ag-kpi-card"><div class="ag-kpi-label">Aktiva pooler</div><div class="ag-kpi-value">'+activePools.length+'</div><div class="ag-kpi-sub">'+ym+'</div></div>',
    '<div class="ag-kpi-card"><div class="ag-kpi-label">Totala tickets</div><div class="ag-kpi-value">'+totalTickets.toLocaleString('sv-SE')+'</div><div class="ag-kpi-sub">Raa ticket-events</div></div>',
    '<div class="ag-kpi-card" style="border-color:#bfdbfe;"><div class="ag-kpi-label">FTE-krav (analys)</div><div class="ag-kpi-value" style="color:#1f6f8b;">'+totalFteReq.toFixed(2)+'</div><div class="ag-kpi-sub">Beraknat fran AHT</div></div>',
    '<div class="ag-kpi-card"><div class="ag-kpi-label">FTE-tillgang</div><div class="ag-kpi-value">'+totalFteSupply.toFixed(2)+'</div><div class="ag-kpi-sub">Konfigurerad supply</div></div>',
    '<div class="ag-kpi-card '+(totalGap<-0.5?'ag-kpi-card--warn':'')+'"><div class="ag-kpi-label">Gap FTE</div><div class="ag-kpi-value" style="color:'+(totalGap>=0?'#16a34a':'#b45309')+'">'+(totalGap>=0?'+':'')+totalGap.toFixed(2)+'</div><div class="ag-kpi-sub">Supply minus Krav</div></div>',
    '<div class="ag-kpi-card"><div class="ag-kpi-label">Snitt AHT</div><div class="ag-kpi-value">'+avgAHT.toFixed(1)+' min</div><div class="ag-kpi-sub">Medel per pool</div></div>'
  ].join('');
}

function renderAgentTable() {
  if (!_agentTabData) return;
  var pools = _agentTabData.pools||[];
  var teamFilter = (document.getElementById('ag-filter-team')||{value:''}).value;
  if (teamFilter) pools = pools.filter(function(p){return p.pool===teamFilter;});
  var POOL_COLORS = {switchboard:'#1f6f8b',classic:'#4338ca',s1:'#16a34a',frankly:'#b45309',talent:'#9333ea'};
  var hasMissingDays = false;
  var rows = pools.map(function(p) {
    var absInfo = detectAbsenceDaysForPool(p.pool);
    var workdays = p.working_days||0;
    var absenceRate = absInfo.totalWorkdays>0 ? absInfo.absenceDays/absInfo.totalWorkdays : 0;
    var adjustedFteSupply = p.fte_supply*(1-absenceRate);
    var adjustedGap = adjustedFteSupply - p.filtered_fte;
    if (absInfo.absenceDays>0) hasMissingDays = true;
    var gapColor = p.gap>=0?'#16a34a':'#b45309';
    var adjGapColor = adjustedGap>=0?'#16a34a':'#b45309';
    var covOk = (p.coverage_pct||0)>=80;
    var poolColor = POOL_COLORS[p.pool]||'#7a8799';
    var absDisplay = absInfo.totalWorkdays>0 ? (absInfo.absenceDays+' ('+(Math.round(absenceRate*100))+'%)') : '--';
    var adjFteDisplay = absInfo.totalWorkdays>0 ? adjustedFteSupply.toFixed(2)+' FTE' : p.fte_supply.toFixed(2)+' FTE';
    return '<tr style="border-bottom:1px solid #dde3ee;">'
      +'<td style="padding:10px 12px;"><span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:#f1f5f9;color:'+poolColor+';">'+p.pool_name+'</span></td>'
      +'<td style="padding:10px 12px;font-weight:600;">'+(p.raw_tickets||0).toLocaleString('sv-SE')+'</td>'
      +'<td style="padding:10px 12px;">'+(p.filtered_fte||0).toFixed(2)+' FTE</td>'
      +'<td style="padding:10px 12px;">'+(p.fte_supply||0).toFixed(2)+' FTE</td>'
      +'<td style="padding:10px 12px;font-weight:700;color:'+gapColor+'">'+(p.gap>=0?'+':'')+p.gap.toFixed(2)+'</td>'
      +'<td style="padding:10px 12px;">'+(p.effective_aht||0).toFixed(1)+' min</td>'
      +'<td style="padding:10px 12px;">'+workdays+'</td>'
      +'<td style="padding:10px 12px;color:'+(absInfo.absenceDays>0?'#b45309':'#16a34a')+';">'+absDisplay+'</td>'
      +'<td style="padding:10px 12px;font-weight:700;color:'+adjGapColor+';">'+adjFteDisplay+'</td>'
      +'<td style="padding:10px 12px;"><span style="padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:'+(covOk?'#dcfce7':'#fef3c7')+';color:'+(covOk?'#16a34a':'#b45309')+';">'+(p.coverage_pct||0)+'%</span></td>'
      +'</tr>';
  });
  var tbody = document.getElementById('ag-team-table-body');
  if (tbody) tbody.innerHTML = rows.length>0?rows.join(''):'<tr><td colspan="10" style="text-align:center;padding:24px;color:#64748b;">Ingen data.</td></tr>';
  var bannerEl = document.getElementById('ag-absence-banner');
  if (bannerEl) {
    if (hasMissingDays) {
      bannerEl.style.display='';
      bannerEl.innerHTML='<div style="display:flex;align-items:flex-start;gap:12px;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;"><div style="font-size:16px;">warning</div><div><div style="font-size:13px;font-weight:700;color:#b45309;">Franvaro detekterad</div><div style="font-size:12px;color:#64748b;margin-top:2px;">En eller flera pooler hade 0 tickets vissa arbetsdagar - troligen franvaro. Justerad FTE-tillgang ar korrigerad proportionellt.</div></div></div>';
    } else { bannerEl.style.display='none'; }
  }
  renderAgentIndividual();
}

function renderAgentAbsenceDetail(ym) {
  var el = document.getElementById('ag-absence-detail');
  if (!el) return;
  if (!_agentDailyData||_agentDailyData.length===0) {
    el.innerHTML='<div style="color:#64748b;font-size:12px;">Ingen daglig data tillganglig. Daglig data hamtas fran cc_daily_stats via /workforce endpoint.</div>';
    return;
  }
  var byPool={};
  _agentDailyData.forEach(function(d){
    if (!d.pool_slug) return;
    if (!byPool[d.pool_slug]) byPool[d.pool_slug]=[];
    byPool[d.pool_slug].push(d);
  });
  var POOL_COLORS={switchboard:'#1f6f8b',classic:'#4338ca',s1:'#16a34a',frankly:'#b45309',talent:'#9333ea'};
  var html='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">';
  Object.keys(byPool).forEach(function(pool){
    var days=byPool[pool];
    var activeDays=days.filter(function(d){return (d.ticket_count||0)>0;});
    var zeroDays=days.filter(function(d){return (d.ticket_count||0)===0;});
    var totalTickets=days.reduce(function(s,d){return s+(d.ticket_count||0);},0);
    var avgPerDay=activeDays.length>0?(totalTickets/activeDays.length).toFixed(1):'0';
    var color=POOL_COLORS[pool]||'#7a8799';
    var absRate=days.length>0?Math.round(zeroDays.length/days.length*100):0;
    html+='<div style="background:#ffffff;border:1px solid #dde3ee;border-radius:8px;padding:12px;border-left:3px solid '+color+';">'
      +'<div style="font-size:12px;font-weight:700;color:'+color+';margin-bottom:8px;">'+pool.toUpperCase()+'</div>'
      +'<div style="font-size:11px;display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:#64748b;">Aktiva dagar</span><span style="font-weight:600;">'+activeDays.length+'/'+days.length+'</span></div>'
      +'<div style="font-size:11px;display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:#64748b;">Nolldagar (franvaro)</span><span style="font-weight:600;color:'+(zeroDays.length>0?'#b45309':'#16a34a')+'">'+zeroDays.length+' ('+absRate+'%)</span></div>'
      +'<div style="font-size:11px;display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:#64748b;">Totala tickets</span><span style="font-weight:600;">'+totalTickets+'</span></div>'
      +'<div style="font-size:11px;display:flex;justify-content:space-between;"><span style="color:#64748b;">Snitt/aktiv dag</span><span style="font-weight:600;">'+avgPerDay+'</span></div>'
      +(zeroDays.length>0?'<div style="margin-top:6px;font-size:10px;color:#b45309;background:#fef3c7;border-radius:3px;padding:3px 6px;">Franvaro: '+zeroDays.slice(0,3).map(function(d){return d.stat_date;}).join(', ')+(zeroDays.length>3?' +'+(zeroDays.length-3)+' till':'')+'</div>':'')
      +'</div>';
  });
  html+='</div>';
  el.innerHTML=html;
  el.style.background='#f0f4f8';
  el.style.border='1px solid #dde3ee';
  el.style.borderRadius='8px';
  el.style.padding='16px';
}
function renderSparkChart() {
  const el = document.getElementById('ov-spark-chart');
  if (!el) return;
  const ptb = document.getElementById('ptb');
  if (!ptb || !ptb.children.length) { el.innerHTML = '<span style="color:#475569;font-style:italic">VÃ¤ntar pÃ¥ data...</span>'; return; }
  const rows = Array.from(ptb.querySelectorAll('tr')).filter(r => r.cells.length >= 3);
  const data = rows.map(r => ({
    name: r.cells[0] ? r.cells[0].textContent.trim() : '',
    val30: parseInt((r.cells[3] ? r.cells[3].textContent.trim() : '0').replace(/[^0-9]/g,'')) || 0
  })).filter(d => d.name && d.val30 > 0);
  const max = Math.max(...data.map(d => d.val30), 1);
  el.innerHTML = data.map(function(d) {
    const pct = Math.round(d.val30 / max * 100);
    return '<div style="display:flex;align-items:center;gap:8px;font-size:11px;">' +
      '<span style="width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#64748b;">' + d.name + '</span>' +
      '<div style="flex:1;background:#1e293b;border-radius:2px;height:12px;">' +
        '<div style="width:' + pct + '%;background:#1f6f8b;height:100%;border-radius:2px;"></div>' +
      '</div>' +
      '<span style="width:30px;text-align:right;color:#64748b;">' + d.val30 + '</span>' +
    '</div>';
  }).join('');
}

// ========================================
// INDIVIDUAL AGENT LEVEL - v27
// ========================================
var _agIndividualPeriod = 'day';
var _agIndividualPoolAgents = {
  'classic': 3, 'switchboard': 3, 's1': 2, 'frankly': 1, 'talent': 2
};

function setAgentIndividualPeriod(period, btn) {
  _agIndividualPeriod = period;
  document.querySelectorAll('.ag-ind-period-btn').forEach(function(b) {
    b.style.background='#f1f5f9';
    b.style.color='#94a3b8';
    b.style.border='1px solid #dde3ee';
  });
  if (btn) { btn.style.background = '#1f6f8b'; btn.style.color = '#fff'; btn.style.border = 'none'; }
  renderAgentIndividual();
}

function renderAgentIndividual() {
  var tbody = document.getElementById('ag-individual-tbody');
  if (!tbody || !_agentTabData) return;
  var pools = _agentTabData.pools || [];
  var ym = (document.getElementById('ag-filter-period')||{value:'2026-05'}).value;
  var ymParts = ym.split('-');
  var yr = parseInt(ymParts[0]), mo = parseInt(ymParts[1]);
  var workdaysInMonth = swedishWorkingDays(yr, mo) || 19;
  var POOL_COLORS = {switchboard:'#1f6f8b',classic:'#4338ca',s1:'#16a34a',frankly:'#b45309',talent:'#9333ea'};
  var AVAIL_MINS_DAY = 420;
  var rows = pools.map(function(p) {
    var numAgents = _agIndividualPoolAgents[p.pool] || 1;
    var totalTickets = p.raw_tickets || 0;
    var aht = parseFloat(p.effective_aht) || 0;
    var ticketsPerDayPerAgent = workdaysInMonth > 0 && numAgents > 0 ? totalTickets / workdaysInMonth / numAgents : 0;
    var handlMinsPerDayPerAgent = ticketsPerDayPerAgent * aht;
    var displayTickets;
    if (_agIndividualPeriod === 'day') displayTickets = ticketsPerDayPerAgent;
    else if (_agIndividualPeriod === 'week') displayTickets = ticketsPerDayPerAgent * 5;
    else displayTickets = ticketsPerDayPerAgent * workdaysInMonth;
    var occupancy = AVAIL_MINS_DAY > 0 ? Math.round(handlMinsPerDayPerAgent / AVAIL_MINS_DAY * 100) : 0;
    var gapMinsPerDay = AVAIL_MINS_DAY - handlMinsPerDayPerAgent;
    var occupancyColor = occupancy > 90 ? '#ef4444' : occupancy > 70 ? '#16a34a' : occupancy > 40 ? '#f59e0b' : '#64748b';
    var gapColor = gapMinsPerDay < 0 ? '#ef4444' : gapMinsPerDay < 60 ? '#f59e0b' : '#16a34a';
    var poolColor = POOL_COLORS[p.pool] || '#7a8799';
    return '<tr style="border-bottom:1px solid #dde3ee;">'
      + '<td style="padding:10px 12px;"><span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:#f1f5f9;color:'+poolColor+';">'+p.pool_name+'</span></td>'
      + '<td style="padding:10px 12px;text-align:right;font-weight:600;">'+numAgents+'</td>'
      + '<td style="padding:10px 12px;text-align:right;font-weight:700;color:'+poolColor+';">'+displayTickets.toFixed(1)+'</td>'
      + '<td style="padding:10px 12px;text-align:right;">'+aht.toFixed(1)+'</td>'
      + '<td style="padding:10px 12px;text-align:right;font-weight:600;">'+Math.round(handlMinsPerDayPerAgent)+' min</td>'
      + '<td style="padding:10px 12px;text-align:right;"><span style="padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;background:#f0f4f8;color:'+occupancyColor+';">'+occupancy+'%</span></td>'
      + '<td style="padding:10px 12px;text-align:right;font-weight:700;color:'+gapColor+';">'+Math.round(gapMinsPerDay)+' min</td>'
      + '</tr>';
  });
  tbody.innerHTML = rows.length > 0 ? rows.join('') : '<tr><td colspan="7" style="text-align:center;padding:24px;color:#64748b;">Ingen data.</td></tr>';
  renderAgentProductBreakdown();
}

function renderAgentProductBreakdown() {
  var grid = document.getElementById('ag-product-grid');
  if (!grid || !_agentTabData) return;
  var pools = _agentTabData.pools || [];
  var POOL_COLORS = {switchboard:'#1f6f8b',classic:'#4338ca',s1:'#16a34a',frankly:'#b45309',talent:'#9333ea'};
  var PROD_POOL = {
    'Simployer Classic':'classic','Simployer Classic - Handbook':'classic','All Products':'classic',
    'Expert':'classic','Expert NO':'classic','Expert SE':'classic',
    'Simployer One':'s1','Capitech':'s1','Learn':'s1',
    'Employee Survey (&frankly)':'frankly',
    'Talent':'talent','Simployer Talent':'talent','Equal Pay':'talent',
    'Invoices & Agreements':'switchboard','Invoice & billing':'switchboard'
  };
  var prodData = window._agProductData;
  if (!prodData) {
    grid.innerHTML = '<div style="color:#64748b;font-size:12px;padding:16px;">Laddar produktdata...</div>';
    api('/products').then(function(d) {
      window._agProductData = (d.products||[]).filter(function(p){return p.product!=='All Products'&&p.last_30_days>0;});
      renderAgentProductBreakdown();
    }).catch(function(){ grid.innerHTML='<div style="color:#64748b;font-size:12px;padding:16px;">Produktdata ej tillganglig.</div>'; });
    return;
  }
  var ym = (document.getElementById('ag-filter-period')||{value:'2026-05'}).value;
  var ymParts = ym.split('-');
  var workdays = swedishWorkingDays(parseInt(ymParts[0]),parseInt(ymParts[1]))||19;
  var byPool = {};
  pools.forEach(function(p){ byPool[p.pool]={pool_name:p.pool_name,aht:parseFloat(p.effective_aht)||0,products:[]}; });
  prodData.forEach(function(prod) {
    var pool = PROD_POOL[prod.product];
    if (pool && byPool[pool]) {
      byPool[pool].products.push({name:prod.product, tickets:prod.last_30_days});
    }
  });
  var poolOrder = ['switchboard','classic','s1','frankly','talent'];
  var cards = poolOrder.filter(function(k){return byPool[k];}).map(function(poolKey) {
    var pd = byPool[poolKey];
    var poolColor = POOL_COLORS[poolKey]||'#64748b';
    var numAgents = _agIndividualPoolAgents[poolKey]||1;
    var totalProdTickets = pd.products.reduce(function(s,pr){return s+pr.tickets;},0);
    var rows = pd.products.sort(function(a,b){return b.tickets-a.tickets;}).map(function(prod) {
      var pct = totalProdTickets > 0 ? Math.round(prod.tickets/totalProdTickets*100) : 0;
      var ticketsPerAgentPerDay = numAgents>0 ? prod.tickets/30/numAgents : 0;
      var handlMins = ticketsPerAgentPerDay * pd.aht;
      return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #dde3ee;">'
        +'<div style="flex:1;font-size:11px;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+prod.name+'</div>'
        +'<div style="font-size:11px;font-weight:700;color:'+poolColor+';min-width:38px;text-align:right;">'+prod.tickets+'</div>'
        +'<div style="font-size:10px;color:#64748b;min-width:30px;text-align:right;">'+pct+'%</div>'
        +'<div style="font-size:10px;color:#64748b;min-width:68px;text-align:right;white-space:nowrap;">~'+ticketsPerAgentPerDay.toFixed(1)+'/dag '+Math.round(handlMins)+'min</div>'
        +'</div>';
    }).join('');
    var totalHandlMins = numAgents>0 ? totalProdTickets/30/numAgents*pd.aht : 0;
    var totalOcc = Math.round(totalHandlMins/420*100);
    var occColor = totalOcc>90?'#ef4444':totalOcc>70?'#16a34a':totalOcc>40?'#f59e0b':'#64748b';
    return '<div style="background:#ffffff;border:1px solid #dde3ee;border-top:2px solid '+poolColor+';border-radius:8px;padding:14px;">'
      +'<div style="font-size:12px;font-weight:700;color:'+poolColor+';margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;">'
        +'<span>'+pd.pool_name+'</span>'
        +'<div style="display:flex;gap:8px;align-items:center;">'
          +'<span style="font-size:10px;color:#64748b;">AHT '+pd.aht.toFixed(1)+' min</span>'
          +'<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;background:#f0f4f8;color:'+occColor+';">'+totalOcc+'% belaggning</span>'
        +'</div>'
      +'</div>'
      +'<div style="font-size:10px;color:#64748b;margin-bottom:10px;">'+numAgents+' agent'+( numAgents>1?'er':'')+' Â· '+totalProdTickets+' tickets/30d</div>'
      +(pd.products.length>0?rows:'<div style="font-size:11px;color:#64748b;padding:8px 0;">Inga produktmatchningar funna.</div>')
    +'</div>';
  });
  grid.innerHTML = cards.length>0 ? cards.join('') : '<div style="color:#64748b;font-size:12px;padding:16px;">Ingen produktdata.</div>';
}





  const CC_API_BASE = "https://psyelfxaehmtnfdaobyi.supabase.co/functions/v1/cc-dashboard-api";
  const AE_SEG = ["--seg1","--seg2","--seg3","--seg4","--seg5","--seg6"];
  const AE_POOL_LABEL = { switchboard:"Switchboard", classic:"Classic", s1:"S1", frankly:"Frankly", talent:"Talent" };

  function aeFmt(n,d=0){ return (Math.round(n*Math.pow(10,d))/Math.pow(10,d)).toLocaleString("sv-SE",{minimumFractionDigits:d,maximumFractionDigits:d}); }
  function aePct(x){ return aeFmt(x*100,0)+" %"; }
  function aeEsc(s){ return String(s ?? "").replace(/[&<>"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[c])); }
  function aePoolName(p){ return AE_POOL_LABEL[p] || p; }

  function aeBuildMonths(sel){
    const now=new Date(), opts=[];
    for(let i=0;i<6;i++){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      const ym=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
      const l=d.toLocaleDateString("sv-SE",{month:"long",year:"numeric"});
      opts.push(`<option value="${ym}">${l.charAt(0).toUpperCase()+l.slice(1)}</option>`);
    }
    sel.innerHTML=opts.join("");
  }

  // Belastningsgrad-gauge: skala 0..max(120%, värde), markör vid mål
  function aeLoadGauge(bel, target){
    const scale = Math.max(1.2, bel) ;
    const w = Math.max(2, Math.round((bel/scale)*120));
    const mark = Math.round((target/scale)*120);
    const over = bel > target + 1e-9;
    return `<div class="ae-gauge">
      <span class="v">${aePct(bel)}</span>
      <span class="ae-track ${over?"warn":""}">
        <span class="ae-fill ${over?"over":""}" style="width:${w}px"></span>
        <span class="ae-mark" style="left:${mark}px"></span>
      </span></div>`;
  }
  // Effektivitet-gauge: skala 0..max(150%, värde), referens 100 %
  function aeEffGauge(eff){
    const scale = Math.max(1.5, eff);
    const w = Math.max(2, Math.round((eff/scale)*120));
    const mark = Math.round((1.0/scale)*120);
    const low = eff < 1 - 1e-9;
    return `<div class="ae-gauge">
      <span class="v">${aePct(eff)}</span>
      <span class="ae-track eff ${low?"low":""}">
        <span class="ae-fill eff ${low?"low":""}" style="width:${w}px"></span>
        <span class="ae-mark" style="left:${mark}px"></span>
      </span></div>`;
  }
  function aeMix(mix){
    if(!mix||!mix.length) return "";
    const segs = mix.map((p,i)=>`<span title="${aeEsc(aePoolName(p.pool))}: ${aePct(p.share)}" style="width:${(p.share*100).toFixed(2)}%;background:var(${AE_SEG[i%AE_SEG.length]})"></span>`).join("");
    const txt = mix.slice(0,3).map(p=>`${aePoolName(p.pool)} ${aePct(p.share)}`).join(" · ") + (mix.length>3?" · …":"");
    return `<div class="ae-mix">${segs}</div><div class="ae-mixtxt">${aeEsc(txt)}</div>`;
  }

  async function renderAgentEff(month, occTarget){
    const body=document.getElementById("ae-body"), meta=document.getElementById("ae-meta");
    body.innerHTML='<div class="ae-empty">Laddar…</div>';
    try{
      const url=new URL(CC_API_BASE+"/agent-efficiency");
      url.searchParams.set("month",month);
      if(occTarget) url.searchParams.set("occupancy_target",occTarget);
      const res=await fetch(url);
      if(!res.ok) throw new Error("HTTP "+res.status);
      const data=await res.json();
      const agents=data.agents||[];
      const target=data.params?.occupancy_target ?? 0.75;
      meta.textContent=`${data.agent_count} agenter · ${aeFmt(data.total_handled)} tickets · ${aeFmt((data.total_modeled_minutes||0)/60,0)} modellerade tim`;

      if(!agents.length){ body.innerHTML='<div class="ae-empty">Ingen agentdata för perioden.</div>'; return; }

      const rows=agents.map(a=>`<tr>
        <td><div class="ae-name">${aeEsc(a.agent_name)}</div><div class="ae-lvl ${a.sen_factor<1?"j":""}">${aeEsc(a.level)}${a.sen_factor<1?` · faktor ${aeFmt(a.sen_factor,1)}`:""}</div></td>
        <td class="num">${aeFmt(a.handled_tickets)}</td>
        <td class="num">${aeFmt(a.modeled_minutes/60,1)}</td>
        <td>${aeLoadGauge(a.belastningsgrad,target)}</td>
        <td>${aeEffGauge(a.effektivitet)}</td>
        <td>${aeMix(a.pool_mix)}</td>
      </tr>`).join("");

      const totHandled=data.total_handled||0, totHrs=(data.total_modeled_minutes||0)/60;
      body.innerHTML=`<table>
        <thead><tr>
          <th>Agent</th>
          <th class="num">Hanterade</th>
          <th class="num">Modellerad tid (tim)</th>
          <th class="mid">Belastningsgrad <span style="font-weight:400;text-transform:none">(mål ${aePct(target)})</span></th>
          <th class="mid">Effektivitet <span style="font-weight:400;text-transform:none">(ref 100 %)</span></th>
          <th>Tidsfördelning per pool</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td>Totalt (${agents.length} agenter)</td>
          <td class="num">${aeFmt(totHandled)}</td>
          <td class="num">${aeFmt(totHrs,1)}</td>
          <td></td><td></td><td></td>
        </tr></tfoot>
      </table>`;

      document.getElementById("ae-legend").innerHTML =
        Object.keys(AE_POOL_LABEL).map((p,i)=>`<span><i style="background:var(${AE_SEG[i%AE_SEG.length]})"></i>${AE_POOL_LABEL[p]}</span>`).join("");
    }catch(e){
      body.innerHTML='<div class="ae-error">Kunde inte ladda data: '+aeEsc(e.message)+'</div>';
    }
  }

  (function aeInit(){
    const m=document.getElementById("ae-month"), o=document.getElementById("ae-occ");
    aeBuildMonths(m);
    const go=()=>renderAgentEff(m.value,o.value);
    m.addEventListener("change",go); o.addEventListener("change",go);
    go();
  })();




// ---- expose to global scope (called from inline HTML event handlers) ----
window.loadAgentTab = loadAgentTab;
window.renderAgentTable = renderAgentTable;
window.setAgentIndividualPeriod = setAgentIndividualPeriod;

export { loadAgentTab };
