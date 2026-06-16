// js/tab-cc-kpi.js v3 — CC KPI section
// Fix: td layout uses span wrappers, not display:flex on td (breaks table)

(function () {
  'use strict';

  const KPI_DEFS = [
    { id: 'fr_sla',  label: 'First Response SLA',   unit: '%',  target: 90,  higherIsBetter: true },
    { id: 'res_sla', label: 'Resolution SLA',        unit: '%',  target: 85,  higherIsBetter: true },
    { id: 'fcr',     label: 'FCR',                   unit: '%',  target: 75,  higherIsBetter: true },
    { id: 'csat',    label: 'CSAT',                  unit: '/5', target: 4.2, higherIsBetter: true },
    { id: 'tpd',     label: 'Tickets / Agent / Day', unit: '',   target: 20,  higherIsBetter: true },
  ];

  const PRODUCTS = ['Simployer Classic', 'Simployer One', 'Expert NO', 'Frankly', 'Talent'];
  const AGENTS   = ['Therese N.', 'Emil G.', 'Kari K.', 'Martin A.', 'Arkadiusz Z.',
                    'Mats L.', 'Ilse L.', 'Ian M.', 'Honya M.', 'Anett N.'];

  // Wang hash — full avalanche, safe for sequential seeds
  function wangHash(n) {
    n = n >>> 0;
    n = ((n ^ 61) ^ (n >>> 16)) >>> 0;
    n = (n + (n << 3)) >>> 0;
    n = (n ^ (n >>> 4)) >>> 0;
    n = Math.imul(n, 0x27d4eb2d) >>> 0;
    n = (n ^ (n >>> 15)) >>> 0;
    return n / 4294967295;
  }

  // Distinct randomness for (seed, periodIdx, kpiIndex)
  function rng(seed, pidx, kidx) {
    return wangHash((seed ^ (pidx * 2654435761) ^ (kidx * 40503)) >>> 0);
  }
  function rng2(seed, pidx, kidx) {
    return wangHash(((seed * 6271) ^ (pidx * 1013904223) ^ kidx) >>> 0);
  }

  // KPI profiles: base, σ, weekly trend, min, max
  const KPI_P = {
    fr_sla:  { base: 88.0, sd: 4.5,  trend: 0.15, lo: 70, hi: 98 },
    res_sla: { base: 82.5, sd: 5.0,  trend: 0.10, lo: 65, hi: 96 },
    fcr:     { base: 71.5, sd: 5.5,  trend: 0.18, lo: 55, hi: 89 },
    csat:    { base: 4.02, sd: 0.22, trend: 0.005,lo: 3.4, hi: 4.8 },
    tpd:     { base: 18.8, sd: 3.2,  trend: 0.08, lo: 11, hi: 34 },
  };

  function kpiVal(kpiId, pidx, total, seed) {
    const p = KPI_P[kpiId];
    // Box-Muller normal approximation
    const u1 = Math.max(1e-9, rng(seed, pidx, 1));
    const u2 = rng2(seed, pidx, 2);
    const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    // Trend (improves over window) + seasonal dip every 4th period
    const trend    = p.trend * pidx;
    const seasonal = (pidx % 4 === 0) ? -p.sd * 0.5 : 0;
    const raw      = p.base + trend + z * p.sd + seasonal;
    const val      = Math.max(p.lo, Math.min(p.hi, raw));
    return kpiId === 'csat' ? +val.toFixed(2) : +val.toFixed(1);
  }

  // Helpers
  function wn(d) {
    const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay() || 7));
    return Math.ceil((((dt - new Date(Date.UTC(dt.getUTCFullYear(),0,1)))/86400000)+1)/7);
  }

  function hSeed(n) { return (wangHash(n * 2654435761 >>> 0) * 1e9) | 0; }

  function getDayRows() {
    const now = new Date(), mon = new Date(now);
    mon.setDate(now.getDate() - ((now.getDay()+6)%7));
    return Array.from({length:7},(_,d)=>{
      const dt = new Date(mon); dt.setDate(mon.getDate()+d);
      return { label: dt.toLocaleDateString('sv-SE',{weekday:'short',month:'numeric',day:'numeric'}),
               seed: hSeed(dt.getFullYear()*10000+(dt.getMonth()+1)*100+dt.getDate()),
               isFuture: dt>now, pidx: d };
    });
  }
  function getWeekRows() {
    const now = new Date();
    return Array.from({length:12},(_,i)=>{
      const start = new Date(now);
      start.setDate(now.getDate()-((now.getDay()+6)%7)-(11-i)*7);
      const end = new Date(start); end.setDate(start.getDate()+6);
      const w = wn(start);
      return { label: 'v'+w+' ('+start.toLocaleDateString('sv-SE',{month:'numeric',day:'numeric'})+'-'+end.toLocaleDateString('sv-SE',{month:'numeric',day:'numeric'})+')',
               seed: hSeed(start.getFullYear()*1000+w), pidx: i };
    });
  }
  function getMonthRows() {
    const now = new Date();
    return Array.from({length:12},(_,i)=>{
      const dt = new Date(now.getFullYear(),now.getMonth()-(11-i),1);
      return { label: dt.toLocaleDateString('sv-SE',{year:'numeric',month:'short'}),
               seed: hSeed(dt.getFullYear()*100+dt.getMonth()), pidx: i };
    });
  }

  function statusCls(kpi,val) {
    const r = val/kpi.target;
    return r>=1?'cc-ok':r>=0.93?'cc-warn':'cc-crit';
  }
  function dot(kpi,val) {
    const c=statusCls(kpi,val),clr=c==='cc-ok'?'#28a745':c==='cc-warn'?'#ffc107':'#dc3545';
    return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+clr+';margin-right:4px;vertical-align:middle"></span>';
  }
  function arrow(a,b) {
    if(b===null||b===undefined) return '<span style="color:#999">–</span>';
    const d=a-b;
    return Math.abs(d)<0.05?'<span style="color:#999">→</span>':
           d>0?'<span style="color:#28a745">▲</span>':'<span style="color:#dc3545">▼</span>';
  }
  function spark(vals,target,color) {
    if(!vals||vals.length<2) return '';
    const W=80,H=24,all=[...vals,target],mn=Math.min(...all)*0.97,mx=Math.max(...all)*1.03,rng=mx-mn||1;
    const pts=vals.map((v,i)=>((i/(vals.length-1))*W).toFixed(1)+','+((H-(v-mn)/rng*H)).toFixed(1)).join(' ');
    const ty=(H-(target-mn)/rng*H).toFixed(1);
    const lx=((vals.length-1)/(vals.length-1)*W).toFixed(1),ly=(H-(vals[vals.length-1]-mn)/rng*H).toFixed(1);
    return '<svg width="'+W+'" height="'+H+'" style="vertical-align:middle">'+
      '<line x1="0" y1="'+ty+'" x2="'+W+'" y2="'+ty+'" stroke="#ccc" stroke-dasharray="2,2" stroke-width="1"/>'+
      '<polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="1.5"/>'+
      '<circle cx="'+lx+'" cy="'+ly+'" r="2.5" fill="'+color+'"/></svg>';
  }
  function csv(id) {
    const t=document.getElementById(id);if(!t)return;
    const rows=[...t.querySelectorAll('tr')].map(r=>[...r.querySelectorAll('th,td')].map(c=>'"'+c.innerText.replace(/"/g,'""')+'"').join(','));
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'}));
    a.download=id+'.csv';a.click();
  }

  function injectCSS() {
    if(document.getElementById('cc-kpi-styles')) return;
    const s=document.createElement('style');
    s.id='cc-kpi-styles';
    s.textContent=`
      .cc-kpi-section{margin-top:24px}
      .cc-live-bar{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
      .cc-dot{width:10px;height:10px;border-radius:50%;background:#28a745;animation:ccPulse 1.5s infinite;flex-shrink:0}
      @keyframes ccPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}
      .cc-view-btns{display:flex;gap:4px;margin-left:auto}
      .cc-vbtn{padding:3px 10px;font-size:11px;border:1px solid var(--border);border-radius:4px;background:none;color:var(--text3);cursor:pointer}
      .cc-vbtn.active{background:var(--accent);color:#fff;border-color:var(--accent)}
      .cc-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:16px}
      .cc-card{background:#fff;border:1px solid var(--border);border-radius:8px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.06);position:relative;cursor:pointer}
      .cc-card:hover{box-shadow:0 3px 8px rgba(0,0,0,.12)}
      .cc-card.cc-ok{border-left:3px solid #28a745}
      .cc-card.cc-warn{border-left:3px solid #ffc107}
      .cc-card.cc-crit{border-left:3px solid #dc3545}
      .cc-cl{font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
      .cc-cv{font-size:26px;font-weight:700;line-height:1}
      .cc-ok{color:#28a745}.cc-warn{color:#ffc107}.cc-crit{color:#dc3545}
      .cc-xbtn{position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;color:#999;font-size:14px;padding:2px 4px;border-radius:3px}
      .cc-bd{display:none;border:1px solid var(--border);border-radius:8px;background:#fff;padding:14px;margin-top:8px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
      .cc-bd.open{display:block}
      .cc-bdtabs{display:flex;gap:4px;margin-bottom:10px}
      .cc-bdtab{padding:4px 12px;font-size:11px;border:1px solid var(--border);border-radius:4px;background:none;cursor:pointer}
      .cc-bdtab.active{background:#e8f5e9;border-color:#28a745;color:#28a745;font-weight:600}
      .cc-bdp{display:none}.cc-bdp.active{display:block}
      .cct{width:100%;border-collapse:collapse;font-size:12px}
      .cct th{background:#f8f9fa;padding:6px 10px;text-align:left;font-weight:600;color:var(--text3);border-bottom:2px solid var(--border);cursor:pointer;white-space:nowrap;user-select:none}
      .cct th:hover{background:#eee}
      .cct td{padding:5px 10px;border-bottom:1px solid #f0f0f0;white-space:nowrap}
      .cct tr:nth-child(even) td{background:#fafafa}
      .cct tr:hover td{background:#f0f7ff}
      .cct tr.fut td{color:#bbb;font-style:italic}
      .cc-bar{height:6px;border-radius:3px;display:inline-block;vertical-align:middle;margin-left:5px}
      .cc-csvbtn{font-size:10px;padding:2px 7px;border:1px solid #ccc;border-radius:3px;background:#fff;cursor:pointer;color:#666;margin-bottom:6px}
      .tag.analytics{background:#fff3e0;color:#e65100}
    `;
    document.head.appendChild(s);
  }

  let _view='day', _timer=null;

  function render() {
    const cont=document.getElementById('cc-kpi-section');
    if(!cont) return;
    injectCSS();
    const rows = _view==='day'?getDayRows():_view==='week'?getWeekRows():getMonthRows();
    const N = rows.length;

    // Latest non-future row for summary cards
    let latestIdx = rows.length-1;
    for(let i=rows.length-1;i>=0;i--) { if(!rows[i].isFuture){latestIdx=i;break;} }
    const LR = rows[latestIdx];
    const PR = latestIdx>0 ? rows[latestIdx-1] : null;

    // Summary cards
    let cards = '';
    KPI_DEFS.forEach(function(kpi) {
      const lv  = kpiVal(kpi.id, LR.pidx, N, LR.seed);
      const pv  = PR ? kpiVal(kpi.id, PR.pidx, N, PR.seed) : null;
      const sc  = statusCls(kpi, lv);
      const d   = pv!==null ? (lv-pv).toFixed(kpi.id==='csat'?2:1) : null;
      const sgn = d!==null && +d>=0 ? '+' : '';
      const sVals = rows.filter(function(r){return !r.isFuture;}).slice(-7).map(function(r){return kpiVal(kpi.id,r.pidx,N,r.seed);});
      const clr = sc==='cc-ok'?'#28a745':sc==='cc-warn'?'#ffc107':'#dc3545';
      const dv  = kpi.id==='csat'?lv.toFixed(2):lv.toFixed(1);
      cards += '<div class="cc-card '+sc+'" id="cc-card-'+kpi.id+'" onclick="toggleCCBd(''+kpi.id+'')">';
      cards += '<button class="cc-xbtn">v</button>';
      cards += '<div class="cc-cl">'+kpi.label+'</div>';
      cards += '<div><span class="cc-cv '+sc+'">'+dv+'</span><span style="font-size:13px;color:var(--text3);margin-left:2px">'+kpi.unit+'</span></div>';
      cards += '<div style="font-size:11px;margin-top:4px;color:#666">'+arrow(lv,pv)+(d!==null?' '+sgn+d+' vs föregående':'')+'</div>';
      cards += '<div style="margin-top:5px">'+spark(sVals,kpi.target,clr)+'</div>';
      cards += '<div style="font-size:10px;color:#999;margin-top:2px">Mål: '+kpi.target+kpi.unit+'</div>';
      cards += '</div>';
    });

    // Breakdown panels
    let bds = '';
    KPI_DEFS.forEach(function(kpi) {
      const prd = PRODUCTS.map(function(p,i){
        const s2 = hSeed((LR.seed*31+i*17)>>>0);
        return {name:p, val:kpiVal(kpi.id, LR.pidx, N, s2+i)};
      });
      const agt = AGENTS.map(function(a,i){
        const s2 = hSeed((LR.seed*13+i*41)>>>0);
        return {name:a, val:kpiVal(kpi.id, LR.pidx, N, s2+i*3)};
      });
      const mxP = Math.max.apply(null,prd.map(function(x){return x.val;}));
      const mxA = Math.max.apply(null,agt.map(function(x){return x.val;}));

      let pRows=''; prd.forEach(function(p){
        const sc=statusCls(kpi,p.val),clr=sc==='cc-ok'?'#28a745':sc==='cc-warn'?'#ffc107':'#dc3545';
        const dv=kpi.id==='csat'?p.val.toFixed(2):p.val.toFixed(1);
        const w=Math.round(p.val/mxP*100);
        pRows+='<tr><td>'+p.name+'</td><td><span class="'+sc+'">'+dv+kpi.unit+'</span><span class="cc-bar" style="width:'+w+'px;background:'+clr+'"></span></td></tr>';
      });
      const sortedAgt = agt.slice().sort(function(a,b){return b.val-a.val;});
      let aRows=''; sortedAgt.forEach(function(a){
        const sc=statusCls(kpi,a.val),clr=sc==='cc-ok'?'#28a745':sc==='cc-warn'?'#ffc107':'#dc3545';
        const dv=kpi.id==='csat'?a.val.toFixed(2):a.val.toFixed(1);
        const w=Math.round(a.val/mxA*100);
        const ini=a.name.split(/[. ]/g).filter(Boolean).slice(0,2).map(function(x){return x[0];}).join('');
        aRows+='<tr><td><span style="background:#e3f2fd;color:#1565c0;border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;margin-right:5px;vertical-align:middle">'+ini+'</span>'+a.name+'</td>'+
               '<td><span class="'+sc+'">'+dv+kpi.unit+'</span><span class="cc-bar" style="width:'+w+'px;background:'+clr+'"></span></td></tr>';
      });
      const idP='ccbdp-'+kpi.id, idA='ccbda-'+kpi.id;
      bds+='<div class="cc-bd" id="cc-bd-'+kpi.id+'">';
      bds+='<div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:8px">'+kpi.label+' – Breakdown (senaste period)</div>';
      bds+='<div class="cc-bdtabs">';
      bds+='<button class="cc-bdtab active" onclick="event.stopPropagation();ccBdTab(''+kpi.id+'','prod',this)">Per produkt</button>';
      bds+='<button class="cc-bdtab" onclick="event.stopPropagation();ccBdTab(''+kpi.id+'','agent',this)">Per agent</button>';
      bds+='</div>';
      bds+='<div class="cc-bdp active" id="'+idP+'">';
      bds+='<button class="cc-csvbtn" onclick="event.stopPropagation();ccCSV(''+idP+'')">Export CSV</button>';
      bds+='<table class="cct" id="'+idP+'"><thead><tr><th>Produkt</th><th>'+kpi.label+'</th></tr></thead><tbody>'+pRows+'</tbody></table></div>';
      bds+='<div class="cc-bdp" id="'+idA+'">';
      bds+='<button class="cc-csvbtn" onclick="event.stopPropagation();ccCSV(''+idA+'')">Export CSV</button>';
      bds+='<table class="cct" id="'+idA+'"><thead><tr><th>Agent</th><th>'+kpi.label+'</th></tr></thead><tbody>'+aRows+'</tbody></table></div>';
      bds+='</div>';
    });

    // Main table
    const tid='cct-main-'+_view;
    let thead='<tr><th onclick="ccSort(this)">Period</th>';
    KPI_DEFS.forEach(function(k){ thead+='<th onclick="ccSort(this)">'+k.label+'</th>'; });
    thead+='</tr>';

    let tbody='';
    rows.forEach(function(row) {
      if(row.isFuture) {
        tbody+='<tr class="fut"><td>'+row.label+'</td>';
        KPI_DEFS.forEach(function(){ tbody+='<td>—</td>'; });
        tbody+='</tr>'; return;
      }
      tbody+='<tr><td>'+row.label+'</td>';
      KPI_DEFS.forEach(function(kpi) {
        const v  = kpiVal(kpi.id, row.pidx, N, row.seed);
        const sc = statusCls(kpi, v);
        const dv = kpi.id==='csat'?v.toFixed(2):v.toFixed(1);
        tbody+='<td>'+dot(kpi,v)+'<span class="'+sc+'">'+dv+kpi.unit+'</span></td>';
      });
      tbody+='</tr>';
    });

    const vLabel = _view==='day'?'Dag-för-dag (innevarande vecka)':_view==='week'?'Veckoredovisning (senaste 12 veckor)':'Månadsredovisning (senaste 12 månader)';
    const ts = new Date().toLocaleTimeString('sv-SE');

    cont.innerHTML =
      '<div class="cc-kpi-section">'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'+
        '<span class="section-title">§ CC · Customer Care Performance</span>'+
        '<span class="tag analytics">ANALYTICS</span>'+
      '</div>'+
      '<div class="cc-live-bar">'+
        '<div class="cc-dot"></div>'+
        '<span style="font-size:12px;color:#666">Live · Uppdateras var 60s · Senast: '+ts+'</span>'+
        '<div class="cc-view-btns">'+
          '<button class="cc-vbtn '+(_view==='day'?'active':'')+'" onclick="setCCView('day')">Dag</button>'+
          '<button class="cc-vbtn '+(_view==='week'?'active':'')+'" onclick="setCCView('week')">Vecka</button>'+
          '<button class="cc-vbtn '+(_view==='month'?'active':'')+'" onclick="setCCView('month')">Manad</button>'+
        '</div>'+
      '</div>'+
      '<div class="cc-cards">'+cards+'</div>'+
      bds+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'+
        '<span style="font-size:11px;font-weight:600;color:var(--text3)">'+vLabel+'</span>'+
        '<button class="cc-csvbtn" onclick="ccCSV(''+tid+'')">Export CSV</button>'+
      '</div>'+
      '<div style="overflow-x:auto">'+
        '<table class="cct" id="'+tid+'"><thead>'+thead+'</thead><tbody>'+tbody+'</tbody></table>'+
      '</div>'+
      '<div style="font-size:11px;color:#999;text-align:center;padding-top:6px">'+
        'CC Analytics · Simulerad data (mock) · Koppla Freshdesk API for realtidsdata'+
      '</div>'+
      '</div>';
  }

  window.setCCView    = function(v){_view=v;render();};
  window.toggleCCBd   = function(id){var e=document.getElementById('cc-bd-'+id);if(e)e.classList.toggle('open');};
  window.ccBdTab      = function(id,tab,btn){
    document.querySelectorAll('#cc-bd-'+id+' .cc-bdp').forEach(function(p){p.classList.remove('active');});
    document.querySelectorAll('#cc-bd-'+id+' .cc-bdtab').forEach(function(b){b.classList.remove('active');});
    var p=document.getElementById(tab==='prod'?'ccbdp-'+id:'ccbda-'+id);
    if(p)p.classList.add('active'); btn.classList.add('active');
  };
  window.ccSort       = function(th){
    var tbl=th.closest('table'),idx=[...th.parentNode.children].indexOf(th),asc=th.dataset.asc!=='true';
    th.dataset.asc=asc;
    var tb=tbl.querySelector('tbody');
    [...tb.querySelectorAll('tr')].sort(function(a,b){
      var av=(a.children[idx]||{innerText:''}).innerText.replace(/[^0-9.-]/g,'');
      var bv=(b.children[idx]||{innerText:''}).innerText.replace(/[^0-9.-]/g,'');
      var an=parseFloat(av),bn=parseFloat(bv);
      return !isNaN(an)&&!isNaN(bn)?(asc?an-bn:bn-an):(asc?av.localeCompare(bv):bv.localeCompare(av));
    }).forEach(function(r){tb.appendChild(r);});
  };
  window.ccCSV        = function(id){csv(id);};

  function autoRefresh(){
    if(_timer)clearInterval(_timer);
    _timer=setInterval(function(){if(document.getElementById('cc-kpi-section'))render();},60000);
  }
  window.initCCKPIs = function(){render();autoRefresh();};

})();
