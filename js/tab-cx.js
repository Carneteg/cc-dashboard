// ============================================================
// js/tab-cx.js — "Kundservice i AI-eran" (CX Trends 2026)
// v1 — Zendesk CX Trends 2026-ramverket applicerat på egen data.
// Sex underflikar: Nuläge · Fem trender · Beslutsmatris ·
// Kundresa & friktion · Styrmått · Handlingsplan
// Datakällor: /overview, /aht-stats, /enrich-status (Edge Function)
// + rpc/get_ticket_category_stats (FCR-proxy per ärendetyp).
// Zendesk-procentsatser är benchmark; komplexitet/känslighet i
// matrisen är en illustrativ modell — tydligt markerad som sådan.
// ============================================================

(function(){
'use strict';

var A='https://psyelfxaehmtnfdaobyi.supabase.co/functions/v1/cc-dashboard-api';
var K='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzeWVsZnhhZWhtdG5mZGFvYnlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4NTI5MDQsImV4cCI6MjA2NDQyODkwNH0.I1oHCVFQLCkBKhtBi4dHpiyf2DUWcRSnF7fNQqpEFdQ';
var SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzeWVsZnhhZWhtdG5mZGFvYnlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTM2NzksImV4cCI6MjA5NjU4OTY3OX0.Nenlc-8pab7hfLtkRDovXy5dVU-oDSNE01STdV-WbJ8';

function api(p){
  return fetch(A+p,{headers:{'apikey':K,'Authorization':'Bearer '+K}}).then(function(r){
    if(!r.ok)throw new Error('API '+p+' HTTP '+r.status);
    return r.json();
  });
}
function rpcCategoryStats(){
  return fetch('https://psyelfxaehmtnfdaobyi.supabase.co/rest/v1/rpc/get_ticket_category_stats',{
    method:'POST',
    headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({p_year_month:null})
  }).then(function(r){if(!r.ok)throw new Error('RPC HTTP '+r.status);return r.json();});
}
function h(s){var d=document.createElement('div');d.textContent=s==null?'':String(s);return d.innerHTML;}
function pct(n){return (n==null||isNaN(n))?'–':(Math.round(n*10)/10)+'%';}

// Zendesk CX Trends 2026 — benchmark (11 297 respondenter, 22 länder, jun 2025)
var ZD={service247:74,fasterExpected:88,memoryAi:83,multimodal:76,convAnalytics:82,transparency:95};

// ─── Delad state ────────────────────────────────────────────
var S={overview:null,aht:null,enrich:null,cats:null,errors:[]};
var _charts={};
function killChart(id){if(_charts[id]){_charts[id].destroy();delete _charts[id];}}

// Månad med data, sorterade stigande på year_month
function monthsWithData(){
  var m=(S.aht&&S.aht.months)||[];
  return m.filter(function(x){return (x.pools||[]).some(function(p){return p.raw_tickets>0;});})
          .slice().sort(function(a,b){return String(a.year_month)<String(b.year_month)?-1:1;});
}
// Vägd AHT (min) för senaste månad med data
function latestWeightedAht(){
  var md=monthsWithData();
  if(!md.length)return null;
  var last=md[md.length-1],tick=0,sum=0;
  (last.pools||[]).forEach(function(p){
    if(p.filtered_tickets>0&&p.effective_aht>0){tick+=p.filtered_tickets;sum+=p.filtered_tickets*p.effective_aht;}
  });
  return tick>0?{aht:sum/tick,ym:last.year_month}:null;
}
function fcrTotal(){
  if(!Array.isArray(S.cats)||!S.cats.length)return null;
  var c=0,f=0;
  S.cats.forEach(function(r){c+=Number(r.ticket_count||0);f+=Number(r.fcr_count||0);});
  return c>0?{pct:100*f/c,total:c}:null;
}
function total30(){
  var ps=(S.overview&&S.overview.products)||[];
  return ps.reduce(function(s,p){return s+(p.last_30_days||0);},0);
}

// ─── Ärendetyps-modell (illustrativ placering, egen volymdata) ──
function classifyType(name){
  var n=String(name||'').toLowerCase();
  function has(){for(var i=0;i<arguments.length;i++){if(n.indexOf(arguments[i])>-1)return true;}return false;}
  if(has('lösenord','password','login','inlogg','access'))   return {c:20,s:12};
  if(has('uppsäg','cancel','churn','terminat','avslut'))     return {c:50,s:92};
  if(has('klagomål','complaint','eskaler','miss'))           return {c:55,s:85};
  if(has('gdpr','personupp','privacy'))                      return {c:60,s:80};
  if(has('faktura','invoice','billing','avtal','agreement','pris')) return {c:45,s:55};
  if(has('bug','fel','error','incident','problem'))          return {c:65,s:45};
  if(has('integration','api','teknisk','technical','import','export')) return {c:75,s:35};
  if(has('feature','önskemål','förbättr','request'))         return {c:40,s:20};
  if(has('fråga','question','how','info','guide'))           return {c:25,s:15};
  return {c:50,s:40};
}
function recommendFor(c,s){
  if(s>=70)          return {key:'human', label:'Människa äger · AI ger beslutsstöd', color:'#ff3b30'};
  if(c>=55)          return {key:'assist',label:'AI stöttar agenten',                 color:'#ff9500'};
  if(c<40&&s<40)     return {key:'auto',  label:'Automatisera + mänsklig reservväg',  color:'#34c759'};
  return               {key:'aifirst',    label:'AI-först med enkel eskalering',      color:'#0071e3'};
}
// Toppärendetyper från RPC-datan (fallback: produktvolymer)
function matrixItems(){
  var items=[];
  if(Array.isArray(S.cats)&&S.cats.length){
    var byType={};
    S.cats.forEach(function(r){
      var t=r.ticket_type||'Okänd';
      if(!byType[t])byType[t]={name:t,count:0,fcr:0};
      byType[t].count+=Number(r.ticket_count||0);
      byType[t].fcr+=Number(r.fcr_count||0);
    });
    items=Object.values(byType).sort(function(a,b){return b.count-a.count;}).slice(0,10);
  }else if(S.overview&&Array.isArray(S.overview.products)){
    items=S.overview.products.filter(function(p){return p.last_30_days>0;})
      .map(function(p){return {name:p.product,count:p.last_30_days,fcr:null};})
      .sort(function(a,b){return b.count-a.count;}).slice(0,10);
  }
  return items.map(function(it,i){
    var cs=classifyType(it.name);
    // sprid identiska default-placeringar något så bubblor inte staplas
    var jc=((i*37)%11)-5, js=((i*53)%9)-4;
    var c=Math.max(5,Math.min(95,cs.c+jc)), s=Math.max(5,Math.min(95,cs.s+js));
    var rec=recommendFor(c,s);
    var fcrPct=(it.fcr!=null&&it.count>0)?100*it.fcr/it.count:null;
    return {name:it.name,count:it.count,c:c,s:s,rec:rec,fcrPct:fcrPct};
  });
}

// ─── UNDERFLIK 1: Nuläge ────────────────────────────────────
function renderNulage(){
  var el=document.getElementById('cx-panel-nulage');if(!el)return;
  var ov=S.overview,md=monthsWithData(),aht=latestWeightedAht(),fcr=fcrTotal();
  var enrichPct=S.enrich?parseFloat(S.enrich.coverage_pct||0):null;
  var t30=total30();
  var htmlStr='';

  htmlStr+='<div class="kpi-grid">';
  htmlStr+=card('Tickets · 30 dagar',ov?t30.toLocaleString('sv-SE'):'–',ov?'Alla produkter & köer':'API-data saknas');
  htmlStr+=card('Snitt/dag · 7 dagar',(ov&&ov.avg_7d!=null)?(+ov.avg_7d).toFixed(1):'–','Normaliseringsreferens');
  htmlStr+=card('Vägd AHT',aht?aht.aht.toFixed(0)+' min':'–',aht?'Senaste månad med data ('+h(aht.ym)+')':'Ingen AHT-data');
  htmlStr+=card('FCR-proxy',fcr?pct(fcr.pct):'–',fcr?'fcr_count/tickets · '+fcr.total.toLocaleString('sv-SE')+' ärenden (all-time)':'RPC-data saknas');
  htmlStr+=card('Berikade tickets',enrichPct!=null?pct(enrichPct):'–','cc_ticket_meta-täckning = kontextgrund');
  htmlStr+=card('Månader m. data',md.length+' / 12','Beräkningsbar demand i /aht-stats');
  htmlStr+='</div>';

  // Volymtrend
  htmlStr+='<div class="chart-wrap" style="margin:16px 0"><h4>Ticketvolym & FTE-estimat per månad <span class="layer-badge analytics" style="font-size:9px;margin-left:4px">Analytics · API</span></h4><canvas id="cxVolChart" height="80"></canvas></div>';

  // Per produkt (30d)
  if(ov&&Array.isArray(ov.products)&&ov.products.length){
    var tot=t30||1;
    var rows=ov.products.slice().sort(function(a,b){return (b.last_30_days||0)-(a.last_30_days||0);}).map(function(p){
      var share=Math.round((p.last_30_days||0)/tot*100);
      return '<tr><td>'+h(p.product||'Okänd')+'</td><td class="n">'+(p.last_7_days||0)+'</td><td class="n">'+(p.last_30_days||0)+'</td>'
        +'<td style="min-width:110px"><div class="ag-sparkbar"><div class="ag-sparkbar__fill" style="width:'+share+'%"></div></div> <span style="font-size:11px;color:var(--text3)">'+share+'%</span></td></tr>';
    }).join('');
    htmlStr+='<div class="tw" style="margin-bottom:16px"><table><thead><tr><th>Produkt</th><th class="r">7 dagar</th><th class="r">30 dagar</th><th>Andel</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }

  // Datagap — vad ramverket kräver men datan saknar
  htmlStr+='<div class="section-header"><span class="section-title">Var datan är svag — gap mot CX 2026-ramverket</span></div>';
  htmlStr+='<div class="cx-gap-grid">'
    +gapCard('CES / kundansträngning','saknas','Ingen mätning av hur mycket kunden anstränger sig. Krävs för trend 2 (omedelbara lösningar).','crit')
    +gapCard('Återkontakt / reopens','saknas','Faktisk lösningsgrad kan inte verifieras — FCR-proxyn bygger på fcr_count-flaggan.','crit')
    +gapCard('Kanal-/formatmix','saknas','Text/bild/video-mix per ärende finns inte i API:et. Krävs för trend 3 (multimodalt).','warn')
    +gapCard('Kontexttäckning',enrichPct!=null?pct(enrichPct)+' berikade':'okänd','Tickets utan metadata blir "minneslösa" — kunden får upprepa sig.',enrichPct!=null&&enrichPct>=80?'ok':'warn')
    +gapCard('Supply-historik','statisk','dailyRosteredFte identisk alla månader (P4/Edge Function ej klar) — kapacitetsanalysen blir trubbig.','warn')
    +gapCard('CSAT per ärendetyp','delvis','CSAT finns per månad/pool (Agents-fliken) men inte kopplad till ärendetyp eller AI/människa-flöde.','warn')
    +'</div>';

  if(S.errors.length){
    htmlStr+='<div class="ae-error" style="margin-top:14px"><strong>Delvis data:</strong> '+S.errors.map(h).join(' · ')+'</div>';
  }
  el.innerHTML=htmlStr;
  renderVolChart();

  function card(l,v,sub){return '<div class="kpi-card"><div class="kpi-label">'+l+'</div><div class="kpi-value">'+v+'</div><div class="kpi-sub">'+sub+'</div></div>';}
  function gapCard(t,status,body,cls){
    var col=cls==='crit'?'var(--red)':cls==='warn'?'var(--amber)':'var(--green)';
    return '<div class="card" style="border-left:3px solid '+col+'"><div class="cl">'+h(t)+'</div>'
      +'<div style="font-size:14px;font-weight:700;color:'+col+';margin-bottom:6px">'+h(status)+'</div>'
      +'<div style="font-size:12px;color:var(--text2);line-height:1.5">'+body+'</div></div>';
  }
}
function renderVolChart(){
  if(typeof Chart==='undefined')return;
  var cv=document.getElementById('cxVolChart');if(!cv)return;
  var md=monthsWithData();if(!md.length){cv.parentElement.style.display='none';return;}
  killChart('vol');
  var labels=md.map(function(m){return m.year_month;});
  var vols=md.map(function(m){return (m.pools||[]).reduce(function(s,p){return s+(p.filtered_tickets||0);},0);});
  var ftes=md.map(function(m){return +( (m.pools||[]).reduce(function(s,p){return s+(p.filtered_fte||0);},0) ).toFixed(2);});
  _charts['vol']=new Chart(cv.getContext('2d'),{type:'line',
    data:{labels:labels,datasets:[
      {label:'Tickets',data:vols,borderColor:'#0071e3',backgroundColor:'rgba(0,113,227,0.08)',borderWidth:2,pointRadius:3,fill:true,yAxisID:'y'},
      {label:'FTE-estimat',data:ftes,borderColor:'#34c759',borderWidth:2,pointRadius:3,borderDash:[5,3],fill:false,yAxisID:'y2'}
    ]},
    options:{responsive:true,maintainAspectRatio:true,
      plugins:{legend:{labels:{color:'#6e6e73',font:{size:11}}}},
      scales:{x:{grid:{color:'#f1f5f9'},ticks:{color:'#6e6e73',font:{size:10}}},
        y:{grid:{color:'#f1f5f9'},ticks:{color:'#6e6e73'},title:{display:true,text:'Tickets',color:'#6e6e73'}},
        y2:{position:'right',grid:{drawOnChartArea:false},ticks:{color:'#34c759'},title:{display:true,text:'FTE',color:'#34c759'}}}}
  });
}

// ─── UNDERFLIK 2: Fem trender ───────────────────────────────
function renderTrender(){
  var el=document.getElementById('cx-panel-trender');if(!el)return;
  var enrichPct=S.enrich?parseFloat(S.enrich.coverage_pct||0):null;
  var fcr=fcrTotal(),md=monthsWithData(),aht=latestWeightedAht();
  var trends=[
    {no:1,title:'Minnesrik AI',zd:ZD.memoryAi+'% av CX-ledarna ser minnesrik AI som nyckeln till personalisering',
     status:enrichPct!=null?pct(enrichPct)+' av tickets är berikade med metadata':'Kontexttäckning okänd',
     ok:enrichPct!=null&&enrichPct>=80,
     gap:'Kontext finns i Freshdesk-historiken men konto-/avtalsdata, AI-sammanfattningar och sentiment saknas som kopplade lager.',
     risk:'Automatisering utan sammanhängande kontext skalar upp en opersonlig upplevelse — snabbare men sämre.',
     rec:'Höj berikningen till ≥95% och koppla på konto-/avtalsdata innan automatiseringen breddas.'},
    {no:2,title:'Omedelbara lösningar — inte bara snabb kontakt',zd:ZD.fasterExpected+'% förväntar sig snabbare svar än för ett år sedan · '+ZD.service247+'% förväntar sig service dygnet runt',
     status:fcr?'FCR-proxy: '+pct(fcr.pct)+' ('+fcr.total.toLocaleString('sv-SE')+' ärenden)':'Lösningsgrad mäts inte',
     ok:fcr!=null&&fcr.pct>=60,
     gap:'Styrningen mäter svarstid och AHT'+(aht?' ('+aht.aht.toFixed(0)+' min vägt)':'')+', men varken verifierad lösningsgrad, CES eller återkontakt.',
     risk:'Fel KPI belönar snabba men verkningslösa svar — kunden återkommer och total kostnad stiger.',
     rec:'Inför faktisk lösningsgrad (ingen återkontakt inom 7 dagar) och CES som primära styrmått.'},
    {no:3,title:'Multimodal support',zd:ZD.multimodal+'% skulle välja ett företag som låter dem blanda text, bild och video i samma tråd',
     status:'Format-/kanalmix per ärende saknas i API:et',
     ok:false,
     gap:'E-post, portal och telefon hanteras men det finns ingen gemensam formathistorik eller mätning av mediemix.',
     risk:'Kontext tappas när kunden byter kanal — ärendet börjar om och friktionen stiger.',
     rec:'Samla alla format i en gemensam ärendehistorik och logga kanal/format per kontakt i cc_ticket_meta.'},
    {no:4,title:'Samtalsstyrd analys',zd:ZD.convAnalytics+'% av ledarna säger att naturligt språk mot servicedatan ger insikter på sekunder',
     status:md.length+'/12 månader har beräkningsbar demand-data',
     ok:md.length>=9,
     gap:'Tre olika supply-källor rapporterar olika FTE och supply-historiken är statisk — svar på naturligt språk blir missvisande utan enhetliga definitioner.',
     risk:'Tillgänglig analys på bristfällig datakvalitet sprider fel beslut snabbare.',
     rec:'Lås KPI-definitioner (en källa per mått), exekvera P4-supply-historiken och utse dataägare innan självbetjäningsanalys rullas ut.'},
    {no:5,title:'AI-transparens',zd:ZD.transparency+'% förväntar sig en förklaring till beslut som fattats av AI',
     status:'Ingen mätning eller policy för AI-beslut idag',
     ok:false,
     gap:'AI-deflection (30%-scenariot) planeras utan definierad förklarbarhet eller garanterad väg till människa.',
     risk:'AI-beslut utan förklaring urholkar förtroendet — särskilt i känsliga ärenden (uppsägning, klagomål).',
     rec:'Varje AI-beslut ska kunna förklaras med enkelt språk och alltid erbjuda mänsklig granskning — bygg in det innan deflection-målet jagas.'}
  ];
  el.innerHTML='<div class="ae-sub">Zendesk-siffrorna är benchmark från CX Trends 2026 (11 297 respondenter, 22 länder). "Min data"-raden hämtas live från API:et. Zendesk säljer själva dessa lösningar — siffrorna är riktningsgivande, inte oberoende.</div>'
    +trends.map(function(t){
      var chip=t.ok?'<span class="tag ok">På väg</span>':'<span class="tag warn">Gap</span>';
      return '<div class="card" style="margin-bottom:14px">'
        +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">'
        +'<div style="font-size:15px;font-weight:700;color:var(--text)">'+t.no+'. '+h(t.title)+'</div>'+chip+'</div>'
        +'<div style="font-size:11px;color:var(--text3);margin:6px 0 10px">Benchmark: '+h(t.zd)+'</div>'
        +'<div class="cx-trend-grid">'
        +cell('Min data',t.status,t.ok?'var(--green)':'var(--amber)')
        +cell('Gapet',t.gap,null)
        +cell('Risk om inget görs',t.risk,null)
        +cell('Rekommendation',t.rec,'var(--accent)')
        +'</div></div>';
    }).join('');
  function cell(l,b,col){return '<div><div class="cl">'+l+'</div><div style="font-size:12px;line-height:1.55;color:'+(col||'var(--text2)')+'">'+h(b)+'</div></div>';}
}

// ─── UNDERFLIK 3: Beslutsmatris ─────────────────────────────
var _matrixRendered=false;
function renderMatris(){
  var el=document.getElementById('cx-panel-matris');if(!el)return;
  var items=matrixItems();
  var htmlStr='<div class="ae-sub">Ärendetyper från er egen data (volym = bubbelstorlek'+(items.length&&items[0].fcrPct!=null?', FCR-proxy per typ i tabellen':'')+') placerade efter <strong>komplexitet</strong> och <strong>emotionell känslighet</strong>. Placeringen är en illustrativ modell — validera mot er egen bedömning per typ innan beslut.</div>';
  if(!items.length){
    el.innerHTML=htmlStr+'<div class="ae-empty">Ingen ärendetypsdata tillgänglig från API:et.</div>';return;
  }
  htmlStr+='<div class="chart-wrap" style="height:380px;margin-bottom:16px"><h4>Beslutsmatris: komplexitet × känslighet</h4><canvas id="cxMatrixChart"></canvas></div>';
  htmlStr+='<div class="ae-legend" style="margin-bottom:16px">'
    +leg('#34c759','Automatisera + mänsklig reservväg')+leg('#0071e3','AI-först med enkel eskalering')
    +leg('#ff9500','AI stöttar agenten')+leg('#ff3b30','Människa äger · AI ger beslutsstöd')+'</div>';
  htmlStr+='<div class="tw"><table><thead><tr><th>Ärendetyp</th><th class="r">Volym</th>'
    +(items[0].fcrPct!=null?'<th class="r">FCR-proxy</th>':'')
    +'<th class="r">Komplexitet</th><th class="r">Känslighet</th><th>Rekommendation</th></tr></thead><tbody>'
    +items.map(function(it){
      return '<tr><td style="font-weight:600">'+h(it.name)+'</td><td class="n">'+it.count.toLocaleString('sv-SE')+'</td>'
        +(it.fcrPct!=null?'<td class="n">'+pct(it.fcrPct)+'</td>':'')
        +'<td class="n">'+it.c+'</td><td class="n">'+it.s+'</td>'
        +'<td><span class="tag" style="background:'+it.rec.color+'1a;color:'+it.rec.color+'">'+h(it.rec.label)+'</span></td></tr>';
    }).join('')+'</tbody></table></div>';
  htmlStr+='<div class="ae-note">Kvadrantlogik: låg komplexitet + låg känslighet → automatisera tryggt med reservväg. Hög komplexitet → AI stöttar agenten med kontext och förslag. Hög känslighet (uppsägning, klagomål, GDPR) → en erfaren människa äger dialogen medan AI levererar historik och beslutsstöd — där är förtroende viktigare än snabbhet.</div>';
  el.innerHTML=htmlStr;
  _matrixRendered=false;
  renderMatrixChart();
}
function renderMatrixChart(){
  if(typeof Chart==='undefined'||_matrixRendered)return;
  var cv=document.getElementById('cxMatrixChart');if(!cv)return;
  var panel=document.getElementById('cx-panel-matris');
  if(panel&&!panel.classList.contains('active'))return; // rendera först när panelen syns
  var items=matrixItems();if(!items.length)return;
  killChart('matrix');
  var maxV=Math.max.apply(null,items.map(function(i){return i.count;}))||1;
  var quadrantPlugin={id:'cxQuadrants',beforeDraw:function(chart){
    var a=chart.chartArea,x=chart.scales.x,y=chart.scales.y,ctx=chart.ctx;
    var mx=x.getPixelForValue(50),my=y.getPixelForValue(70);
    ctx.save();
    ctx.fillStyle='rgba(255,59,48,0.05)';ctx.fillRect(a.left,a.top,a.right-a.left,my-a.top);
    ctx.fillStyle='rgba(52,199,89,0.06)';ctx.fillRect(a.left,my,mx-a.left,a.bottom-my);
    ctx.fillStyle='rgba(255,149,0,0.05)';ctx.fillRect(mx,my,a.right-mx,a.bottom-my);
    ctx.strokeStyle='rgba(0,0,0,0.08)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(mx,a.top);ctx.lineTo(mx,a.bottom);ctx.moveTo(a.left,my);ctx.lineTo(a.right,my);ctx.stroke();
    ctx.fillStyle='rgba(110,110,115,0.55)';ctx.font='600 10px -apple-system,sans-serif';
    ctx.fillText('MÄNNISKA ÄGER · AI-STÖD',a.left+8,a.top+14);
    ctx.fillText('AUTOMATISERA',a.left+8,a.bottom-8);
    ctx.fillText('AI STÖTTAR AGENTEN',mx+8,a.bottom-8);
    ctx.restore();
  }};
  _charts['matrix']=new Chart(cv.getContext('2d'),{type:'bubble',
    data:{datasets:items.map(function(it){
      return {label:it.name,data:[{x:it.c,y:it.s,r:6+Math.sqrt(it.count/maxV)*18}],
        backgroundColor:it.rec.color+'99',borderColor:it.rec.color,borderWidth:1.5};
    })},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        tooltip:{callbacks:{label:function(c){var it=items[c.datasetIndex];
          return it.name+' · '+it.count.toLocaleString('sv-SE')+' ärenden · '+it.rec.label;}}}},
      scales:{x:{min:0,max:100,title:{display:true,text:'Komplexitet →',color:'#6e6e73'},grid:{color:'#f1f5f9'},ticks:{color:'#aeaeb2'}},
        y:{min:0,max:100,title:{display:true,text:'Emotionell känslighet →',color:'#6e6e73'},grid:{color:'#f1f5f9'},ticks:{color:'#aeaeb2'}}}},
    plugins:[quadrantPlugin]
  });
  _matrixRendered=true;
}

// ─── UNDERFLIK 4: Kundresa & friktion ───────────────────────
var CTX_LAYERS=[
  {id:'hist',  label:'Kundhistorik',        drop:18, avail:'partial', note:'Berikning via cc_ticket_meta — täckningen visas i Nuläge'},
  {id:'prev',  label:'Tidigare ärenden',    drop:16, avail:'yes',     note:'Finns i Freshdesk-historiken'},
  {id:'acct',  label:'Konto-/avtalsdata',   drop:14, avail:'no',      note:'Ej kopplad till ärendeflödet idag'},
  {id:'aisum', label:'AI-sammanfattning',   drop:12, avail:'no',      note:'Ingen automatisk sammanfattning till agent'},
  {id:'sent',  label:'Sentimentanalys',     drop:8,  avail:'no',      note:'Ingen sentiment-signal idag'}
];
var _ctxState={};
function renderResa(){
  var el=document.getElementById('cx-panel-resa');if(!el)return;
  var items=matrixItems().slice(0,3);
  var htmlStr='<div class="ae-sub">'+(items.length?'Rekommenderad kundresa för era '+items.length+' största ärendetyper, plus en friktionsmodell:':'Friktionsmodell för kundresan:')+' varje kontextlager ni kopplar på sänker kundens friktion (utgångsläge utan kontext ≈ 92/100 — illustrativ modell, samma logik som CX 2026-sidans kontextsimulator).</div>';

  // Friktionssimulator
  htmlStr+='<div class="card" style="margin-bottom:20px"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">'
    +'<div style="font-size:14px;font-weight:700">Kontextlager & friktion</div>'
    +'<div><span style="font-size:11px;color:var(--text3);margin-right:8px">Friktionspoäng</span><span id="cx-friction-score" style="font-size:26px;font-weight:700"></span><span style="font-size:12px;color:var(--text3)">/100</span></div></div>'
    +'<div id="cx-ctx-layers" class="cx-ctx-grid"></div>'
    +'<div style="font-size:11px;color:var(--text3);margin-top:10px">Grönt = finns i er stack idag · gult = delvis · rött = saknas. Bocka i/ur för att se effekten av att bygga bort gapen.</div></div>';

  // Kundresor
  htmlStr+=items.map(function(it,idx){
    var steps=journeyFor(it);
    return '<div class="card" style="margin-bottom:14px">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:4px">'
      +'<div style="font-size:14px;font-weight:700">'+(idx+1)+'. '+h(it.name)+' <span style="font-weight:400;font-size:12px;color:var(--text3)">· '+it.count.toLocaleString('sv-SE')+' ärenden</span></div>'
      +'<span class="tag" style="background:'+it.rec.color+'1a;color:'+it.rec.color+'">'+h(it.rec.label)+'</span></div>'
      +'<div class="cx-journey">'+steps.map(function(st,i){
        return '<div class="cx-step"><div class="cx-step-no">'+(i+1)+'</div><div><div style="font-size:12.5px;font-weight:600;color:var(--text)">'+h(st.t)+'</div>'
          +(st.f?'<div style="font-size:11px;color:var(--red);margin-top:3px">⚠ Friktion idag: '+h(st.f)+'</div>':'')
          +'</div></div>';
      }).join('')+'</div></div>';
  }).join('');
  if(!items.length)htmlStr+='<div class="ae-empty">Ingen ärendetypsdata — kundresor kan inte genereras.</div>';
  el.innerHTML=htmlStr;

  CTX_LAYERS.forEach(function(l){if(!(l.id in _ctxState))_ctxState[l.id]=(l.avail==='yes');});
  renderCtxLayers();
}
function journeyFor(it){
  var enrichPct=S.enrich?parseFloat(S.enrich.coverage_pct||0):null;
  var ctxFr=(enrichPct!=null&&enrichPct<95)?'~'+(100-Math.round(enrichPct))+'% av ärendena saknar berikad kontext — kunden får upprepa sig':null;
  if(it.rec.key==='auto'||it.rec.key==='aifirst')return [
    {t:'Kunden ställer frågan i valfri kanal',f:null},
    {t:'AI identifierar kund och hämtar historik + kontext',f:ctxFr},
    {t:'AI löser ärendet direkt och förklarar hur',f:it.fcrPct!=null?'FCR-proxy för typen: '+pct(it.fcrPct)+' — lösningsgraden måste verifieras innan full automatisering':null},
    {t:'Tydlig mänsklig reservväg erbjuds i samma tråd',f:'Ingen definierad eskaleringsväg i AI-flödet idag'},
    {t:'Uppföljning: CES-mätning + lösningsverifiering (ingen återkontakt 7 dgr)',f:'CES och återkontakt mäts inte'}
  ];
  if(it.rec.key==='assist')return [
    {t:'AI tar emot, sammanfattar ärendet och samlar kontext',f:'AI-sammanfattning saknas — agenten läser rått'},
    {t:'Routning till rätt agent med full historik',f:ctxFr},
    {t:'Agenten löser med AI-förslag och kunskapsstöd',f:null},
    {t:'AI dokumenterar lösningen tillbaka till historiken',f:'Sker manuellt idag — kontext tappas till nästa kontakt'},
    {t:'Uppföljning: lösningsverifiering + CSAT per typ',f:'CSAT finns inte per ärendetyp'}
  ];
  return [
    {t:'Direktroutning till erfaren agent — ingen bot-vägg',f:null},
    {t:'AI levererar historik, avtalsdata och risksignal till agenten',f:'Konto-/avtalsdata och sentiment saknas som kopplade lager'},
    {t:'Människan äger dialogen · förtroende före snabbhet',f:null},
    {t:'Beslut förklaras och dokumenteras — full spårbarhet',f:'Ingen transparens-rutin för AI-stödda beslut'},
    {t:'Proaktiv uppföljning inom 48h',f:'Ingen systematisk uppföljning av känsliga ärenden'}
  ];
}
function renderCtxLayers(){
  var wrap=document.getElementById('cx-ctx-layers');if(!wrap)return;
  var score=92;
  CTX_LAYERS.forEach(function(l){if(_ctxState[l.id])score-=l.drop;});
  score=Math.max(20,score);
  wrap.innerHTML=CTX_LAYERS.map(function(l){
    var col=l.avail==='yes'?'var(--green)':l.avail==='partial'?'var(--amber)':'var(--red)';
    var st=l.avail==='yes'?'Finns':l.avail==='partial'?'Delvis':'Saknas';
    return '<label class="cx-ctx-item" style="border-left:3px solid '+col+'">'
      +'<input type="checkbox" '+(_ctxState[l.id]?'checked':'')+' onchange="cxToggleLayer(\''+l.id+'\')">'
      +'<div><div style="font-size:12.5px;font-weight:600">'+h(l.label)+' <span style="font-size:10px;font-weight:600;color:'+col+'">· '+st+'</span> <span style="font-size:10px;color:var(--text3)">−'+l.drop+'p</span></div>'
      +'<div style="font-size:11px;color:var(--text3)">'+h(l.note)+'</div></div></label>';
  }).join('');
  var sc=document.getElementById('cx-friction-score');
  if(sc){sc.textContent=score;sc.style.color=score>=70?'var(--red)':score>=45?'var(--amber)':'var(--green)';}
}
window.cxToggleLayer=function(id){_ctxState[id]=!_ctxState[id];renderCtxLayers();};

// ─── UNDERFLIK 5: Styrmått ──────────────────────────────────
function renderStyrmatt(){
  var el=document.getElementById('cx-panel-styrmatt');if(!el)return;
  var fcr=fcrTotal(),aht=latestWeightedAht();
  var rows=[
    {kpi:'Första svarstid (SLA)',now:'Mäts idag',val:'—',rec:'Behåll som basmått — men sluta styra på den ensam',cls:'ok'},
    {kpi:'AHT',now:'Mäts idag',val:aht?aht.aht.toFixed(0)+' min (vägd)':'–',rec:'Använd som kapacitetsmått i FTE-modellen, inte som kvalitetsmål',cls:'ok'},
    {kpi:'Faktisk lösningsgrad',now:'Proxy (fcr_count)',val:fcr?pct(fcr.pct):'–',rec:'Uppgradera till primärt styrmått: verifiera med "ingen återkontakt inom 7 dagar"',cls:'warn'},
    {kpi:'Kundansträngning (CES)',now:'Mäts inte',val:'—',rec:'Inför per ärende — viktigaste nya måttet enligt trend 2',cls:'crit'},
    {kpi:'Återkontakt / reopens',now:'Mäts inte',val:'—',rec:'Inför — krävs för att skilja snabba svar från verkliga lösningar',cls:'crit'},
    {kpi:'CSAT per ärendetyp & flöde',now:'Delvis (per månad/pool)',val:'—',rec:'Segmentera per ärendetyp och AI/människa-flöde för att styra matrisen',cls:'warn'},
    {kpi:'AI-deflection med kvalitetsgolv',now:'Scenario (30%)',val:'—',rec:'Mät deflection ihop med lösningsgrad + CES — aldrig deflection ensamt',cls:'warn'},
    {kpi:'Eskaleringsgrad AI → människa',now:'Mäts inte',val:'—',rec:'Inför när automatisering piloteras — hälsosignal för reservvägen',cls:'crit'}
  ];
  el.innerHTML='<div class="ae-sub">Kärninsikten från trend 2: byt styrning från <strong>svarstid</strong> till <strong>lösningsgrad och kundansträngning</strong>. Tabellen visar var er mätning står idag och vad som bör införas.</div>'
    +'<div class="tw"><table><thead><tr><th>Styrmått</th><th>Status idag</th><th class="r">Värde (live)</th><th>Rekommendation</th></tr></thead><tbody>'
    +rows.map(function(r){
      var tag=r.cls==='ok'?'<span class="tag ok">'+h(r.now)+'</span>':r.cls==='warn'?'<span class="tag warn">'+h(r.now)+'</span>':'<span class="tag crit">'+h(r.now)+'</span>';
      return '<tr><td style="font-weight:600">'+h(r.kpi)+'</td><td>'+tag+'</td><td class="n">'+h(r.val)+'</td><td style="font-size:12px;color:var(--text2)">'+h(r.rec)+'</td></tr>';
    }).join('')+'</tbody></table></div>'
    +'<div class="ae-note">FCR-proxyn bygger på fcr_count-flaggan i ärendedatan och är inte en verifierad lösningsgrad. Innan styrmåtten byts: definiera varje KPI skriftligt (en källa per mått) — se trend 4 om samtalsstyrd analys.</div>';
}

// ─── UNDERFLIK 6: Handlingsplan ─────────────────────────────
function renderPlan(){
  var el=document.getElementById('cx-panel-plan');if(!el)return;
  var enrichPct=S.enrich?parseFloat(S.enrich.coverage_pct||0):null;
  var steps=[
    {t:'Datagrund först: höj berikningen till ≥95% och koppla konto-/avtalsdata',
     d:'Idag är '+(enrichPct!=null?pct(enrichPct):'okänd andel')+' av tickets berikade. Utan sammanhängande kontext skalar automatisering upp en dålig upplevelse (trend 1).',
     effort:'Låg',effect:'Hög',first:true},
    {t:'Fixa supply-historiken (P4 → Edge Function)',
     d:'dailyRosteredFte är statisk över alla månader. Uppdatera /aht-stats att läsa cc_pool_supply_history per månad så kapacitets- och gapanalysen blir verklig.',
     effort:'Låg',effect:'Medel',first:true},
    {t:'Byt styrmått: inför lösningsgrad, CES och återkontakt',
     d:'Definiera KPI:erna skriftligt med en källa per mått. Sluta styra på svarstid ensam — det belönar snabba men verkningslösa svar (trend 2).',
     effort:'Medel',effect:'Hög',first:false},
    {t:'Segmentera ärendetyper enligt beslutsmatrisen och kör en pilot',
     d:'Automatisera den största låg-komplexitet/låg-känslighetstypen med mänsklig reservväg. Mät deflection + lösningsgrad + CES tillsammans.',
     effort:'Medel',effect:'Hög',first:false},
    {t:'Samla alla kanaler och format i en gemensam ärendehistorik',
     d:'Logga kanal/format per kontakt så kontext inte tappas vid kanalbyte (trend 3). Förutsättning för minnesrik AI över hela resan.',
     effort:'Hög',effect:'Medel',first:false},
    {t:'Bygg in AI-transparens innan deflection-målet jagas',
     d:'Varje AI-beslut ska förklaras med enkelt språk och alltid erbjuda väg till människa (trend 5). Mät eskaleringsgraden som hälsosignal.',
     effort:'Låg',effect:'Medel',first:false},
    {t:'Reservera människor för det känsliga — och mät förtroende',
     d:'Uppsägnings-, klagomåls- och GDPR-ärenden ägs av senior agent med AI-beslutsstöd. Följ upp med CSAT/förtroende per segment, inte snabbhet.',
     effort:'Medel',effect:'Hög',first:false}
  ];
  el.innerHTML='<div class="ae-sub">Prioriterad ordning: <strong>datagrund före automatisering</strong>. Steg markerade "Börja här" ger mest effekt snabbast och är förutsättningar för resten.</div>'
    +steps.map(function(s,i){
      return '<div class="card'+(s.first?' hl':'')+'" style="margin-bottom:12px;display:flex;gap:14px;align-items:flex-start">'
        +'<div class="cx-step-no" style="flex-shrink:0">'+(i+1)+'</div>'
        +'<div style="flex:1"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">'
        +'<div style="font-size:13.5px;font-weight:700">'+h(s.t)+'</div>'
        +'<div style="display:flex;gap:6px">'+(s.first?'<span class="tag info">Börja här</span>':'')
        +'<span class="tag planning">Insats: '+s.effort+'</span><span class="tag analytics">Effekt: '+s.effect+'</span></div></div>'
        +'<div style="font-size:12px;color:var(--text2);line-height:1.55;margin-top:5px">'+h(s.d)+'</div></div></div>';
    }).join('')
    +'<div class="ae-note"><strong>Källkritisk not:</strong> Benchmark-procenten kommer från Zendesk CX Trends 2026 — en aktör som säljer just dessa lösningar. Riktningsgivande, inte oberoende. Matris- och friktionspoängen är illustrativa modeller, inte mätvärden. Validera mot egen kunddata (särskilt lösningsgrad, CES och återkontakt när de börjar mätas) innan investeringsbeslut.</div>';
}

// ─── Underflik-navigering + init ────────────────────────────
window.showCxSub=function(id,btn){
  document.querySelectorAll('#tab-cx .cx-panel').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('#tab-cx .cx-sub-btn').forEach(function(b){b.classList.remove('active');});
  var p=document.getElementById('cx-panel-'+id);
  if(p)p.classList.add('active');
  if(btn)btn.classList.add('active');
  if(id==='matris')renderMatrixChart(); // canvas kräver synlig panel
};

window.initCxTab=function(){
  window._cxL=true;
  var jobs=[
    api('/overview').then(function(d){S.overview=d;}).catch(function(e){S.errors.push('/overview: '+(e.message||e));}),
    api('/aht-stats?months=12').then(function(d){S.aht=d;}).catch(function(e){S.errors.push('/aht-stats: '+(e.message||e));}),
    api('/enrich-status').then(function(d){S.enrich=d;}).catch(function(e){S.errors.push('/enrich-status: '+(e.message||e));}),
    rpcCategoryStats().then(function(d){S.cats=d;}).catch(function(e){S.errors.push('kategoristatistik: '+(e.message||e));})
  ];
  Promise.all(jobs).then(function(){
    renderNulage();
    renderTrender();
    renderMatris();
    renderResa();
    renderStyrmatt();
    renderPlan();
  });
};

})();
