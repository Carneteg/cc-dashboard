// js/tab-wp.js  --  Workforce Planning + Classify tab module
// Migrated from index.html inline scripts
// Functions assigned to window for HTML onclick compatibility

var ticketClassificationModel = (function() {

// Step 1: Freshdesk product name â logical product (pool family)
// This maps cf_category_1 values to canonical pool identifiers
var PRODUCT_TO_POOL = {
  // Classic family
  'Simployer Classic':           'classic',
  'Simployer Classic - Handbook':'classic',
  'All Products':                'classic',  // usually Classic context

  // S1 / Simployer One family
  'Simployer One':               's1',
  'Capitech':                    's1',        // Capitech â migrated to S1 platform

  // Expert â Classic pool (Expert agents are Classic team)
  'Expert':                      'classic',
  'Expert NO':                   'classic',
  'Expert SE':                   'classic',

  // Frankly family
  'Employee Survey (&frankly)':  'frankly',

  // Talent family
  'Talent':                      'talent',
  'Simployer Talent':            'talent',
  'Equal Pay':                   'talent',    // Equal Pay is Talent product

  // Switchboard-type tickets (billing/invoice tickets routed to SB regardless of product)
  'Invoices & Agreements':       'switchboard',
  'Invoice & billing':           'switchboard',

  // Learn (ambiguous - could be S1 or Classic)
  'Learn':                       's1',         // Default: Simployer One learning module
};

// Step 2: resolveQueueGroup â EXPLICIT routing logic
// Takes product AND inferred type from product name
// Does NOT overwrite product dimension â both are preserved
function resolveQueueGroup(fresheskProduct) {
  if (!fresheskProduct) return 'unknown';

  // Direct billing/invoice types â Switchboard routing regardless of product
  var switchboardProducts = ['Invoices & Agreements', 'Invoice & billing'];
  if (switchboardProducts.indexOf(fresheskProduct) !== -1) return 'switchboard';

  // Look up in product map
  var mapped = PRODUCT_TO_POOL[fresheskProduct];
  if (mapped) return mapped;

  // Fallback: try partial match
  var lower = fresheskProduct.toLowerCase();
  if (lower.indexOf('classic') !== -1 || lower.indexOf('expert') !== -1) return 'classic';
  if (lower.indexOf('simployer one') !== -1 || lower.indexOf('s1') !== -1 || lower.indexOf('capitech') !== -1) return 's1';
  if (lower.indexOf('frankly') !== -1 || lower.indexOf('survey') !== -1) return 'frankly';
  if (lower.indexOf('talent') !== -1 || lower.indexOf('equal pay') !== -1) return 'talent';

  return 'unknown';
}

// Step 3: Infer ticket type from product name
// This preserves the ticket's nature without destroying pool identity
function inferTicketType(fresheskProduct) {
  if (!fresheskProduct) return 'Other';
  var lower = fresheskProduct.toLowerCase();
  if (lower.indexOf('invoice') !== -1 || lower.indexOf('billing') !== -1 || lower.indexOf('agreement') !== -1) return 'Invoice & billing';
  if (lower.indexOf('expert') !== -1) return 'Expert';
  if (lower.indexOf('learn') !== -1) return 'Learn';
  if (lower.indexOf('survey') !== -1 || lower.indexOf('frankly') !== -1) return 'Employee survey';
  if (lower.indexOf('talent') !== -1 || lower.indexOf('equal pay') !== -1) return 'Talent management';
  return 'General support';
}

// Pool color mapping (for UI)
var POOL_COLORS = {
  'switchboard': '#60a5fa',
  'classic':     '#818cf8',
  's1':          '#4ade80',
  'frankly':     '#fcd34d',
  'talent':      '#f97316',
  'unknown':     '#475569'
};

// Pool display config (for routing cards)
var POOL_CONFIG = [
  {
    pool: 'switchboard',
    label: 'Switchboard',
    description: 'Faktura- och avtalsÃ¤renden oavsett produkttillhÃ¶righet',
    products: ['Invoices & Agreements', 'Invoice & billing'],
    routingRule: 'type IN [Invoice & billing, Termination] â Switchboard',
    note: 'Switchboard-Ã¤renden BEHÃLLER produktidentitet (Classic/S1/etc). Routing fÃ¶rÃ¤ndrar ej produkt-dimensionen.'
  },
  {
    pool: 'classic',
    label: 'Classic',
    description: 'Simployer Classic-plattformen inkl. Expert-specialister',
    products: ['Simployer Classic', 'Simployer Classic - Handbook', 'Expert', 'Expert NO', 'Expert SE', 'All Products'],
    routingRule: 'product IN [Simployer Classic, Expert*] â Classic',
    note: 'Expert NO/SE Ã¤r specialister inom Classic-teamet, ej ett separat pool.'
  },
  {
    pool: 's1',
    label: 'S1',
    description: 'Simployer One (ny plattform) + Capitech-migrerade kunder',
    products: ['Simployer One', 'Capitech', 'Learn'],
    routingRule: 'product IN [Simployer One, Capitech] â S1',
    note: 'Capitech-kunder migreras lÃ¶pande till S1-plattformen.'
  },
  {
    pool: 'frankly',
    label: 'Frankly',
    description: 'Employee Survey (&frankly) â medarbetarundersÃ¶kningar',
    products: ['Employee Survey (&frankly)'],
    routingRule: 'product == "Employee Survey (&frankly)" â Frankly',
    note: 'Separat produktlinje med egen bemanningspool.'
  },
  {
    pool: 'talent',
    label: 'Talent',
    description: 'Talent Management + Equal Pay',
    products: ['Talent', 'Simployer Talent', 'Equal Pay'],
    routingRule: 'product IN [Talent, Equal Pay] â Talent',
    note: 'Inkluderar Equal Pay som hÃ¶r till Talent-produktfamiljen.'
  }
];

return {
  resolveQueueGroup: resolveQueueGroup,
  inferTicketType: inferTicketType,
  PRODUCT_TO_POOL: PRODUCT_TO_POOL,
  POOL_COLORS: POOL_COLORS,
  POOL_CONFIG: POOL_CONFIG
};
})();

