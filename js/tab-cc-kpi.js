// js/tab-cc-kpi.js v4 — CC KPI section (no template literals)
// Fix: Wang-hash PRNG, realistic variance, correct td layout

(function () {
  'use strict';

  var KPI_DEFS = [
    { id: 'fr_sla',  label: 'First Response SLA',   unit: '%',  target: 90,  lo: 70,  hi: 98  },
    { id: 'res_sla', label: 'Resolution SLA',        unit: '%',  target: 85,  lo: 65,  hi: 96  },
    { id: 'fcr',     label: 'FCR',                   unit: '%',  target: 75,  lo: 55,  hi: 89  },
    { id: 'csat',    label: 'CSAT',                  unit: '/5', target: 4.2, lo: 3.4, hi: 4.8 },
    { id: 'tpd',     label: 'Tickets / Agent / Day', unit: '',   target: 20,  lo: 11,  hi: 34  }
  ];

  var PRODUCTS = ['Simployer Classic','Simployer One','Expert NO','Frankly','Talent'];
  var AGENTS   = ['Therese N.','Emil G.','Kari K.','Martin A.','Arkadiusz Z.',
                  'Mats L.','Ilse L.','Ian M.','Honya M.','Anett N.'];

  // Wang hash — full avalanche for any two sequential seeds
  function wh(n) {
    n = n >>> 0;
    n = ((n ^ 61) ^ (n >>> 16)) >>> 0;
    n = (n + (n << 3)) >>> 0;
    n = (n ^ (n >>> 4)) >>> 0;
    n = Math.imul(n, 0x27d4eb2d) >>> 0;
    n = (n ^ (n >>> 15)) >>> 0;
    return n / 4294967295;
  }
  function hSeed(n) { return (wh((n >>> 0) * 2654435761 >>> 0) * 1e9) | 0; }
  function rng1(seed, pidx, kidx) { return wh((seed ^ (pidx * 2654435761) ^ (kidx * 40503)) >>> 0); }
  function rng2(seed, pidx, kidx) { return wh(((seed * 6271) ^ (pidx * 1013904223) ^ kidx) >>> 0); }

  // Realistic per-KPI baselines with trend and noise
  var KP = {
    fr_sla:  { base: 88.0, sd: 4.5,  t: 0.15 },
    res_sla: { base: 82.5, sd: 5.0,  t: 0.10 },
    fcr:     { base: 71.5, sd: 5.5,  t: 0.18 },
    csat:    { base: 4.02, sd: 0.22, t: 0.005 },
    tpd:     { base: 18.8, sd: 3.2,  t: 0.08 }
  };

  function kpiVal(kId, pidx, seed) {
    var p = KP[kId], kdef;
    for (var i = 0; i < KPI_DEFS.length; i++) { if (KPI_DEFS[i].id === kId) { kdef = KPI_DEFS[i]; break; } }
    var u1 = Math.max(1e-9, rng1(seed, pidx, 1));
    var u2 = rng2(seed, pidx, 2);
    var z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    var raw = p.base + p.t * pidx + z * p.sd + (pidx % 4 === 0 ? -p.sd * 0.5 : 0);
    var val = Math.max(kdef.lo, Math.min(kdef.hi, raw));
    return kId === 'csat' ? +val.toFixed(2) : +val.toFixed(1);
  }

  function wn(d) {
    var dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay() || 7));
    var ys = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    return Math.ceil((((dt - ys) / 86400000) + 1) / 7);
  }

  function getDayRows() {
    var now = new Date(), mon = new Date(now), rows = [];
    mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    for (var d = 0; d < 7; d++) {
      var dt = new Date(mon); dt.setDate(mon.getDate() + d);
      rows.push({ label: dt.toLocaleDateString('sv-SE', { weekday: 'short', month: 'numeric', day: 'numeric' }),
                  seed: hSeed(dt.getFullYear()*10000+(dt.getMonth()+1)*100+dt.getDate()),
                  isFuture: dt > now, pidx: d });
    }
    return rows;
  }

  function getWeekRows() {
    var now = new Date(), rows = [];
    for (var i = 0; i < 12; i++) {
      var start = new Date(now);
      start.setDate(now.getDate() - ((now.getDay()+6)%7) - (11-i)*7);
      var end = new Date(start); end.setDate(start.getDate()+6);
      var w = wn(start);
      rows.push({ label: 'v'+w+' ('+start.toLocaleDateString('sv-SE',{month:'numeric',day:'numeric'})+'-'+end.toLocaleDateString('sv-SE',{month:'numeric',day:'numeric'})+')',
                  seed: hSeed(start.getFullYear()*1000+w), pidx: i });
    }
    return rows;
  }

  function getMonthRows() {
    var now = new Date(), rows = [];
    for (var i = 0; i < 12; i++) {
      var dt = new Date(now.getFullYear(), now.getMonth()-(11-i), 1);
      rows.push({ label: dt.toLocaleDateString('sv-SE',{year:'numeric',month:'short'}),
                  seed: hSeed(dt.getFullYear()*100+dt.getMonth()), pidx: i });
    }
    return rows;
  }

  function sCls(kpi, val) {
    var r = val / kpi.target;
    return r >= 1 ? 'cc-ok' : r >= 0.93 ? 'cc-warn' : 'cc-crit';
  }
  function dotHtml(kpi, val) {
    var c = sCls(kpi,val), col = c==='cc-ok'?'#28a745':c==='cc-warn'?'#ffc107':'#dc3545';
    return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+col+';margin-right:4px;vertical-align:middle"></span>';
  }
  function arrowHtml(a, b) {
    if (b === null || b === undefined) return '<span style="color:#999">&ndash;</span>';
    var d = a - b;
    if (Math.abs(d) < 0.05) return '<span style="color:#999">&rarr;</span>';
    return d > 0 ? '<span style="color:#28a745">&#9650;</span>' : '<span style="color:#dc3545">&#9660;</span>';
  }
  function sparkHtml(vals, target, color) {
    if (!vals || vals.length < 2) return '';
    var W=80,H=24,all=vals.concat([target]),mn=Math.min.apply(null,all)*0.97,mx=Math.max.apply(null,all)*1.03,rng=mx-mn||1;
    var pts = vals.map(function(v,i){
      return ((i/(vals.length-1))*W).toFixed(1)+','+(H-(v-mn)/rng*H).toFixed(1);
    }).join(' ');
    var ty = (H-(target-mn)/rng*H).toFixed(1);
    var lx = W.toFixed(1), ly = (H-(vals[vals.length-1]-mn)/rng*H).toFixed(1);
    return '<svg width="'+W+'" height="'+H+'" style="vertical-align:middle">'+
           '<line x1="0" y1="'+ty+'" x2="'+W+'" y2="'+ty+'" stroke="#ccc" stroke-dasharray="2,2" stroke-width="1"/>'+
           '<polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="1.5"/>'+
           '<circle cx="'+lx+'" cy="'+ly+'" r="2.5" fill="'+color+'"/></svg>';
  }
  function csvExport(id) {
    var t=document.getElementById(id); if(!t) return;
    var rows=[].slice.call(t.querySelectorAll('tr')).map(function(r){
      return [].slice.call(r.querySelectorAll('th,td')).map(function(c){return '"'+c.innerText.replace(/"/g,'""')+'"';}).join(',');
    });
    var a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'}));
    a.download=id+'.csv'; a.click();
  }

  function injectCSS() {
    if (document.getElementById('cc-kpi-styles')) return;
    var css = [
      '.cc-kpi-section{margin-top:24px}',
      '.cc-live-bar{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}',
      '.cc-dot{width:10px;height:10px;border-radius:50%;background:#28a745;animation:ccPulse 1.5s infinite;flex-shrink:0}',
      '@keyframes ccPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}',
      '.cc-view-btns{display:flex;gap:4px;margin-left:auto}',
      '.cc-vbtn{padding:3px 10px;font-size:11px;border:1px solid var(--border);border-radius:4px;background:none;color:var(--text3);cursor:pointer}',
      '.cc-vbtn.active{background:var(--accent);color:#fff;border-color:var(--accent)}',
      '.cc-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:16px}',
      '.cc-card{background:#fff;border:1px solid var(--border);border-radius:8px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.06);position:relative;cursor:pointer}',
      '.cc-card:hover{box-shadow:0 3px 8px rgba(0,0,0,.12)}',
      '.cc-card.cc-ok{border-left:3px solid #28a745}',
      '.cc-card.cc-warn{border-left:3px solid #ffc107}',
      '.cc-card.cc-crit{border-left:3px solid #dc3545}',
      '.cc-cl{font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}',
      '.cc-cv{font-size:26px;font-weight:700;line-height:1}',
      '.cc-ok{color:#28a745}.cc-warn{color:#ffc107}.cc-crit{color:#dc3545}',
      '.cc-xbtn{position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;color:#999;font-size:14px;padding:2px 4px;border-radius:3px}',
      '.cc-bd{display:none;border:1px solid var(--border);border-radius:8px;background:#fff;padding:14px;margin-top:8px;margin-bottom:16px}',
      '.cc-bd.open{display:block}',
      '.cc-bdtabs{display:flex;gap:4px;margin-bottom:10px}',
      '.cc-bdtab{padding:4px 12px;font-size:11px;border:1px solid var(--border);border-radius:4px;background:none;cursor:pointer}',
      '.cc-bdtab.active{background:#e8f5e9;border-color:#28a745;color:#28a745;font-weight:600}',
      '.cc-bdp{display:none}.cc-bdp.active{display:block}',
      '.cct{width:100%;border-collapse:collapse;font-size:12px}',
      '.cct th{background:#f8f9fa;padding:6px 10px;text-align:left;font-weight:600;color:var(--text3);border-bottom:2px solid var(--border);cursor:pointer;white-space:nowrap;user-select:none}',
      '.cct th:hover{background:#eee}',
      '.cct td{padding:5px 10px;border-bottom:1px solid #f0f0f0;white-space:nowrap}',
      '.cct tr:nth-child(even) td{background:#fafafa}',
      '.cct tr:hover td{background:#f0f7ff}',
      '.cct tr.fut td{color:#bbb;font-style:italic}',
      '.cc-bar{height:6px;border-radius:3px;display:inline-block;vertical-align:middle;margin-left:5px}',
      '.cc-csvbtn{font-size:10px;padding:2px 7px;border:1px solid #ccc;border-radius:3px;background:#fff;cursor:pointer;color:#666;margin-bottom:6px}',
      '.tag.analytics{background:#fff3e0;color:#e65100}'
    ].join('');
    var s = document.createElement('style');
    s.id = 'cc-kpi-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  var _view = 'day', _timer = null;

  function render() {
    var cont = document.getElementById('cc-kpi-section');
    if (!cont) return;
    injectCSS();
    var rows = _view === 'day' ? getDayRows() : _view === 'week' ? getWeekRows() : getMonthRows();
    var N = rows.length;

    // Latest non-future row
    var li = rows.length - 1;
    for (var x = rows.length-1; x >= 0; x--) { if (!rows[x].isFuture) { li = x; break; } }
    var LR = rows[li], PR = li > 0 ? rows[li-1] : null;

    // Summary cards
    var cards = '';
    for (var ki = 0; ki < KPI_DEFS.length; ki++) {
      var kpi = KPI_DEFS[ki];
      var lv  = kpiVal(kpi.id, LR.pidx, LR.seed);
      var pv  = PR ? kpiVal(kpi.id, PR.pidx, PR.seed) : null;
      var sc  = sCls(kpi, lv);
      var d   = pv !== null ? (lv - pv).toFixed(kpi.id === 'csat' ? 2 : 1) : null;
      var sgn = d !== null && +d >= 0 ? '+' : '';
      var sVals = [];
      for (var si = 0; si < rows.length; si++) {
        if (!rows[si].isFuture) sVals.push(kpiVal(kpi.id, rows[si].pidx, rows[si].seed));
      }
      if (sVals.length > 7) sVals = sVals.slice(-7);
      var clr = sc === 'cc-ok' ? '#28a745' : sc === 'cc-warn' ? '#ffc107' : '#dc3545';
      var dv  = kpi.id === 'csat' ? lv.toFixed(2) : lv.toFixed(1);
      cards += '<div class="cc-card '+sc+'" id="cc-card-'+kpi.id+'" onclick="toggleCCBd(\'' + kpi.id + '\')">'+
               '<button class="cc-xbtn">v</button>'+
               '<div class="cc-cl">'+kpi.label+'</div>'+
               '<div><span class="cc-cv '+sc+'">'+dv+'</span><span style="font-size:13px;color:var(--text3);margin-left:2px">'+kpi.unit+'</span></div>'+
               '<div style="font-size:11px;margin-top:4px;color:#666">'+arrowHtml(lv,pv)+(d!==null?' '+sgn+d+' vs fgaende':'')+'</div>'+
               '<div style="margin-top:5px">'+sparkHtml(sVals,kpi.target,clr)+'</div>'+
               '<div style="font-size:10px;color:#999;margin-top:2px">Mal: '+kpi.target+kpi.unit+'</div>'+
               '</div>';
    }

    // Breakdown panels
    var bds = '';
    for (var bi = 0; bi < KPI_DEFS.length; bi++) {
      var bkpi = KPI_DEFS[bi];
      var pRows = '', aRows = '';
      var pVals = [], aVals = [];
      for (var pi = 0; pi < PRODUCTS.length; pi++) {
        var ps2 = hSeed((LR.seed*31+pi*17)>>>0);
        pVals.push({ name: PRODUCTS[pi], val: kpiVal(bkpi.id, LR.pidx, ps2+pi) });
      }
      for (var ai = 0; ai < AGENTS.length; ai++) {
        var as2 = hSeed((LR.seed*13+ai*41)>>>0);
        aVals.push({ name: AGENTS[ai], val: kpiVal(bkpi.id, LR.pidx, as2+ai*3) });
      }
      var mxP = Math.max.apply(null, pVals.map(function(x){return x.val;}));
      aVals.sort(function(a,b){return b.val-a.val;});
      var mxA = Math.max.apply(null, aVals.map(function(x){return x.val;}));
      for (var pr=0;pr<pVals.length;pr++){
        var psc=sCls(bkpi,pVals[pr].val),pclr=psc==='cc-ok'?'#28a745':psc==='cc-warn'?'#ffc107':'#dc3545';
        var pw=Math.round(pVals[pr].val/mxP*100);
        var pdv=bkpi.id==='csat'?pVals[pr].val.toFixed(2):pVals[pr].val.toFixed(1);
        pRows+='<tr><td>'+pVals[pr].name+'</td><td><span class="'+psc+'">'+pdv+bkpi.unit+'</span><span class="cc-bar" style="width:'+pw+'px;background:'+pclr+'"></span></td></tr>';
      }
      for (var ar=0;ar<aVals.length;ar++){
        var asc=sCls(bkpi,aVals[ar].val),aclr=asc==='cc-ok'?'#28a745':asc==='cc-warn'?'#ffc107':'#dc3545';
        var aw=Math.round(aVals[ar].val/mxA*100);
        var adv=bkpi.id==='csat'?aVals[ar].val.toFixed(2):aVals[ar].val.toFixed(1);
        var ini=aVals[ar].name.split(/[. ]/g).filter(Boolean).slice(0,2).map(function(s){return s[0];}).join('');
        aRows+='<tr><td><span style="background:#e3f2fd;color:#1565c0;border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;margin-right:5px;vertical-align:middle">'+ini+'</span>'+aVals[ar].name+'</td>'+
               '<td><span class="'+asc+'">'+adv+bkpi.unit+'</span><span class="cc-bar" style="width:'+aw+'px;background:'+aclr+'"></span></td></tr>';
      }
      var idP='ccbdp-'+bkpi.id, idA='ccbda-'+bkpi.id;
      bds += '<div class="cc-bd" id="cc-bd-'+bkpi.id+'">'+
             '<div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:8px">'+bkpi.label+' – Breakdown (senaste period)</div>'+
             '<div class="cc-bdtabs">'+
             '<button class="cc-bdtab active" onclick="event.stopPropagation();ccBdTab(\'' + bkpi.id + '\',\'prod\',this)">Per produkt</button>'+
             '<button class="cc-bdtab" onclick="event.stopPropagation();ccBdTab(\'' + bkpi.id + '\',\'agent\',this)">Per agent</button>'+
             '</div>'+
             '<div class="cc-bdp active" id="'+idP+'">'+
             '<button class="cc-csvbtn" onclick="event.stopPropagation();ccCSV(\'' + idP + '\')">Export CSV</button>'+
             '<table class="cct" id="'+idP+'"><thead><tr><th>Produkt</th><th>'+bkpi.label+'</th></tr></thead><tbody>'+pRows+'</tbody></table></div>'+
             '<div class="cc-bdp" id="'+idA+'">'+
             '<button class="cc-csvbtn" onclick="event.stopPropagation();ccCSV(\'' + idA + '\')">Export CSV</button>'+
             '<table class="cct" id="'+idA+'"><thead><tr><th>Agent</th><th>'+bkpi.label+'</th></tr></thead><tbody>'+aRows+'</tbody></table></div>'+
             '</div>';
    }

    // Main table
    var tid = 'cct-'+_view;
    var thead = '<tr><th onclick="ccSort(this)">Period</th>';
    for (var ti=0;ti<KPI_DEFS.length;ti++) thead += '<th onclick="ccSort(this)">'+KPI_DEFS[ti].label+'</th>';
    thead += '</tr>';
    var tbody = '';
    for (var ri=0;ri<rows.length;ri++) {
      var row = rows[ri];
      if (row.isFuture) {
        tbody += '<tr class="fut"><td>'+row.label+'</td>';
        for (var fi=0;fi<KPI_DEFS.length;fi++) tbody += '<td>&mdash;</td>';
        tbody += '</tr>'; continue;
      }
      tbody += '<tr><td>'+row.label+'</td>';
      for (var ci=0;ci<KPI_DEFS.length;ci++) {
        var ck = KPI_DEFS[ci];
        var cv = kpiVal(ck.id, row.pidx, row.seed);
        var csc = sCls(ck, cv);
        var cdv = ck.id==='csat'?cv.toFixed(2):cv.toFixed(1);
        tbody += '<td>'+dotHtml(ck,cv)+'<span class="'+csc+'">'+cdv+ck.unit+'</span></td>';
      }
      tbody += '</tr>';
    }

    var vl = _view==='day'?'Dag-for-dag (innevarande vecka)':_view==='week'?'Veckoredovisning (senaste 12 veckor)':'Manadsredovisning (senaste 12 manader)';
    var ts = new Date().toLocaleTimeString('sv-SE');
    var av = _view==='day'?'Dag':_view==='week'?'Vecka':'Manad';

    cont.innerHTML =
      '<div class="cc-kpi-section">'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'+
        '<span class="section-title">' + String.fromCharCode(167) + ' CC ' + String.fromCharCode(183) + ' Customer Care Performance</span>'+
        '<span class="tag analytics">ANALYTICS</span>'+
      '</div>'+
      '<div class="cc-live-bar">'+
        '<div class="cc-dot"></div>'+
        '<span style="font-size:12px;color:#666">Live &middot; Uppdateras var 60s &middot; Senast: '+ts+'</span>'+
        '<div class="cc-view-btns">'+
          '<button class="cc-vbtn'+(_view==='day'?' active':'')+'" onclick="setCCView(\'day\')">Dag</button>'+
          '<button class="cc-vbtn'+(_view==='week'?' active':'')+'" onclick="setCCView(\'week\')">Vecka</button>'+
          '<button class="cc-vbtn'+(_view==='month'?' active':'')+'" onclick="setCCView(\'month\')">Manad</button>'+
        '</div>'+
      '</div>'+
      '<div class="cc-cards">'+cards+'</div>'+
      bds+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'+
        '<span style="font-size:11px;font-weight:600;color:var(--text3)">'+vl+'</span>'+
        '<button class="cc-csvbtn" onclick="ccCSV(\'' + tid + '\')">Export CSV</button>'+
      '</div>'+
      '<div style="overflow-x:auto">'+
        '<table class="cct" id="'+tid+'"><thead>'+thead+'</thead><tbody>'+tbody+'</tbody></table>'+
      '</div>'+
      '<div style="font-size:11px;color:#999;text-align:center;padding-top:6px">'+
        'CC Analytics &middot; Simulerad data (mock) &middot; Koppla Freshdesk API for realtidsdata'+
      '</div>'+
      '</div>';
  }

  window.setCCView  = function(v) { _view = v; render(); };
  window.toggleCCBd = function(id) { var e=document.getElementById('cc-bd-'+id); if(e) e.classList.toggle('open'); };
  window.ccBdTab    = function(id,tab,btn) {
    var pre = tab==='prod' ? 'ccbdp-' : 'ccbda-';
    [].slice.call(document.querySelectorAll('#cc-bd-'+id+' .cc-bdp')).forEach(function(p){p.classList.remove('active');});
    [].slice.call(document.querySelectorAll('#cc-bd-'+id+' .cc-bdtab')).forEach(function(b){b.classList.remove('active');});
    var p = document.getElementById(pre+id); if(p) p.classList.add('active');
    btn.classList.add('active');
  };
  window.ccSort = function(th) {
    var tbl=th.closest('table'), idx=[].slice.call(th.parentNode.children).indexOf(th), asc=th.dataset.asc!=='true';
    th.dataset.asc = asc;
    var tb = tbl.querySelector('tbody');
    [].slice.call(tb.querySelectorAll('tr')).sort(function(a,b){
      var av=(a.children[idx]||{innerText:''}).innerText.replace(/[^0-9.\-]/g,'');
      var bv=(b.children[idx]||{innerText:''}).innerText.replace(/[^0-9.\-]/g,'');
      var an=parseFloat(av),bn=parseFloat(bv);
      return !isNaN(an)&&!isNaN(bn)?(asc?an-bn:bn-an):(asc?av.localeCompare(bv):bv.localeCompare(av));
    }).forEach(function(r){tb.appendChild(r);});
  };
  window.ccCSV = function(id) { csvExport(id); };

  function autoRefresh() {
    if (_timer) clearInterval(_timer);
    _timer = setInterval(function() { if (document.getElementById('cc-kpi-section')) render(); }, 60000);
  }
  window.initCCKPIs = function() { render(); autoRefresh(); };

})();
