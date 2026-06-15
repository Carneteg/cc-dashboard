// js/tab-exec.js — CFO Executive Summary Tab
// v3 — June 2026 — fixed subtext labels and tight threshold
// Reads from the same planning constants used by tab-wp.js
// No external API calls — all values from the official Excel model (hardcoded constants)
// so this tab always loads instantly even if Supabase is down.

(function(){
'use strict';

/* ── Planning constants (mirror of tab-wp.js) ── */
const PLAN = {
  actualFte: 11,
  effectiveSupply: 11.10,
  requiredFte: 10.10,
  ticketFte: 9.10,
  overheadFte: 1.00,
  pools: [
    { name:'Classic',    supply:3.10, required:3.40, status:'warn',  color:'#f59e0b' },
    { name:'Switchboard',supply:2.80, required:2.65, status:'ok',    color:'#22c55e' },
    { name:'S1',         supply:2.55, required:2.45, status:'ok',    color:'#22c55e' },
    { name:'Frankly',    supply:1.65, required:1.65, status:'ok',    color:'#22c55e' },
    { name:'Talent',     supply:1.00, required:0.95, status:'ok',    color:'#22c55e' }
  ],
  scenarios: [
    { name:'Now',            supply:11.10, required:10.10, label:'Current',   color:'#4f46e5' },
    { name:'Post-aug Best',  supply:11.60, required: 9.80, label:'Optimistic',color:'#22c55e' },
    { name:'Post-aug Worst', supply: 7.00, required: 9.50, label:'Critical',  color:'#ef4444' },
    { name:'AI Deflection',  supply:11.10, required: 9.30, label:'Strategy',  color:'#0ea5e9' }
  ]
};

/* ── Team roster (from masterdata) ── */
const ROSTER = [
  { name:'Tobias Carneteg',          level:'Senior', status:'HoCC',     note:'Overhead only',         active:false },
  { name:'Therese Nordtvedt',        level:'Senior', status:'Active',   note:'Senior Switchboard 75%', active:true  },
  { name:'Ketil Olsen',              level:'Senior', status:'Active',   note:'',                       active:true  },
  { name:'Kari Engebråten',          level:'Senior', status:'Active',   note:'',                       active:true  },
  { name:'Martin Apiwat Eriksson',   level:'Senior', status:'Active',   note:'',                       active:true  },
  { name:'Arkadiusz Zawodnik',       level:'Senior', status:'Active',   note:'Primarily Frankly',      active:true  },
  { name:'Mats Larsen',              level:'Senior', status:'Active',   note:'Multi-pool',             active:true  },
  { name:'Ilse Larsson',             level:'Senior', status:'Active',   note:'SW+S1 split',            active:true  },
  { name:'Ian Masite',               level:'Junior', status:'Probation',note:'Ends 26 Jul',            active:true,  risk:'warn', riskNote:'Probation ends 26 Jul' },
  { name:'Honya Mohammed',           level:'Junior', status:'Probation',note:'Ends 7 Jul',             active:true,  risk:'crit', riskNote:'Probation ends 7 Jul' },
  { name:'Hege Anita Aarnesen',      level:'Senior', status:'Temp',     note:'Ends Aug',               active:true,  risk:'warn', riskNote:'Temp ends Aug 2026' },
  { name:'Johanna Martinsson',       level:'Temp',   status:'Temp',     note:'Ends Aug',               active:true,  risk:'warn', riskNote:'Temp ends Aug 2026' },
  { name:'Jimmy Skille',             level:'Senior', status:'Active',   note:'Parental leave Aug',     active:true,  risk:'warn', riskNote:'On parental leave from Aug' },  { name:'Jim Zsuppan',             level:'Senior', status:'Leave',    note:'Parental leave Jan 2027', active:false, risk:'info', riskNote:'Parental leave until Jan 2027' },
  { name:'Katja Svennerholm',        level:'Senior', status:'Leave',    note:'Parental leave Jan 2027', active:false, risk:'info', riskNote:'Parental leave until Jan 2027' },
  { name:'Anett Nilsen',             level:'Senior', status:'Moved',    note:'Other dept',             active:false },
  { name:'Stefan Sahlin',            level:'Senior', status:'Moved',    note:'Other dept',             active:false },
  { name:'Lukas Andersson',          level:'Senior', status:'Moved',    note:'Other dept',             active:false }
];

/* ── Derive composite health score (0–100) ── */
function calcHealthScore(){
  let score = 70; // baseline
  // Classic deficit is critical: -15 pts
  const classic = PLAN.pools.find(p=>p.name==='Classic');
  const classicGap = classic.supply - classic.required;
  if(classicGap < -1) score -= 20;
  else if(classicGap < -0.5) score -= 10;
  else if(classicGap < 0) score -= 5;

  // Post-aug worst case: supply drops to 7.0 vs required 9.5 = -2.5 gap
  // This is a forward risk: -10 pts
  score -= 10;

  // 3 staff at probation/temp risk ending soon: -5 pts
  const critRisk = ROSTER.filter(r=>r.risk==='crit').length;
  const warnRisk = ROSTER.filter(r=>r.risk==='warn').length;
  score -= (critRisk * 5) + (warnRisk * 2);

  // AI deflection strategy gives headroom: +5 pts
  score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function healthColor(score){
  if(score >= 70) return '#22c55e';
  if(score >= 45) return '#f59e0b';
  return '#ef4444';
}
function healthLabel(score){
  if(score >= 70) return 'Acceptable';
  if(score >= 45) return 'At Risk';
  return 'Critical';
}

/* ── Render helpers ── */
function tagHtml(cls, text){ return `<span class="tag ${cls}">${text}</span>`; }
function gapColor(gap){ return gap >= 0 ? '#22c55e' : '#ef4444'; }
function fmtGap(gap){ return (gap >= 0 ? '+' : '') + gap.toFixed(2); }

/* ── Main render ── */
function renderExec(){
const el = document.getElementById('tab-exec');
if(!el) return;

const gap = PLAN.effectiveSupply - PLAN.requiredFte;
const classicPool = PLAN.pools.find(p=>p.name==='Classic');
const classicGap = classicPool.supply - classicPool.required;
const critRisk = ROSTER.filter(r=>r.risk==='crit');
const warnRisk = ROSTER.filter(r=>r.risk==='warn');
const infoRisk = ROSTER.filter(r=>r.risk==='info');

function gCol(g){ return g>=0?'#16a34a':'#dc2626'; }
function fmt(g){ return (g>=0?'+':'')+g.toFixed(2); }
function pill(text,bg,color){
  return `<span style="display:inline-block;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:600;background:${bg};color:${color};letter-spacing:.02em">${text}</span>`;
}

el.innerHTML = `
<div style="max-width:1100px;margin:0 auto;padding:8px 0 40px">

  <!-- PAGE TITLE -->
  <div style="margin-bottom:28px">
    <h1 style="margin:0 0 4px;font-size:26px;font-weight:700;color:#0f172a;letter-spacing:-.04em">Executive Summary</h1>
    <p style="margin:0;font-size:13px;color:#94a3b8;font-weight:400">CC Workforce · June 2026 · Source: CC_FTE_Calculator.xlsx</p>
  </div>

  <!-- ROW 1: 4 KPI STAT CARDS -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">

    <!-- Actual FTE -->
    <div style="background:#fff;border-radius:16px;padding:20px 22px;border:1px solid #f1f5f9;box-shadow:0 1px 3px rgba(0,0,0,.05)">
      <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Actual FTE</div>
      <div style="font-size:36px;font-weight:700;color:#0f172a;line-height:1;letter-spacing:-.04em">${PLAN.actualFte}</div>
      <div style="margin-top:8px;font-size:12px;color:#94a3b8">Official headcount</div>
    </div>

    <!-- Required FTE -->
    <div style="background:#fff;border-radius:16px;padding:20px 22px;border:1px solid #f1f5f9;box-shadow:0 1px 3px rgba(0,0,0,.05)">
      <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Required FTE</div>
      <div style="font-size:36px;font-weight:700;color:#0f172a;line-height:1;letter-spacing:-.04em">${PLAN.requiredFte}</div>
      <div style="margin-top:8px;font-size:12px;color:#94a3b8">Tickets ${PLAN.ticketFte} + Overhead ${PLAN.overheadFte}</div>
    </div>

    <!-- Net Gap -->
    <div style="background:#fff;border-radius:16px;padding:20px 22px;border:1px solid #f1f5f9;box-shadow:0 1px 3px rgba(0,0,0,.05)">
      <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Net Gap</div>
      <div style="font-size:36px;font-weight:700;color:${gCol(gap)};line-height:1;letter-spacing:-.04em">${fmt(gap)}</div>
      <div style="margin-top:8px;font-size:12px;color:#94a3b8">Effective supply − required</div>
    </div>

    <!-- Classic Gap -->
    <div style="background:#fff9f0;border-radius:16px;padding:20px 22px;border:1px solid #fed7aa;box-shadow:0 1px 3px rgba(0,0,0,.05)">
      <div style="font-size:11px;font-weight:600;color:#c2410c;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Classic Gap</div>
      <div style="font-size:36px;font-weight:700;color:#ea580c;line-height:1;letter-spacing:-.04em">${fmt(classicGap)}</div>
      <div style="margin-top:8px;font-size:12px;color:#c2410c">Accelerate S1 migration</div>
    </div>

  </div>

    <!-- LEAVE IMPACT STRIP -->
  ${(()=>{
    const onLeaveNow = ROSTER.filter(r=>!r.active && r.risk==='info');
    const goingOnLeave = ROSTER.filter(r=>r.active && r.risk==='warn' && r.riskNote && (r.riskNote.toLowerCase().includes('leave') || r.riskNote.toLowerCase().includes('temp') || r.riskNote.toLowerCase().includes('ends')));
    const probation = ROSTER.filter(r=>r.active && r.risk && (r.risk==='crit'||r.risk==='warn') && r.riskNote && r.riskNote.toLowerCase().includes('probation'));
    const leaveNames = onLeaveNow.map(r=>r.name.split(' ')[0]).join(', ');
    const riskNames = goingOnLeave.map(r=>r.name.split(' ')[0]).join(', ');
    const probNames = probation.map(r=>r.name.split(' ')[0]).join(', ');
    const postAugSupplyLoss = goingOnLeave.length * 0.5;
    const postAugSupply = (PLAN.effectiveSupply - postAugSupplyLoss).toFixed(1);
    const postAugGap = (postAugSupply - PLAN.requiredFte).toFixed(2);
    const stripBg = Number(postAugGap) < 0 ? '#fef2f2' : '#f0fdf4';
    const stripBorder = Number(postAugGap) < 0 ? '#fecaca' : '#bbf7d0';
    const gapColor = Number(postAugGap) < 0 ? '#dc2626' : '#16a34a';
    return `<div style="background:${stripBg};border:1px solid ${stripBorder};border-radius:12px;padding:14px 20px;margin-bottom:16px;display:flex;align-items:center;gap:20px;flex-wrap:wrap"><div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;flex-shrink:0">Leave \u0026 Availability</div><div style="display:flex;gap:16px;flex-wrap:wrap;flex:1">${onLeaveNow.length ? `<div style="font-size:12px;color:#2563eb"><strong style="color:#1e40af">${onLeaveNow.length} on leave now:</strong> ${leaveNames}</div>` : ''}${goingOnLeave.length ? `<div style="font-size:12px;color:#b45309"><strong style="color:#92400e">${goingOnLeave.length} leaving/ending Aug:</strong> ${riskNames}</div>` : ''}${probation.length ? `<div style="font-size:12px;color:#dc2626"><strong style="color:#991b1b">${probation.length} on probation:</strong> ${probNames}</div>` : ''}</div><div style="flex-shrink:0;text-align:right"><div style="font-size:11px;color:#94a3b8;margin-bottom:2px">Post-Aug Eff. Supply</div><div style="font-size:20px;font-weight:700;color:${gapColor}">${postAugSupply} FTE <span style="font-size:13px">(${Number(postAugGap)>=0?'+':''} ${postAugGap})</span></div></div></div>`;
  })()}

  <!-- ROW 2: POOLS + HR RISK -->
  <div style="display:grid;grid-template-columns:1fr 1.3fr;gap:12px;margin-bottom:20px;align-items:start">

    <!-- Pool Capacity -->
    <div style="background:#fff;border-radius:16px;padding:22px 24px;border:1px solid #f1f5f9;box-shadow:0 1px 3px rgba(0,0,0,.05)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
        <span style="font-size:13px;font-weight:700;color:#0f172a">Pool Capacity</span>
        <span style="font-size:11px;color:#94a3b8;font-weight:500">Supply vs. Required</span>
      </div>
      ${PLAN.pools.map(p=>{
        const g = p.supply - p.required;
        const isNeg = g < 0;
        const barPct = Math.min(100, (p.supply/p.required)*100);
        const barColor = isNeg ? '#ef4444' : '#22c55e';
        const statusColor = g < -0.5 ? '#dc2626' : g < 0 ? '#ea580c' : '#16a34a';
        const statusBg   = g < -0.5 ? '#fee2e2' : g < 0 ? '#fff7ed' : '#f0fdf4';
        const statusText = g < -0.5 ? 'Critical' : g < 0 ? 'Tight' : 'OK';
        return `<div style="margin-bottom:14px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
            <span style="font-size:13px;font-weight:600;color:#334155">${p.name}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:13px;font-weight:700;color:${statusColor}">${fmt(g)}</span>
              ${pill(statusText, statusBg, statusColor)}
            </div>
          </div>
          <div style="height:5px;background:#f1f5f9;border-radius:99px;overflow:hidden">
            <div style="width:${barPct}%;height:100%;background:${barColor};border-radius:99px;transition:width .3s"></div>
          </div>
        </div>`;
      }).join('')}
    </div>

    <!-- HR Risk -->
    <div style="background:#fff;border-radius:16px;padding:22px 24px;border:1px solid #f1f5f9;box-shadow:0 1px 3px rgba(0,0,0,.05)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
        <span style="font-size:13px;font-weight:700;color:#0f172a">People Risk</span>
        ${pill(critRisk.length+warnRisk.length+infoRisk.length+' people', '#f1f5f9', '#475569')}
      </div>
      ${[
        ...critRisk.map(r=>({...r, dot:'#ef4444', bg:'#fff5f5', border:'#fecaca', noteColor:'#dc2626'})),
        ...warnRisk.map(r=>({...r, dot:'#f59e0b', bg:'#fffdf0', border:'#fde68a', noteColor:'#b45309'})),
        ...infoRisk.map(r=>({...r, dot:'#60a5fa', bg:'#f0f8ff', border:'#bfdbfe', noteColor:'#2563eb'}))
      ].map(r=>`
        <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 12px;background:${r.bg};border:1px solid ${r.border};border-radius:10px;margin-bottom:7px">
          <div style="width:8px;height:8px;border-radius:50%;background:${r.dot};margin-top:5px;flex-shrink:0"></div>
          <div>
            <div style="font-size:13px;font-weight:600;color:#1e293b">${r.name}</div>
            <div style="font-size:11px;color:${r.noteColor};margin-top:1px">${r.riskNote}</div>
          </div>
        </div>`).join('')}
    </div>

  </div>

  <!-- ROW 3: SCENARIOS -->
  <div style="background:#fff;border-radius:16px;padding:22px 24px;border:1px solid #f1f5f9;box-shadow:0 1px 3px rgba(0,0,0,.05);margin-bottom:20px">
    <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:18px">Scenario Outlook — Supply vs Required FTE</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
      ${PLAN.scenarios.map(s=>{
        const g = s.supply - s.required;
        const gCol2 = g>=0 ? '#16a34a' : '#dc2626';
        const gBg   = g>=0 ? '#f0fdf4' : '#fef2f2';
        return `<div style="border-radius:12px;padding:16px 18px;background:#fafafa;border:1px solid #f1f5f9">
          <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">${s.label}</div>
          <div style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:12px">${s.name}</div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:3px"><span>Supply</span><span style="font-weight:600;color:#1e293b">${s.supply}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:10px"><span>Required</span><span style="font-weight:600;color:#1e293b">${s.required}</span></div>
          <div style="display:inline-block;padding:5px 12px;border-radius:8px;background:${gBg};color:${gCol2};font-size:16px;font-weight:700">${fmt(g)} FTE</div>
        </div>`;
      }).join('')}
    </div>
  </div>

  <!-- ROW 4: PRIORITY ACTIONS -->
  <div style="background:#fff;border-radius:16px;padding:22px 24px;border:1px solid #f1f5f9;box-shadow:0 1px 3px rgba(0,0,0,.05);margin-bottom:20px">
    <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:18px">Priority Actions</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">

      <div style="padding:14px 16px;border-radius:12px;background:#fffbeb;border-left:3px solid #f59e0b">
        <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:4px">Classic: tight gap — accelerate S1 migration</div>
        <div style="font-size:12px;color:#64748b;line-height:1.55">−0.30 FTE in Classic pool. One absence tips into deficit. Accelerate S1 migration to reduce Classic volume.</div>
      </div>

      <div style="padding:14px 16px;border-radius:12px;background:#fffbeb;border-left:3px solid #f59e0b">
        <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:4px">Decide on probation contracts before July</div>
        <div style="font-size:12px;color:#64748b;line-height:1.55">Honya Mohammed (ends 7 Jul) and Ian Masite (26 Jul). Both are Junior FTE contributing to ticket coverage.</div>
      </div>

      <div style="padding:14px 16px;border-radius:12px;background:#fff8f1;border-left:3px solid #fb923c">
        <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:4px">Post-August: 4 staff at risk of leaving/PL</div>
        <div style="font-size:12px;color:#64748b;line-height:1.55">Hege Aarnesen + Johanna Martinsson (temp ends Aug) + Jimmy Skille (PL from Aug). Worst case: −2.5 FTE gap.</div>
      </div>

      <div style="padding:14px 16px;border-radius:12px;background:#f0f7ff;border-left:3px solid #60a5fa">
        <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:4px">Activate AI deflection (30%) to reduce FTE need</div>
        <div style="font-size:12px;color:#64748b;line-height:1.55">30% deflection reduces required FTE from 10.10 → 9.30 (−0.80 FTE), covering the post-aug supply drop.</div>
      </div>

      <div style="padding:14px 16px;border-radius:12px;background:#f0fdf4;border-left:3px solid #4ade80">
        <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:4px">Recruit +1 FTE for S1 by Q4–Q6</div>
        <div style="font-size:12px;color:#64748b;line-height:1.55">S1 requirement grows to 4.05 FTE at migration peak. Current supply 4.34 — sufficient now, monitor closely.</div>
      </div>

      <div style="padding:14px 16px;border-radius:12px;background:#f0fdf4;border-left:3px solid #4ade80">
        <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:4px">S1, Frankly, Talent: stable — monitor growth</div>
        <div style="font-size:12px;color:#64748b;line-height:1.55">Positive gaps (+1.89, +0.70, +0.54 FTE). Switchboard is tight (+0.04) — watch volume closely.</div>
      </div>

    </div>
  </div>

  <!-- FOOTER -->
  <div style="font-size:12px;color:#94a3b8;line-height:1.6;text-align:center;padding-top:4px">
    Source: CC_FTE_Calculator.xlsx (official planning model) · Values are static planning baseline, not real-time API data
  </div>

</div>
`;
}

/* ── Hook into showTab ── */
const _origST = window.showTab;
window.showTab = function(id, btn){
  if(_origST) _origST(id, btn);
  if(id === 'exec') renderExec();
};

/* ── Also render on DOMContentLoaded if exec is the active tab ── */
document.addEventListener('DOMContentLoaded', ()=>{
  if(document.getElementById('tab-exec') &&
     document.getElementById('tab-exec').classList.contains('active')){
    renderExec();
  }
});

})();