// âââââââââââââââââââââââââââââââââââââââââââââââââââ
// LAYER 1: planningModelAdapter (Excel source of truth)
// âââââââââââââââââââââââââââââââââââââââââââââââââââ
var planningModelAdapter = (function() {
var WP = {
  actualFte: 11,
  effectiveSupplyFte: 11.05,
  requiredFte: 10.10,
  ticketFtePeak: 9.10,
  overheadFte: 1.00,
  netGapFte: 1.00,
  monthlyCostSek: 110000,
  pools: [
    { pool:'Classic',     supply:2.20, demandPeak:3.40, comfortable:2.80, gapFte:-1.20, status:'Critical', agents:3 },
    { pool:'Switchboard', supply:2.69, demandPeak:2.65, comfortable:2.20, gapFte: 0.04, status:'Tight',    agents:3 },
    { pool:'Talent',      supply:1.49, demandPeak:0.95, comfortable:0.80, gapFte: 0.54, status:'OK',       agents:2 },
    { pool:'Frankly',     supply:2.35, demandPeak:1.65, comfortable:1.40, gapFte: 0.70, status:'OK',       agents:1 },
    { pool:'S1',          supply:4.34, demandPeak:2.45, comfortable:2.00, gapFte: 1.89, status:'OK',       agents:2 }
  ],
  scenarios: [
    { name:'Now',           requiredFte:10.10, supplyFte:11.05, gapFte: 1.00, monthlyCostSek:110000, largestDeficit:'Classic -1.15' },
    { name:'Post-aug best', requiredFte: 9.80, supplyFte:11.60, gapFte: 1.80, monthlyCostSek:107000, largestDeficit:'Classic' },
    { name:'Post-aug worst',requiredFte: 9.50, supplyFte: 7.00, gapFte:-2.50, monthlyCostSek: 76000, largestDeficit:'Classic' },
    { name:'AI deflect 30%',requiredFte: 9.30, supplyFte:11.05, gapFte: 1.80, monthlyCostSek:110000, largestDeficit:'Classic' }
  ],
  migration: [
    {q:'Q0', phase:'Akut',      migrated:0,    classicRemain:4200,s1Vol:1850,classicVol:4200,s1WithoutAi:2.93,s1WithAi:2.93,recruitNeed:null,costSek:29300},
    {q:'Q1', phase:'Akut',      migrated:420,  classicRemain:3780,s1Vol:2100,classicVol:3780,s1WithoutAi:3.10,s1WithAi:2.97,recruitNeed:0.04,costSek:29700},
    {q:'Q2', phase:'Fas 1',     migrated:840,  classicRemain:3360,s1Vol:2350,classicVol:3360,s1WithoutAi:3.28,s1WithAi:3.08,recruitNeed:0.15,costSek:30800},
    {q:'Q3', phase:'Fas 1',     migrated:1260, classicRemain:2940,s1Vol:2600,classicVol:2940,s1WithoutAi:3.45,s1WithAi:3.18,recruitNeed:0.25,costSek:31800},
    {q:'Q4', phase:'Fas 2',     migrated:1680, classicRemain:2520,s1Vol:2850,classicVol:2520,s1WithoutAi:3.62,s1WithAi:3.28,recruitNeed:0.35,costSek:32800},
    {q:'Q5', phase:'Fas 2',     migrated:2100, classicRemain:2100,s1Vol:3100,classicVol:2100,s1WithoutAi:3.78,s1WithAi:3.38,recruitNeed:0.45,costSek:33800},
    {q:'Q6', phase:'Fas 2',     migrated:2520, classicRemain:1680,s1Vol:3350,classicVol:1680,s1WithoutAi:3.95,s1WithAi:3.48,recruitNeed:0.55,costSek:34800},
    {q:'Q7', phase:'Fas 3',     migrated:2940, classicRemain:1260,s1Vol:3600,classicVol:1260,s1WithoutAi:4.02,s1WithAi:3.62,recruitNeed:0.69,costSek:36200},
    {q:'Q8', phase:'Fas 3',     migrated:3360, classicRemain:840, s1Vol:3700,classicVol:840, s1WithoutAi:4.08,s1WithAi:3.74,recruitNeed:0.81,costSek:37400},
    {q:'Q9', phase:'Expansion', migrated:3780, classicRemain:420, s1Vol:3850,classicVol:420, s1WithoutAi:4.15,s1WithAi:3.90,recruitNeed:0.97,costSek:39000},
    {q:'Q10',phase:'Expansion', migrated:4200, classicRemain:0,   s1Vol:4000,classicVol:0,   s1WithoutAi:4.25,s1WithAi:4.05,recruitNeed:1.12,costSek:40500}
  ],
  sensitivity: [
    {driver:'Volym',        m20:8.08, m10:9.09, base:10.10, p10:11.11, p20:12.12, unit:'FTE'},
    {driver:'AHT',          m20:8.08, m10:9.09, base:10.10, p10:11.11, p20:12.12, unit:'FTE'},
    {driver:'Shrinkage',    m20:9.26, m10:9.67, base:10.10, p10:10.56, p20:11.04, unit:'FTE'},
    {driver:'Occupancy',    m20:10.71,m10:10.40,base:10.10, p10: 9.82, p20: 9.56, unit:'FTE'},
    {driver:'Peak Buffer',  m20:8.08, m10:9.09, base:10.10, p10:11.11, p20:12.12, unit:'FTE'},
    {driver:'AI Deflection',m20:10.10,m10:10.10,base:10.10, p10: 9.09, p20: 8.08, unit:'FTE'},
    {driver:'Arbetsdagar',  m20:9.35, m10:9.72, base:10.10, p10:10.50, p20:10.92, unit:'FTE'},
    {driver:'Kostnad/FTE',  m20:88000,m10:99000,base:110000,p10:121000,p20:132000,unit:'SEK'}
  ],
  timeline: {
    labels:   ['Nu','Post-aug best','Post-aug worst','AI deflect 30%','Migration Q5','Migration Q10'],
    actual:   [11,   null,           null,            11,              11,            12],
    supply:   [11.05,11.60,           7.00,           11.05,           11.05,         12.00],
    required: [10.10, 9.80,           9.50,            9.30,           10.50,         11.20],
    isForecast:[false,true,           true,            true,            true,          true]
  }
};
return WP;
})();
var WP = planningModelAdapter;

// âââââââââââââââââââââââââââââââââââââââââââââââââââ
// LAYER 2: dailyAnalyticsAdapter
// âââââââââââââââââââââââââââââââââââââââââââââââââââ
var dailyAnalyticsAdapter = (function() {
var _monthlyRollups = [];
var _loaded = false;
var _loading = false;
var _callbacks = [];

function buildMonthlyAnalyticsFromDaily(rawMonths) {
  return (rawMonths || []).map(function(m) {
    var pools = m.pools || [];
    var totalTickets = pools.reduce(function(s,p){return s+(p.filtered_tickets||0);},0);
    var dailyRosteredFte = pools.reduce(function(s,p){return s+(p.fte_supply||0);},0);
    var analyticsFteRequired = pools.reduce(function(s,p){return s+(p.filtered_fte||0);},0);
    var analyticsCovPct = parseFloat(m.avg_coverage_pct||0);
    return {
      year_month: m.year_month,
      totalTickets: totalTickets,
      dailyRosteredFte: dailyRosteredFte,
      analyticsFteRequired: analyticsFteRequired,
      analyticsGapFte: dailyRosteredFte - analyticsFteRequired,
      analyticsCovPct: analyticsCovPct,
      rawPools: pools,
      isAnalytics: true,
      // Flag if supply looks suspicious (all months same = static)
      supplyIsStatic: true
    };
  });
}

return {
  load: function(apiCall, cb) {
    if (_loaded){cb(null,_monthlyRollups);return;}
    _callbacks.push(cb);
    if(_loading)return;
    _loading=true;
    apiCall('/aht-stats?months=12').then(function(d){
      _monthlyRollups=buildMonthlyAnalyticsFromDaily(d.months||[]);
      // Detect if supply is static across all months
      var supplies = _monthlyRollups.map(m=>m.dailyRosteredFte.toFixed(2));
      var isStatic = supplies.every(s=>s===supplies[0]);
      _monthlyRollups.forEach(m=>{m.supplyIsStatic=isStatic;});
      _loaded=true;_loading=false;
      _callbacks.forEach(function(fn){fn(null,_monthlyRollups,d);});
      _callbacks=[];
    }).catch(function(e){
      _loading=false;
      _callbacks.forEach(function(fn){fn(e,null);});
      _callbacks=[];
    });
  },
  getMonthly: function(){return _monthlyRollups;},
  invalidate: function(){_loaded=false;},
  buildFromRaw: buildMonthlyAnalyticsFromDaily
};
})();

var dashboardViewModel = {
  getActualFte:function(){return WP.actualFte;},
  getEffectiveSupply:function(){return WP.effectiveSupplyFte;},
  getRequiredFte:function(){return WP.requiredFte;},
  getNetGap:function(){return WP.netGapFte;},
  getPools:function(){return WP.pools;},
  getScenarios:function(){return WP.scenarios;},
  getMigration:function(){return WP.migration;},
  getSensitivity:function(){return WP.sensitivity;},
  getPlanningTimeline:function(){return WP.timeline;},
  getAnalyticsMonthly:function(){return dailyAnalyticsAdapter.getMonthly;},
  getClassificationModel:function(){return ticketClassificationModel;}
};

// âââââââââââââââââââââââââââââââââââââââââââââââââââ
// CONFIG + UTILITIES
// âââââââââââââââââââââââââââââââââââââââââââââââââââ
var A='https://psyelfxaehmtnfdaobyi.supabase.co/functions/v1/cc-dashboard-api';
var K='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzeWVsZnhhZWhtdG5mZGFvYnlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4NTI5MDQsImV4cCI6MjA2NDQyODkwNH0.I1oHCVFQLCkBKhtBi4dHpiyf2DUWcRSnF7fNQqpEFdQ';
var COV_THRESHOLD=80;
var _timeGran='monthly';
var _trendWindow=12;

function h(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
const _apiCache = {};
function api(p){
  if(_apiCache[p] && Date.now()-_apiCache[p].t < 300000) return Promise.resolve(_apiCache[p].d);
  return fetch(A+p,{headers:{'apikey':K,'Authorization':'Bearer '+K}}).then(r=>r.json()).then(function(d){ _apiCache[p]={d:d,t:Date.now()}; return d; });
}
function fmtFTE(n){return(Math.round(parseFloat(n||0)*100)/100).toFixed(2);}
function gapCls(g){return g<-0.5?'crit':g<0?'under':'ok';}
function bdg(c){var m={'email':'b-email','phone':'b-phone','portal':'b-portal','chat':'b-chat'};return '<span class="badge '+(m[c]||'b-other')+'">'+h(c)+'</span>';}

function showTab(id,btn){
  document.querySelectorAll('.tc').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  btn.classList.add('active');
  if(id==='wp'&&!window._wpL)initWP();
  if(id==='workforce'&&!window._wfL)loadWorkforce();
  if(id==='aht'&&!window._ahtL)loadAHT();
  if(id==='classify'&&!window._clL)initClassifyTab();
  if(id==='prognos'&&!window._pgL)initPrognos();
  if(id==='setup'&&!window._setupL)loadSetupTab();
if(id==='agent'&&!window._agentL)loadAgentTab();

  // Auto-scroll to active tab content
  const _tabEl = document.getElementById('tab-' + id);
  if (_tabEl) { const _y = _tabEl.getBoundingClientRect().top + window.scrollY - 60; window.scrollTo({top: _y < 10 ? 0 : _y, behavior: 'smooth'}); }
}

// âââââââââââââââââââââââââââââââââââââââââââââââââââ
// SWEDISH WORKING DAYS
// âââââââââââââââââââââââââââââââââââââââââââââââââââ
function easterDate(yr){var a=yr%19,b=Math.floor(yr/100),c=yr%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),hh=Math.floor(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-hh-k)%7,m=Math.floor((a+11*hh+22*l)/451),mo=Math.floor((hh+l-7*m+114)/31),dy=((hh+l-7*m+114)%31)+1;return new Date(yr,mo-1,dy);}
function swedishHolidays(yr){var s=new Set();function add(m,d){s.add(yr+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'));}add(1,1);add(1,6);add(5,1);add(6,6);add(12,25);add(12,26);var e=easterDate(yr);function eo(n){var d=new Date(e);d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}s.add(eo(-2));s.add(eo(0));s.add(eo(1));s.add(eo(39));s.add(eo(49));var mid=new Date(yr,5,19);while(mid.getDay()!==5)mid.setDate(mid.getDate()+1);s.add(mid.getFullYear()+'-'+String(mid.getMonth()+1).padStart(2,'0')+'-'+String(mid.getDate()).padStart(2,'0'));var ah=new Date(yr,9,31);while(ah.getDay()!==6)ah.setDate(ah.getDate()+1);s.add(ah.getFullYear()+'-'+String(ah.getMonth()+1).padStart(2,'0')+'-'+String(ah.getDate()).padStart(2,'0'));return s;}
function swedishWorkingDays(yr,mo){var h=swedishHolidays(yr),cnt=0,d=new Date(yr,mo-1,1);while(d.getMonth()===mo-1){var dw=d.getDay(),ds=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');if(dw!==0&&dw!==6&&!h.has(ds))cnt++;d.setDate(d.getDate()+1);}return cnt;}
function computeFTE(tickets,ahtMin,ym){if(!tickets||!ahtMin)return 0;var p=String(ym).split('-');var wd=swedishWorkingDays(parseInt(p[0]),parseInt(p[1]));return(tickets*ahtMin)/(wd*7*60);}


var _charts={};
function destroyChart(id){if(_charts[id]){_charts[id].destroy();delete _charts[id];}}

function initWP(){
  window._wpL=true;
  renderPoolGaps();
  renderMigrationTable();
  renderSensitivityTable();
  setTimeout(function(){
    renderStaffingChart();
    renderPoolGapChart();
    renderScenarioChart();
    renderMigrationChart();
    renderSensitivityChart();
  },50);
  loadAnalyticsTrend();
loadCFOConfidence();
}

async function loadCFOConfidence(){
try{
var d=await api('/enrich-status');
var aht=await api('/aht-stats?months=12');
var enrichPct=parseFloat(d.coverage_pct||0);
var totalT=d.total_tickets||0;
var hasPoolSlug=d.enriched_tickets||0;
var classifPct=totalT>0?Math.round(hasPoolSlug/totalT*100):0;
var months=(aht.months||[]);
var monthsWithData=months.filter(m=>m.pools&&m.pools.some(p=>p.raw_tickets>0)).length;
var calcPct=Math.round(monthsWithData/12*100);
var ec=document.getElementById('conf-enrichment');
var cc=document.getElementById('conf-classification');
var wc=document.getElementById('conf-calculability');
if(ec)ec.textContent=enrichPct.toFixed(0)+'%';
if(cc)cc.textContent=classifPct+'%';
if(wc){wc.textContent=monthsWithData+'/12';wc.style.color=monthsWithData>=6?'#4ade80':monthsWithData>=3?'#fcd34d':'#fca5a5';}
if(ec)ec.style.color=enrichPct>=80?'#4ade80':enrichPct>=40?'#fcd34d':'#fca5a5';
if(cc)cc.style.color=classifPct>=80?'#4ade80':classifPct>=40?'#fcd34d':'#fca5a5';
// CFO per-pool chips
var poolConfMap={'classic':'cfo-conf-classic','switchboard':'cfo-conf-switchboard','s1':'cfo-conf-s1','frankly':'cfo-conf-frankly','talent':'cfo-conf-talent'};
var recentM=months[months.length-1];
if(recentM){recentM.pools.forEach(function(p){var el=document.getElementById(poolConfMap[p.pool]);if(el){var ok=p.coverage_pct>=80&&p.raw_tickets>0;el.innerHTML='<span style="padding:2px 6px;border-radius:3px;font-size:10px;font-weight:700;background:'+(ok?'#14532d':'#7f1d1d')+';color:'+(ok?'#4ade80':'#fca5a5')+'">'+(ok?'â':'â ')+' '+(p.coverage_pct||0)+'% cov Â· '+p.raw_tickets+' t</span>';}});}
}catch(e){console.warn('CFO conf err',e);}
}

function setTimeGran(g,btn){
  _timeGran=g;
  document.querySelectorAll('.chart-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderStaffingChart();
}
function setTrendWindow(n,btn){
  _trendWindow=n;
  document.querySelectorAll('#trendBtn12,#trendBtn6,#trendBtn3').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  var monthly=dailyAnalyticsAdapter.getMonthly();
  if(monthly&&monthly.length)renderTrendChart(monthly);
}

function renderStaffingChart(){
  destroyChart('staffing');
  var tl=planningModelAdapter.timeline;
  var ctx=document.getElementById('staffingChart').getContext('2d');
  _charts['staffing']=new Chart(ctx,{type:'line',
    data:{labels:tl.labels,datasets:[
      {label:'Actual FTE (Masterdata)',data:tl.actual,borderColor:'#818cf8',backgroundColor:'rgba(129,140,248,0.1)',borderWidth:2,pointRadius:5,spanGaps:true,borderDash:[6,3]},
      {label:'Effective Supply FTE',data:tl.supply,borderColor:'#4ade80',backgroundColor:'rgba(74,222,128,0.08)',borderWidth:2.5,pointRadius:4,fill:false},
      {label:'Required FTE',data:tl.required,borderColor:'#fcd34d',backgroundColor:'rgba(252,211,77,0.08)',borderWidth:2.5,pointRadius:4,fill:false},
      {label:'11 FTE Baseline',data:tl.labels.map(()=>11),borderColor:'#475569',borderWidth:1,borderDash:[3,6],pointRadius:0,fill:false}
    ]},
    options:{responsive:true,maintainAspectRatio:true,
      plugins:{legend:{labels:{color:'#94a3b8',font:{size:11}}},tooltip:{backgroundColor:'#ffffff',borderColor:'#dde3ee',borderWidth:1,titleColor:'#e2e8f0',bodyColor:'#94a3b8'}},
      scales:{x:{grid:{color:'#f1f5f9'},ticks:{color:'#64748b',font:{size:11}}},y:{grid:{color:'#f1f5f9'},ticks:{color:'#64748b'},suggestedMin:5,suggestedMax:14,title:{display:true,text:'FTE',color:'#475569'}}}}
  });
}

function loadAnalyticsTrend(){
  document.getElementById('trend-loading').style.display='';
  document.getElementById('trend-error').style.display='none';
  document.getElementById('trendChart').style.display='none';
  document.getElementById('trend-note').style.display='none';
  document.getElementById('trend-monthly-cards').style.display='none';
  dailyAnalyticsAdapter.load(api,function(err,monthly,rawData){
    document.getElementById('trend-loading').style.display='none';
    if(err){document.getElementById('trend-error').textContent='Kunde inte ladda: '+(err.message||err);document.getElementById('trend-error').style.display='';return;}
    if(!monthly||!monthly.length){document.getElementById('trend-error').textContent='Ingen driftdata.';document.getElementById('trend-error').style.display='';return;}
    var isStatic=monthly[0]&&monthly[0].supplyIsStatic;
    document.getElementById('trendChart').style.display='';
    document.getElementById('trend-note').style.display='';
    if(isStatic){document.getElementById('trend-note').innerHTML='â  <strong>Supply Ã¤r statisk</strong> â dailyRosteredFte identisk i alla mÃ¥nader. P4 (cc_pool_supply_history) ej exekverats. Se Klassificering-fliken.';}
    document.getElementById('trend-monthly-cards').style.display='';
    renderTrendChart(monthly);
    renderTrendMonthlyCards(monthly);
  });
}

function renderTrendChart(monthly){
  destroyChart('trend');
  var data=monthly.slice(-_trendWindow).reverse();
  if(!data.length)return;
  var isStatic=data[0]&&data[0].supplyIsStatic;
  var ctx=document.getElementById('trendChart').getContext('2d');
  _charts['trend']=new Chart(ctx,{type:'line',
    data:{labels:data.map(m=>m.year_month),datasets:[
      {label:'Analytisk FTE-estimat',data:data.map(m=>parseFloat(m.analyticsFteRequired.toFixed(2))),borderColor:'#818cf8',backgroundColor:'rgba(129,140,248,0.1)',borderWidth:2,pointRadius:4,fill:true,yAxisID:'y'},
      {label:'dailyRosteredFte'+(isStatic?' [statisk]':''),data:data.map(m=>parseFloat(m.dailyRosteredFte.toFixed(2))),borderColor:isStatic?'#f59e0b':'#4ade80',backgroundColor:'rgba(74,222,128,0.05)',borderWidth:1.5,pointRadius:3,borderDash:isStatic?[3,3]:[5,3],fill:false,yAxisID:'y'},
      {label:'Tickets (k)',data:data.map(m=>parseFloat((m.totalTickets/1000).toFixed(2))),borderColor:'#60a5fa',backgroundColor:'rgba(96,165,250,0.05)',borderWidth:1.5,pointRadius:3,borderDash:[2,4],fill:false,yAxisID:'y2'}
    ]},
    options:{responsive:true,maintainAspectRatio:true,
      plugins:{legend:{labels:{color:'#94a3b8',font:{size:11}}},tooltip:{backgroundColor:'#ffffff',borderColor:'#dde3ee',borderWidth:1,titleColor:'#e2e8f0',bodyColor:'#94a3b8',callbacks:{afterTitle:()=>'[Analys â ej officiellt planningsmatt]'}}},
      scales:{x:{grid:{color:'#f1f5f9'},ticks:{color:'#64748b',font:{size:10}}},y:{grid:{color:'#f1f5f9'},ticks:{color:'#64748b'},title:{display:true,text:'FTE (analys)',color:'#475569'},suggestedMin:0},y2:{position:'right',grid:{drawOnChartArea:false},ticks:{color:'#60a5fa'},title:{display:true,text:'Tickets (k)',color:'#60a5fa'}}}}
  });
}

function renderTrendMonthlyCards(monthly){
var data=monthly.slice(-_trendWindow).reverse();
document.getElementById('trend-cards-inner').innerHTML=data.map(function(m,i){
var gap=m.analyticsGapFte;
var gapColor=gap>=0?'#4ade80':'#fca5a5';
var covOk=m.analyticsCovPct>=COV_THRESHOLD;
var noData=m.totalTickets===0;
var sw=m.supplyIsStatic?'<div style="font-size:10px;color:#fcd34d;margin-top:4px">â  Supply statisk</div>':'';
var prev=data[i-1];
var driverHtml='';
if(!noData&&prev&&prev.totalTickets>0){
var dVol=m.totalTickets-prev.totalTickets;
var dFte=m.analyticsFteRequired-prev.analyticsFteRequired;
driverHtml='<div style="margin-top:6px;padding-top:6px;border-top:1px solid #dde3ee;font-size:10px;color:#475569">'
+'MoM: <span style="color:'+(dVol>=0?'#fca5a5':'#4ade80')+'">'+(dVol>=0?'â²':'â¼')+' volym '+(dVol>=0?'+':'')+dVol+'</span> Â· '
+'<span style="color:'+(dFte<0?'#4ade80':'#fca5a5')+'">'+(dFte>=0?'â²':'â¼')+' FTE '+(dFte>=0?'+':'')+dFte.toFixed(2)+'</span>'
+'</div>';
}
if(noData){
return '<div class="analytics-month-card" style="opacity:0.45;border-color:#dde3ee">'
+'<div class="amc-month">'+m.year_month+' <span class="layer-badge analytics" style="font-size:8px">Analys</span></div>'
+'<div style="font-size:11px;color:#475569;margin-top:8px;font-style:italic">Ingen demand-data</div>'
+'<div class="amc-row" style="margin-top:6px"><span class="amc-label">Supply</span><span class="amc-val" style="color:#f59e0b">'+m.dailyRosteredFte.toFixed(2)+' FTE</span></div>'
+'<div style="font-size:10px;color:#475569;margin-top:4px">â Gap ej berÃ¤kningsbart</div>'
+'</div>';
}
return '<div class="analytics-month-card">'
+'<div class="amc-month">'+m.year_month+' <span class="layer-badge analytics" style="font-size:8px">Analys</span></div>'
+'<div class="amc-row"><span class="amc-label">Tickets</span><span class="amc-val">'+m.totalTickets.toLocaleString('sv-SE')+'</span></div>'
+'<div class="amc-row"><span class="amc-label">FTE-estimat</span><span class="amc-val">'+m.analyticsFteRequired.toFixed(2)+'</span></div>'
+'<div class="amc-row"><span class="amc-label">Supply</span><span class="amc-val">'+m.dailyRosteredFte.toFixed(2)+'</span></div>'
+'<div class="amc-gap" style="color:'+gapColor+'">Gap: '+(gap>=0?'+':'')+gap.toFixed(2)+'</div>'
+'<div class="amc-cov '+(covOk?'ok':'warn')+'">'+m.analyticsCovPct.toFixed(0)+'% coverage</div>'
+driverHtml+sw+'</div>';
}).join('');
}

function renderPoolGaps(){
  var sorted=[...planningModelAdapter.pools].sort((a,b)=>a.gapFte-b.gapFte);
  var maxVal=Math.max(...planningModelAdapter.pools.map(p=>Math.max(p.supply,p.demandPeak)))||1;
  document.getElementById('pool-gaps').innerHTML=sorted.map(p=>{
    var cls=p.status==='Critical'?'crit':p.status==='Tight'?'warn':'ok';
    var gapCls2=p.gapFte<0?'neg':Math.abs(p.gapFte)<0.1?'zero':'pos';
    var supPct=Math.round(p.supply/maxVal*100),demPct=Math.round(p.demandPeak/maxVal*100);
    return '<div class="pool-row '+cls+'">'
      +'<div class="pool-header"><span class="pool-name">'+p.pool+'</span><span class="pool-gap-val '+gapCls2+'">'+(p.gapFte>=0?'+':'')+p.gapFte.toFixed(2)+' FTE</span></div>'
      +'<div class="pool-stats"><div class="pool-stat"><strong>'+p.supply.toFixed(2)+'</strong>Effective Supply</div><div class="pool-stat"><strong>'+p.demandPeak.toFixed(2)+'</strong>Peak Demand</div><div class="pool-stat"><strong>'+p.comfortable.toFixed(2)+'</strong>Comfortable FTE</div><div class="pool-stat"><strong>'+(p.agents||'-')+'</strong>Agents</div></div>'
      +'<div class="pool-bar-wrap"><div class="pool-bar-supply" style="width:'+supPct+'%"></div><div class="pool-bar-demand" style="width:'+demPct+'%"></div></div>'
      +'<div class="pool-bar-label"><span>Supply (gron) vs Peak Demand (bla)</span><span class="tag '+cls+'">'+(p.status==='Critical'?'Kritiskt underskott':p.status==='Tight'?'Tight':'OK')+'</span></div>'
      +'</div>';
  }).join('');
}
function renderPoolGapChart(){
  destroyChart('poolGap');
  var sorted=[...planningModelAdapter.pools].sort((a,b)=>a.gapFte-b.gapFte);
  var ctx=document.getElementById('poolGapChart').getContext('2d');
  _charts['poolGap']=new Chart(ctx,{type:'bar',
    data:{labels:sorted.map(p=>p.pool),datasets:[{label:'Gap FTE',data:sorted.map(p=>p.gapFte),
      backgroundColor:sorted.map(p=>p.gapFte<-0.1?'rgba(239,68,68,0.7)':Math.abs(p.gapFte)<0.2?'rgba(245,158,11,0.7)':'rgba(34,197,94,0.7)'),
      borderColor:sorted.map(p=>p.gapFte<-0.1?'#ef4444':Math.abs(p.gapFte)<0.2?'#f59e0b':'#22c55e'),borderWidth:1,borderRadius:4}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:true,
      plugins:{legend:{display:false},tooltip:{backgroundColor:'#ffffff',borderColor:'#dde3ee',borderWidth:1,titleColor:'#e2e8f0',bodyColor:'#94a3b8'}},
      scales:{x:{grid:{color:'#f1f5f9'},ticks:{color:'#64748b'},title:{display:true,text:'Gap FTE',color:'#475569'}},y:{grid:{color:'#f1f5f9'},ticks:{color:'#94a3b8'}}}}
  });
}
function renderScenarioChart(){
  destroyChart('scenario');
  var sc=planningModelAdapter.scenarios;
  var ctx=document.getElementById('scenarioChart').getContext('2d');
  _charts['scenario']=new Chart(ctx,{type:'bar',
    data:{labels:sc.map(s=>s.name),datasets:[
      {label:'Required FTE',data:sc.map(s=>s.requiredFte),backgroundColor:'rgba(252,211,77,0.6)',borderColor:'#fcd34d',borderWidth:1,borderRadius:3},
      {label:'Effective Supply FTE',data:sc.map(s=>s.supplyFte),backgroundColor:'rgba(74,222,128,0.6)',borderColor:'#4ade80',borderWidth:1,borderRadius:3}
    ]},
    options:{responsive:true,maintainAspectRatio:true,
      plugins:{legend:{labels:{color:'#94a3b8',font:{size:11}}},tooltip:{backgroundColor:'#ffffff',borderColor:'#dde3ee',borderWidth:1,titleColor:'#e2e8f0',bodyColor:'#94a3b8'}},
      scales:{x:{grid:{color:'#f1f5f9'},ticks:{color:'#64748b'}},y:{grid:{color:'#f1f5f9'},ticks:{color:'#64748b'},suggestedMin:4,title:{display:true,text:'FTE',color:'#475569'}}}}
  });
}

// ââ CLASSIFICATION TAB ââ
function initClassifyTab(){
  window._clL=true;
  renderRoutingRulesGrid();
  renderProductMappingTable();
  refreshClassificationData();
}

function renderRoutingRulesGrid(){
  var cfg=ticketClassificationModel.POOL_CONFIG;
  document.getElementById('routing-rules-grid').innerHTML=cfg.map(function(c){
    var col=ticketClassificationModel.POOL_COLORS[c.pool]||'#475569';
    return '<div class="classif-card '+c.pool+'">'
      +'<div class="classif-title" style="color:'+col+'">'+c.label+' Pool</div>'
      +'<div style="font-size:12px;color:#64748b;margin-bottom:8px">'+c.description+'</div>'
      +'<div style="font-size:11px;color:#64748b;margin-bottom:6px">Freshdesk-produkter som routas hit:</div>'
      +'<div class="classif-products">'+c.products.map(function(p){return '<span class="product-chip">'+p+'</span>';}).join('')+'</div>'
      +'<div class="routing-rule">'+c.routingRule+'</div>'
      +'<div class="classif-note">'+c.note+'</div>'
      +'</div>';
  }).join('');
}

function renderProductMappingTable(){
  var map=ticketClassificationModel.PRODUCT_TO_POOL;
  var last30={'All Products':188,'Simployer Classic':183,'Expert NO':117,'Simployer One':107,'Capitech':100,'Expert':71,'Expert SE':47,'Employee Survey (&frankly)':40,'Simployer Classic - Handbook':33,'Invoices & Agreements':27,'Talent':22,'Learn':20,'Equal Pay':4};
  var seen=new Set();
  var allProds=Object.keys(last30).concat(Object.keys(map)).filter(function(p){if(seen.has(p))return false;seen.add(p);return true;});
  var rows=allProds.map(function(p){
    var pool=map[p]||'unknown';
    var col=ticketClassificationModel.POOL_COLORS[pool]||'#475569';
    var count=last30[p]||0;
    var type=ticketClassificationModel.inferTicketType(p);
    return '<tr><td style="font-weight:500">'+p+'</td><td><span style="color:'+col+';font-weight:700">'+pool+'</span></td><td><span class="tag info" style="font-size:10px">'+type+'</span></td><td class="n">'+(count>0?count:'-')+'</td><td style="font-size:11px;color:#475569">'+(pool==='unknown'?'Okand mapping':'')+'</td></tr>';
  }).join('');
  document.getElementById('product-mapping-table').innerHTML=rows;
}

function hexToRgba(hex,a){var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return 'rgba('+r+','+g+','+b+','+a+')';}

async function refreshClassificationData(){
  document.getElementById('classification-loading').style.display='';
  document.getElementById('classification-error').style.display='none';
  document.getElementById('classif-summary-grid').style.display='none';
  document.getElementById('classif-xtab-wrap').style.display='none';
  document.getElementById('classif-chart-wrap').style.display='none';
  try{
    var stats12=await api('/aht-stats?months=12');
    var products=await api('/products');
    document.getElementById('classification-loading').style.display='none';
    var prodList=(products.products||[]).filter(function(p){return p.last_30_days>0;});
    var colors=ticketClassificationModel.POOL_COLORS;
    var byPool={};
    var byProduct={};
    prodList.forEach(function(p){
      var pool=ticketClassificationModel.resolveQueueGroup(p.product);
      byPool[pool]=(byPool[pool]||0)+p.last_30_days;
      byProduct[p.product]={count:p.last_30_days,pool:pool};
    });
    var months=stats12.months||[];
    var ticketMonths=months.filter(function(m){return m.pools.some(function(p){return p.raw_tickets>0;});});
    var poolActuals={};
    ticketMonths.forEach(function(m){
      (m.pools||[]).forEach(function(p){
        if(!poolActuals[p.pool])poolActuals[p.pool]={raw:0,filtered:0,months:0};
        poolActuals[p.pool].raw+=p.raw_tickets;
        poolActuals[p.pool].filtered+=p.filtered_tickets;
        if(p.raw_tickets>0)poolActuals[p.pool].months++;
      });
    });
    var enrichPct=parseFloat(stats12.enrichment_coverage||0);
    var totalTickets=stats12.total_tickets||0;
    var enriched=stats12.enriched_tickets||0;
    document.getElementById('classif-summary-cards').innerHTML=[
      '<div class="wc"><div class="wl">Total tickets (all time)</div><div class="wv" style="font-size:22px">'+totalTickets.toLocaleString('sv-SE')+'</div></div>',
      '<div class="wc"><div class="wl">Berikade tickets</div><div class="wv '+(enrichPct>=80?'ok':enrichPct>20?'warn':'crit')+'" style="font-size:22px">'+enriched.toLocaleString('sv-SE')+'</div><div class="wl">'+enrichPct.toFixed(1)+'% tackning</div></div>',
      '<div class="wc"><div class="wl">Ej berikade</div><div class="wv crit" style="font-size:22px">'+(totalTickets-enriched).toLocaleString('sv-SE')+'</div><div class="wl">Utan produktklassif.</div></div>',
      '<div class="wc"><div class="wl">Manader med ticketdata</div><div class="wv ok" style="font-size:22px">'+ticketMonths.length+'</div><div class="wl">av 12 senaste</div></div>',
      '<div class="wc"><div class="wl">Supply-status</div><div class="wv ok" style="font-size:16px">P4 â</div><div class="wl">95 rader seedade</div></div>'
    ].join('');
    document.getElementById('classif-summary-grid').style.display='';
    var pools=['classic','s1','frankly','talent','switchboard','unknown'];
    var poolLabels={classic:'Classic',s1:'S1',frankly:'Frankly',talent:'Talent',switchboard:'Switchboard',unknown:'Okand'};
    var prodRows=Object.keys(byProduct).sort(function(a,b){return byProduct[b].count-byProduct[a].count;});
    var thead='<thead><tr><th>Produkt (cf_category_1)</th>'+pools.map(function(pool){return '<th class="r" style="color:'+(colors[pool]||'#475569')+'">'+poolLabels[pool]+'</th>';}).join('')+'<th class="r">Totalt</th></tr></thead>';
    var tbody='<tbody>';
    prodRows.forEach(function(prod){
      var assignedPool=byProduct[prod].pool;
      var count=byProduct[prod].count;
      var cells=pools.map(function(pool){
        var val=pool===assignedPool?count:0;
        return '<td class="n val-cell '+(val===0?'zero':val>100?'high':'low')+'">'+(val>0?val:'-')+'</td>';
      }).join('');
      tbody+='<tr><td style="font-size:12px">'+prod+'</td>'+cells+'<td class="n" style="font-weight:800">'+count+'</td></tr>';
    });
    tbody+='<tr class="total-row"><td style="font-size:12px;font-weight:700">Totalt (API faktiska tickets)</td>';
    var grandTotal=0;
    pools.forEach(function(pool){
      var act=poolActuals[pool];var raw=act?act.raw:0;grandTotal+=raw;
      tbody+='<td class="n" style="color:'+(colors[pool]||'#94a3b8')+';font-weight:800">'+(raw>0?raw.toLocaleString('sv-SE'):'-')+'</td>';
    });
    tbody+='<td class="n" style="font-weight:800">'+grandTotal.toLocaleString('sv-SE')+'</td></tr></tbody>';
    document.getElementById('classif-xtab').innerHTML=thead+tbody;
    document.getElementById('classif-xtab-wrap').style.display='';
    var tableRows='';
    months.forEach(function(m){
      (m.pools||[]).forEach(function(p){
        if(p.raw_tickets===0&&p.fte_supply===0)return;
        var gapColor=p.gap<0?'#fca5a5':p.gap<=0.5?'#fcd34d':'#4ade80';
        var noData=p.raw_tickets===0&&p.fte_supply>0;
var gapDisplay=noData?'<span style="color:#f59e0b;font-size:10px;font-weight:700">Ingen demand-data</span>':('<span style="color:'+gapColor+'">'+p.gap.toFixed(2)+'</span>');
var covDisplay=noData?'<span style="color:#475569;font-size:10px">Ej berÃ¤kningsbar</span>':(p.coverage_pct+'%');
tableRows+='<tr style="'+(noData?'opacity:0.55':'')+'"><td style="font-variant-numeric:tabular-nums">'+m.year_month+'</td>'
+'<td style="color:'+(colors[p.pool]||'#94a3b8')+';font-weight:600">'+p.pool_name+'</td>'
+'<td class="n">'+(p.raw_tickets>0?p.raw_tickets:'â')+'</td>'
+'<td class="n">'+(p.filtered_tickets>0?p.filtered_tickets:'â')+'</td>'
+'<td class="n">'+(p.raw_tickets>0?p.effective_aht:'â')+'</td>'
+'<td class="n">'+(p.filtered_fte>0?p.filtered_fte.toFixed(2):'â')+'</td>'
+'<td class="n" style="color:'+(noData?'#f59e0b':'#94a3b8')+'">'+p.fte_supply.toFixed(2)+(noData?' â ':'')+'</td>'
+'<td class="n">'+gapDisplay+'</td>'
+'<td class="n">'+covDisplay+'</td></tr>';
      });
    });
    document.getElementById('monthly-pool-table').innerHTML=tableRows||'<tr><td colspan="9" style="color:#475569;text-align:center;padding:24px">Ingen data</td></tr>';
    destroyChart('classif');
    var poolNames=Object.keys(byPool).filter(function(k){return byPool[k]>0;});
    if(poolNames.length>0){
      var ctx=document.getElementById('classifChart').getContext('2d');
      _charts['classif']=new Chart(ctx,{type:'bar',
        data:{labels:poolNames.map(function(p){return p.charAt(0).toUpperCase()+p.slice(1);}),
          datasets:[{label:'Tickets senaste 30 dagar',data:poolNames.map(function(p){return byPool[p];}),
            backgroundColor:poolNames.map(function(p){return hexToRgba(colors[p]||'#475569',0.6);}),
            borderColor:poolNames.map(function(p){return colors[p]||'#475569';}),borderWidth:1,borderRadius:4}]},
        options:{responsive:true,maintainAspectRatio:true,
          plugins:{legend:{display:false},tooltip:{backgroundColor:'#ffffff',borderColor:'#dde3ee',borderWidth:1,titleColor:'#e2e8f0',bodyColor:'#94a3b8'}},
          scales:{x:{grid:{color:'#f1f5f9'},ticks:{color:'#94a3b8'}},y:{grid:{color:'#f1f5f9'},ticks:{color:'#64748b'}}}}
      });
      document.getElementById('classif-chart-wrap').style.display='';
    }
  }catch(e){
    document.getElementById('classification-loading').style.display='none';
    document.getElementById('classification-error').textContent='Fel: '+(e.message||e);
    document.getElementById('classification-error').style.display='';
  }
}


function renderMigrationTable(){
  var phaseClsMap={'Akut':'phase-akut','Fas 1':'phase-fas1','Fas 2':'phase-fas2','Fas 3':'phase-fas3','Expansion':'phase-expansion'};
  document.getElementById('migration-table').innerHTML=planningModelAdapter.migration.map(function(m){
    var pc=phaseClsMap[m.phase]||'';
    var rnVal=m.recruitNeed===null?'-':(m.recruitNeed>=0?'+':'')+m.recruitNeed.toFixed(2);
    var rnCls=m.recruitNeed===null?'':m.recruitNeed>0.5?'style="color:#fca5a5;font-weight:700"':m.recruitNeed>0?'style="color:#fcd34d"':'';
    return '<tr><td style="font-weight:700">'+m.q+'</td>'
      +'<td><span class="phase-chip '+pc+'" style="font-size:10px;padding:2px 8px">'+m.phase+'</span></td>'
      +'<td class="n">'+m.migrated.toLocaleString('sv-SE')+'</td>'
      +'<td class="n">'+m.classicRemain.toLocaleString('sv-SE')+'</td>'
      +'<td class="n">'+m.s1Vol.toLocaleString('sv-SE')+'</td>'
      +'<td class="n">'+m.classicVol.toLocaleString('sv-SE')+'</td>'
      +'<td class="n">'+m.s1WithoutAi.toFixed(2)+'</td>'
      +'<td class="n" style="color:#4ade80;font-weight:700">'+m.s1WithAi.toFixed(2)+'</td>'
      +'<td class="n" '+rnCls+'>'+rnVal+'</td>'
      +'<td class="n">'+m.costSek.toLocaleString('sv-SE')+' kr</td></tr>';
  }).join('');
}
function renderMigrationChart(){
  destroyChart('migration');
  var ctx=document.getElementById('migrationChart').getContext('2d');
  _charts['migration']=new Chart(ctx,{type:'line',
    data:{labels:planningModelAdapter.migration.map(function(m){return m.q;}),datasets:[
      {label:'S1 FTE med AI-deflection',data:planningModelAdapter.migration.map(function(m){return m.s1WithAi;}),borderColor:'#4ade80',backgroundColor:'rgba(74,222,128,0.1)',borderWidth:2.5,pointRadius:5,fill:true},
      {label:'S1 FTE utan AI-deflection',data:planningModelAdapter.migration.map(function(m){return m.s1WithoutAi;}),borderColor:'#fcd34d',backgroundColor:'rgba(252,211,77,0.05)',borderWidth:2,pointRadius:4,borderDash:[5,3],fill:false},
      {label:'Classic volym (tusental)',data:planningModelAdapter.migration.map(function(m){return m.classicVol/1000;}),borderColor:'#f87171',backgroundColor:'rgba(248,113,113,0.05)',borderWidth:1.5,pointRadius:3,borderDash:[2,4],yAxisID:'y2',fill:false}
    ]},
    options:{responsive:true,maintainAspectRatio:true,
      plugins:{legend:{labels:{color:'#94a3b8',font:{size:11}}},tooltip:{backgroundColor:'#ffffff',borderColor:'#dde3ee',borderWidth:1,titleColor:'#e2e8f0',bodyColor:'#94a3b8'}},
      scales:{x:{grid:{color:'#f1f5f9'},ticks:{color:'#64748b'}},y:{grid:{color:'#f1f5f9'},ticks:{color:'#64748b'},title:{display:true,text:'FTE',color:'#475569'},suggestedMin:2,suggestedMax:5},y2:{position:'right',grid:{drawOnChartArea:false},ticks:{color:'#ef4444'},title:{display:true,text:'Classic kunder (k)',color:'#ef4444'}}}}
  });
}
function renderSensitivityTable(){
  document.getElementById('sensitivity-table').innerHTML=planningModelAdapter.sensitivity.map(function(s){
    var fmt=s.unit==='SEK'?function(v){return v.toLocaleString('sv-SE')+' kr';}:function(v){return v.toFixed(2)+' FTE';};
    return '<tr><td><strong>'+s.driver+'</strong></td>'
      +'<td class="n" style="color:#fca5a5">'+fmt(s.m20)+'</td>'
      +'<td class="n" style="color:#fcd34d">'+fmt(s.m10)+'</td>'
      +'<td class="n" style="color:#1e293b;font-weight:800">'+fmt(s.base)+'</td>'
      +'<td class="n" style="color:#fcd34d">'+fmt(s.p10)+'</td>'
      +'<td class="n" style="color:#fca5a5">'+fmt(s.p20)+'</td>'
      +'<td><span class="tag info">'+s.unit+'</span></td></tr>';
  }).join('');
}
function renderSensitivityChart(){
  destroyChart('sensitivity');
  var fteOnly=planningModelAdapter.sensitivity.filter(function(s){return s.unit==='FTE';});
  var sorted=[...fteOnly].sort(function(a,b){return Math.abs(b.p20-b.m20)-Math.abs(a.p20-a.m20);});
  var ctx=document.getElementById('sensitivityChart').getContext('2d');
  _charts['sensitivity']=new Chart(ctx,{type:'bar',
    data:{labels:sorted.map(function(s){return s.driver;}),datasets:[
      {label:'-20%',data:sorted.map(function(s){return s.m20-s.base;}),backgroundColor:'rgba(239,68,68,0.6)',borderColor:'#ef4444',borderWidth:1,borderRadius:3},
      {label:'+20%',data:sorted.map(function(s){return s.p20-s.base;}),backgroundColor:'rgba(99,102,241,0.6)',borderColor:'#6366f1',borderWidth:1,borderRadius:3}
    ]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:true,
      plugins:{legend:{labels:{color:'#94a3b8',font:{size:11}}},tooltip:{backgroundColor:'#ffffff',borderColor:'#dde3ee',borderWidth:1,titleColor:'#e2e8f0',bodyColor:'#94a3b8',callbacks:{label:function(ctx2){return ctx2.dataset.label+': '+(ctx2.raw>=0?'+':'')+ctx2.raw.toFixed(2)+' FTE vs bas';}}}},
      scales:{x:{grid:{color:'#f1f5f9'},ticks:{color:'#64748b'},title:{display:true,text:'Avvikelse fran 10.10 FTE',color:'#475569'}},y:{grid:{color:'#f1f5f9'},ticks:{color:'#94a3b8'}}}}
  });
}

// ââ LEGACY TABS ââ
async function loadOverview() {
  try {
    const d = await api('/overview');
    const ps = d.products || [];

    // KPI cards
    const cards = document.querySelectorAll('#tab-overview .ov-kpi-card');
    const setCard = (i, val) => {
      if (!cards[i]) return;
      const v = cards[i].querySelector('.ov-kpi-value');
      if (v) v.textContent = val;
    };
    setCard(0, d.today_total ?? 'â');
    setCard(1, d.active_today ?? 'â');
    setCard(2, d.avg_7d != null ? d.avg_7d.toFixed(1) : 'â');
    setCard(3, (d.last_30d_total ?? 0).toLocaleString('sv-SE'));

    // Product table
    const ptb  = document.getElementById('ptb');
    const ptb2 = document.getElementById('ptb2');
    const total30 = ps.reduce((s, p) => s + (p.last_30_days || 0), 0) || 1;
    const makeRow = p => {
      const share = Math.round(p.last_30_days / total30 * 100);
      return '<tr><td>' + (p.product || 'â') + '</td><td>' + (p.today ?? 0) + '</td><td>' + (p.yesterday ?? 0) + '</td><td>' + (p.last_7_days ?? 'â') + '</td><td>' + share + '%</td></tr>';
    };
    if (ptb)  ptb.innerHTML  = ps.map(makeRow).join('');
    if (ptb2) ptb2.innerHTML = ps.map(makeRow).join('');

    setTimeout(renderSparkChart, 200);

    const ts = document.getElementById('ov-ts');
    if (ts) ts.textContent = 'Updated: ' + new Date().toLocaleTimeString('sv-SE', {hour:'2-digit', minute:'2-digit'});

  } catch(err) { console.error('loadOverview error:', err); }
}
function fp(btn){document.querySelectorAll('#pool-filter button').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');renderDailyTable(btn.dataset.pool);}
function renderDailyTable(pool){var rows=pool?_allDaily.filter(function(r){return r.pool_slug===pool;}):_allDaily;document.getElementById('daily-table').innerHTML=rows.slice(0,200).map(function(r){return '<tr><td>'+r.stat_date+'</td><td>'+h(r.pool_slug)+'</td><td class="n">'+r.ticket_count+'</td><td class="n">'+fmtFTE(r.peak_fte_calculated)+'</td><td class="n">'+fmtFTE(r.gap_fte)+'</td><td><span class="ga '+(r.capacity_status==='critical'?'crit':r.capacity_status==='under'?'under':'ok')+'">'+r.capacity_status+'</span></td></tr>';}).join('');}

var _ahtData=null,_view='all';
async function loadAHT(){
  window._ahtL=true;
  await updateEnrichStatus();
  try{
    var d=await api('/aht-stats?months=12');_ahtData=d;
    dailyAnalyticsAdapter.invalidate();
    var cov=parseFloat(d.enrichment_coverage||0),latest=d.months&&d.months[d.months.length-1];
    var s=['<div class="wc"><div class="wl">Enrichment</div><div class="wv '+(cov>=COV_THRESHOLD?'ok':cov>20?'warn':'crit')+'">'+cov.toFixed(1)+'%</div><div class="wl">'+d.enriched_tickets+'/'+d.total_tickets+'</div></div>'];
    if(latest){s.push('<div class="wc"><div class="wl">Senaste manad</div><div class="wv" style="font-size:18px">'+h(latest.year_month)+'</div></div>');s.push('<div class="wc"><div class="wl">FTE-gap</div><div class="wv '+(latest.total_gap>=0?'ok':latest.total_gap>=-0.5?'warn':'crit')+'">'+fmtFTE(latest.total_gap)+'</div></div>');}
    document.getElementById('aht-summary').innerHTML=s.join('');
    var pools=d.pools||[];
    document.getElementById('aht-pool-filter').innerHTML='<button class="pool-btn active" onclick="filterAHT(this)" data-pool="">Alla</button>'+pools.map(function(p){return '<button class="pool-btn" onclick="filterAHT(this)" data-pool="'+h(p.slug)+'">'+h(p.name)+'</button>';}).join('');
    renderAHTGrid(d,'');
  }catch(e){console.error('AHT',e);}
}
function setView(v,btn){_view=v;document.querySelectorAll('.vt-btn').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');if(_ahtData)renderAHTGrid(_ahtData,document.querySelector('#aht-pool-filter .pool-btn.active')?.dataset.pool||'');}
function filterAHT(btn){document.querySelectorAll('#aht-pool-filter .pool-btn').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');if(_ahtData)renderAHTGrid(_ahtData,btn.dataset.pool);}
function renderAHTGrid(d,fPool){var months=d.months||[];document.getElementById('aht-grid').innerHTML=months.map(function(m){var pools=fPool?m.pools.filter(function(p){return p.pool===fPool;}):m.pools;if(!pools.length)return'';var useCC=_view==='cc',totF=pools.reduce(function(s,p){return s+(useCC?p.cc_scope_fte||p.filtered_fte:p.filtered_fte);},0),totS=pools.reduce(function(s,p){return s+p.fte_supply;},0),gap=totS-totF,cls=gap<-0.5?'crit':gap<0?'under':'ok';var avgCov=parseFloat(m.avg_coverage_pct||0);return'<div class="ac '+cls+'"><div class="ah">'+m.year_month+' <span class="ga '+cls+'">Gap: '+fmtFTE(gap)+'</span></div>'+pools.map(function(p){var fte=useCC?(p.cc_scope_fte||p.filtered_fte):p.filtered_fte,cnt=useCC?(p.cc_scope_tickets||p.filtered_tickets):p.filtered_tickets,pct=p.raw_tickets>0?Math.round(cnt/p.raw_tickets*100):100,pCov=parseFloat(p.coverage_pct||0);return'<div class="ar"><span>'+h(p.pool_name)+'</span><span class="av '+gapCls(p.gap)+'">'+fmtFTE(p.gap)+'</span></div><div style="font-size:11px;color:#64748b;margin-bottom:6px">'+cnt+' ('+pct+'%)'+(useCC?'<span class="scope-badge">CC</span>':'')+' | AHT: '+p.effective_aht+'min | FTE: '+fmtFTE(fte)+'/'+fmtFTE(p.fte_supply)+(pCov>0?' <span style="padding:1px 5px;border-radius:3px;font-size:10px;background:'+(pCov>=COV_THRESHOLD?'#14532d':'#7f1d1d')+';color:'+(pCov>=COV_THRESHOLD?'#4ade80':'#fca5a5')+'">'+pCov.toFixed(0)+'%</span>':'')+'</div>';}).join('')+'<div style="border-top:1px solid #dde3ee;margin-top:6px;padding-top:6px;font-size:12px;color:#64748b">Krav: '+fmtFTE(totF)+' | Tillgang: '+fmtFTE(totS)+'</div>'+(avgCov<COV_THRESHOLD?'<div class="cov-warn">'+avgCov.toFixed(0)+'% datatackning</div>':'')+'</div>';}).join('');}

async function updateEnrichStatus(){try{var d=await api('/enrich-status');var pct=parseFloat(d.coverage_pct||0);document.getElementById('enrich-status').textContent='Enrichment: '+d.enriched_tickets+'/'+d.total_tickets+' ('+pct.toFixed(1)+'%) | CC-scope: '+(d.cc_scope_tickets||0)+' | Samtal: '+(d.phone_with_duration||0);var prog=document.getElementById('enrich-prog');if(prog)prog.style.width=pct+'%';if(pct>=100){var btn=document.getElementById('enrich-btn');if(btn){btn.disabled=true;btn.textContent='Klart!';}}}catch(e){}}
async function runEnrich(){var btn=document.getElementById('enrich-btn');btn.disabled=true;btn.textContent='Hamtar...';try{var r=await fetch('https://psyelfxaehmtnfdaobyi.supabase.co/functions/v1/cc-ticket-enricher?limit=200',{headers:{'apikey':K,'Authorization':'Bearer '+K}});var d=await r.json();btn.textContent='Klart: '+(d.processed||0)+' behandlade';await updateEnrichStatus();var d2=await api('/aht-stats?months=12');_ahtData=d2;dailyAnalyticsAdapter.invalidate();renderAHTGrid(d2,document.querySelector('#aht-pool-filter .pool-btn.active')?.dataset.pool||'');}catch(e){btn.textContent='Fel: '+e.message;}setTimeout(function(){if(btn){btn.disabled=false;btn.textContent='Hamta Freshdesk-data';}},8000);}

function initPrognos(){window._pgL=true;var now=new Date();document.getElementById('pg-start-month').value=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');if(_ahtData)runPrognos();}
async function runPrognos(){
  var volChg=parseFloat(document.getElementById('pg-vol-chg').value)||0,ahtChg=parseFloat(document.getElementById('pg-aht-chg').value)||0,supChg=parseFloat(document.getElementById('pg-sup-chg').value)||0,startMonth=document.getElementById('pg-start-month').value;
  if(!_ahtData){try{_ahtData=await api('/aht-stats?months=3');}catch(e){return;}}
  var months=_ahtData.months||[];
  if(!months.length){document.getElementById('forecast-grid').innerHTML='<div style="color:#64748b;padding:20px">Ingen basdata</div>';return;}
  var base=months[months.length-1]||months[0];
  var baseVol=base.pools?base.pools.reduce(function(s,p){return s+p.filtered_tickets;},0):0;
  var baseAHT=base.pools&&base.pools.length?base.pools.reduce(function(s,p){return s+p.effective_aht;},0)/base.pools.length:15;
  var baseSupply=base.pools?base.pools.reduce(function(s,p){return s+p.fte_supply;},0):WP.effectiveSupplyFte;
  var sp=startMonth.split('-'),sy=parseInt(sp[0]),sm=parseInt(sp[1]);
  var rows=[],totReq=0,totGap=0,surp=0,def=0;
  for(var i=0;i<12;i++){var mn=sm+i,my=sy;while(mn>12){mn-=12;my++;}var ym=my+'-'+String(mn).padStart(2,'0');var vol=baseVol*Math.pow(1+volChg/100,i+1),aht=baseAHT*Math.pow(1+ahtChg/100,i+1),sup=baseSupply+(supChg*(i+1)),wd=swedishWorkingDays(my,mn),req=computeFTE(vol,aht,ym),gap=sup-req;totReq+=req;totGap+=gap;if(gap>=0)surp++;else def++;rows.push({ym:ym,vol:Math.round(vol),aht:aht.toFixed(1),wd:wd,req:req,sup:sup,gap:gap});}
  var avgGap=totGap/12;
  document.getElementById('prognos-summary').innerHTML=['<div class="wc"><div class="wl">Snitt FTE-gap</div><div class="wv '+(avgGap>=0?'ok':'crit')+'">'+fmtFTE(avgGap)+'</div></div>','<div class="wc"><div class="wl">Manader overskott</div><div class="wv ok">'+surp+'</div></div>','<div class="wc"><div class="wl">Manader underskott</div><div class="wv '+(def>0?'crit':'ok')+'">'+def+'</div></div>','<div class="wc"><div class="wl">Total FTE Required</div><div class="wv warn">'+fmtFTE(totReq)+'</div></div>'].join('');
  document.getElementById('forecast-grid').innerHTML=rows.map(function(r){var gap=parseFloat(r.gap),cls=gap>0.5?'surplus':gap<-0.5?'deficit':'marginal',mx=Math.max(r.req,r.sup)||1;return'<div class="fc '+cls+'"><div class="fh"><span class="fm">'+r.ym+'</span><span class="ga '+(gap>=0?'ok':gap>=-0.5?'under':'crit')+'">Gap: '+fmtFTE(gap)+'</span></div><div class="mp"><div class="ml">FTE Krav: '+fmtFTE(r.req)+'</div><div class="mb"><div class="mf req" style="width:'+Math.round(r.req/mx*100)+'%"></div></div></div><div class="mp"><div class="ml">FTE Tillgang: '+fmtFTE(r.sup)+'</div><div class="mb"><div class="mf sup" style="width:'+Math.round(r.sup/mx*100)+'%"></div></div></div><div class="mv">Volym: '+r.vol+' | AHT: '+r.aht+'min | Arbdagar: '+r.wd+'</div></div>';}).join('');
  document.getElementById('forecast-table').innerHTML=rows.map(function(r){var gap=parseFloat(r.gap),cls=gap<-0.5?'crit':gap<0?'under':'ok';return'<tr><td>'+r.ym+'</td><td class="n">'+r.vol+'</td><td class="n">'+r.aht+'</td><td class="n">'+r.wd+'</td><td class="n">'+fmtFTE(r.req)+'</td><td class="n">'+fmtFTE(r.sup)+'</td><td class="n"><span class="ga '+cls+'">'+fmtFTE(gap)+'</span></td><td><span class="ga '+cls+'">'+(gap>=0?'Overskott':'Underskott')+'</span></td></tr>';}).join('');
}

function loadSetupTab(){window._setupL=true;renderWorkdayTable();loadSetupStatus();}
function renderWorkdayTable(){var now=new Date(),rows=[];for(var i=11;i>=0;i--){var d=new Date(now.getFullYear(),now.getMonth()-i,1);var y=d.getFullYear(),m=d.getMonth()+1,ym=y+'-'+String(m).padStart(2,'0'),wd=swedishWorkingDays(y,m),av=wd*7*60,diff=av-9450;rows.push('<tr><td>'+ym+'</td><td class="n">'+wd+'</td><td class="n">'+av.toLocaleString('sv-SE')+'</td><td class="n" style="color:'+(diff>0?'#fca5a5':'#4ade80')+'">'+diff+'</td></tr>');}var t=document.getElementById('workday-table');if(t)t.innerHTML=rows.join('');}
async function loadSetupStatus(){try{var d=await api('/enrich-status');var pct=parseFloat(d.coverage_pct||0);document.getElementById('setup-enrich-detail').innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:8px"><div class="wc"><div class="wl">Total tickets</div><div class="wv" style="font-size:18px">'+d.total_tickets+'</div></div><div class="wc"><div class="wl">Berikade</div><div class="wv ok" style="font-size:18px">'+d.enriched_tickets+'</div></div><div class="wc"><div class="wl">Kvarstende</div><div class="wv '+(d.total_tickets-d.enriched_tickets>0?'crit':'ok')+'" style="font-size:18px">'+(d.total_tickets-d.enriched_tickets)+'</div></div><div class="wc"><div class="wl">Tackning</div><div class="wv '+(pct>=COV_THRESHOLD?'ok':'crit')+'">'+pct.toFixed(1)+'%</div></div><div class="wc"><div class="wl">CC-scope</div><div class="wv warn" style="font-size:18px">'+(d.cc_scope_tickets||0)+'</div></div></div>';}catch(e){document.getElementById('setup-enrich-detail').textContent='Fel: '+e.message;}}

// ---- expose to global scope (called from inline HTML event handlers) ----
window.showTab = showTab;
window.setTimeGran = setTimeGran;
window.setTrendWindow = setTrendWindow;
window.filterAHT = filterAHT;
window.refreshClassificationData = refreshClassificationData;
window.loadSetupStatus = loadSetupStatus;
window.runEnrich = runEnrich;
window.runPrognos = runPrognos;
window.setView = setView;

export { initWP, showTab, setTimeGran, setTrendWindow, loadOverview };
