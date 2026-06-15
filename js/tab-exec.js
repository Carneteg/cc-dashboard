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
  { name:'Jimmy Skille',             level:'Senior', status:'Active',   note:'Parental leave Aug',     active:true,  risk:'warn', riskNote:'On parental leave from Aug' },
  { name:'Jim Zsuppan',              level:'Senior', status:'PL',       note:'Until Jan 2027',         active:false, risk:'info', riskNote:'Parental leave until Jan 2027' },
  { name:'Katja Svennerholm',        level:'Senior', status:'PL',       note:'Until Jan 2027',         active:false, risk:'info', riskNote:'Parental leave until Jan 2027' },
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

  const score = calcHealthScore();
  const sColor = healthColor(score);
  const sLabel = healthLabel(score);
  const gap = PLAN.effectiveSupply - PLAN.requiredFte;
  const classicPool = PLAN.pools.find(p=>p.name==='Classic');
  const classicGap = classicPool.supply - classicPool.required;

  // Roster risk counts
  const critRiskItems = ROSTER.filter(r=>r.risk==='crit');
  const warnRiskItems = ROSTER.filter(r=>r.risk==='warn');
  const infoRiskItems = ROSTER.filter(r=>r.risk==='info');

  el.innerHTML = `
<div style="max-width:1200px">

<!-- ─── TOP HEADER ─── -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px">
  <div>
    <div style="font-size:22px;font-weight:800;color:#1e293b;letter-spacing:-.03em">Executive Summary</div>
    <div style="font-size:13px;color:#64748b;margin-top:3px">CC Workforce — ${new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})} · Source: CC_FTE_Calculator.xlsx</div>
  </div>

<!-- ─── ROW 1: 4 KPI cards ─── -->
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px">
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;box-shadow:0 2px 6px rgba(0,0,0,.06)">
    <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Actual FTE</div>
    <div style="font-size:30px;font-weight:800;color:#1e293b;letter-spacing:-.03em;line-height:1">${PLAN.actualFte}</div>
    <div style="font-size:11px;color:#94a3b8;margin-top:5px">Official headcount</div>
  </div>
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;box-shadow:0 2px 6px rgba(0,0,0,.06)">
    <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Required FTE</div>
    <div style="font-size:30px;font-weight:800;color:#1e293b;letter-spacing:-.03em;line-height:1">${PLAN.requiredFte}</div>
    <div style="font-size:11px;color:#94a3b8;margin-top:5px">Tickets ${PLAN.ticketFte} + Overhead ${PLAN.overheadFte}</div>
  </div>
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;box-shadow:0 2px 6px rgba(0,0,0,.06)">
    <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Net Gap FTE</div>
    <div style="font-size:30px;font-weight:800;color:${gapColor(gap)};letter-spacing:-.03em;line-height:1">${fmtGap(gap)}</div>
    <div style="font-size:11px;color:#94a3b8;margin-top:5px">⚠ Classic −0.30 FTE (tight)</div>
  </div>
  <div style="background:#fff;border:1px solid #fde68a;border-radius:12px;padding:18px 20px;box-shadow:0 2px 6px rgba(0,0,0,.06);background:#fffbeb">
    <div style="font-size:11px;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Classic Gap</div>
    <div style="font-size:30px;font-weight:800;color:#d97706;letter-spacing:-.03em;line-height:1">${fmtGap(classicGap)}</div>
    <div style="font-size:11px;color:#f87171;margin-top:5px">Tight — monitor · accelerate S1 migration</div>
  </div>
</div>

<!-- ─── ROW 2: Pool gaps + HR risk ─── -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">

  <!-- Pool gaps -->
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;box-shadow:0 2px 6px rgba(0,0,0,.06)">
    <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:14px;display:flex;align-items:center;gap:8px">
      Pool Capacity Gaps
      <span style="font-size:10px;font-weight:600;background:#ede9fe;color:#4f46e5;padding:2px 7px;border-radius:10px">Planning</span>
    </div>
    ${PLAN.pools.map(p=>{
      const g = p.supply - p.required;
      const pct = Math.min(100, Math.abs(g) / p.required * 100);
      const barColor = g >= 0 ? '#22c55e' : '#ef4444';
      const statusTag = g < -0.5 ? '<span class="tag crit">Critical</span>' : g < 0 ? '<span class="tag warn">Tight</span>' : g < 0.1 ? '<span class="tag warn">Tight</span>' : '<span class="tag ok">OK</span>';
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:110px;font-size:13px;font-weight:600;color:#1e293b">${p.name}</div>
        <div style="flex:1;background:#f1f5f9;border-radius:4px;height:8px;overflow:hidden">
          <div style="width:${Math.min(100, p.supply/p.required*100)}%;height:100%;background:${barColor};border-radius:4px"></div>
        </div>
        <div style="width:50px;text-align:right;font-size:12px;font-weight:700;color:${barColor}">${fmtGap(g)}</div>
        <div style="width:70px">${statusTag}</div>
      </div>`;
    }).join('')}
  </div>

  <!-- HR Risk panel -->
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;box-shadow:0 2px 6px rgba(0,0,0,.06)">
    <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:14px;display:flex;align-items:center;gap:8px">
      HR Risk — Near-term Capacity Threats
      <span style="font-size:10px;font-weight:700;background:#fee2e2;color:#dc2626;padding:2px 7px;border-radius:10px">${critRiskItems.length + warnRiskItems.length} at risk</span>
    </div>
    ${critRiskItems.map(r=>`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;padding:8px 10px;background:#fff1f2;border:1px solid #fecaca;border-radius:8px">
      <span style="font-size:14px">🔴</span>
      <div>
        <div style="font-size:12px;font-weight:700;color:#1e293b">${r.name}</div>
        <div style="font-size:11px;color:#ef4444">${r.riskNote}</div>
      </div>
    </div>`).join('')}
    ${warnRiskItems.map(r=>`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;padding:8px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px">
      <span style="font-size:14px">🟡</span>
      <div>
        <div style="font-size:12px;font-weight:700;color:#1e293b">${r.name}</div>
        <div style="font-size:11px;color:#d97706">${r.riskNote}</div>
      </div>
    </div>`).join('')}
    ${infoRiskItems.map(r=>`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;padding:8px 10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px">
      <span style="font-size:14px">🔵</span>
      <div>
        <div style="font-size:12px;font-weight:700;color:#1e293b">${r.name}</div>
        <div style="font-size:11px;color:#3b82f6">${r.riskNote}</div>
      </div>
    </div>`).join('')}
  </div>
</div>

<!-- ─── ROW 3: Scenario comparison ─── -->
<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;box-shadow:0 2px 6px rgba(0,0,0,.06);margin-bottom:20px">
  <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:14px">Scenario Outlook — Supply vs Required FTE</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
    ${PLAN.scenarios.map(s=>{
      const g = s.supply - s.required;
      const gCol = g >= 0 ? '#22c55e' : '#ef4444';
      return `<div style="border:2px solid ${s.color}1a;background:${s.color}08;border-radius:10px;padding:14px 16px">
        <div style="font-size:10px;font-weight:700;color:${s.color};text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">${s.label}</div>
        <div style="font-size:14px;font-weight:700;color:#1e293b;margin-bottom:8px">${s.name}</div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:3px"><span>Supply</span><span style="font-weight:700;color:#1e293b">${s.supply}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:8px"><span>Required</span><span style="font-weight:700;color:#1e293b">${s.required}</span></div>
        <div style="font-size:20px;font-weight:800;color:${gCol}">${fmtGap(g)} FTE</div>
      </div>`;
    }).join('')}
  </div>
</div>

<!-- ─── ROW 4: Actions ─── -->
<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;box-shadow:0 2px 6px rgba(0,0,0,.06);margin-bottom:20px">
  <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:14px;display:flex;align-items:center;gap:8px">
    Priority Actions
    <span style="font-size:10px;font-weight:600;background:#fef3c7;color:#d97706;padding:2px 7px;border-radius:10px">CFO / WFM</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div style="display:flex;gap:12px;padding:12px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:9px;align-items:flex-start">
      <span style="font-size:18px;margin-top:1px">🟡</span>
      <div>
        <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:2px">Classic: Tight gap −0.30 FTE — accelerate S1 migration</div>
        <div style="font-size:11px;color:#64748b;line-height:1.5">−0.30 FTE gap in Classic pool. Not critical but tight — one absence day tips into deficit. Accelerate S1 migration to reduce Classic volume. S1 has +0.10 FTE headroom currently.</div>
      </div>
    </div>
    <div style="display:flex;gap:12px;padding:12px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:9px;align-items:flex-start">
      <span style="font-size:18px;margin-top:1px">🟡</span>
      <div>
        <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:2px">Decide on probation/temp contracts before July</div>
        <div style="font-size:11px;color:#64748b;line-height:1.5">Honya Mohammed (probation ends 7 Jul) and Ian Masite (26 Jul). Decision needed to maintain Aug capacity. Both are Junior FTE contributing to ticket coverage.</div>
      </div>
    </div>
    <div style="display:flex;gap:12px;padding:12px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:9px;align-items:flex-start">
      <span style="font-size:18px;margin-top:1px">🟡</span>
      <div>
        <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:2px">Post-August plan: 4 staff at risk of leaving/PL</div>
        <div style="font-size:11px;color:#64748b;line-height:1.5">Hege Aarnesen + Johanna Martinsson (temp ends Aug) + Jimmy Skille (PL from Aug). Worst case: supply drops to 7.0 FTE vs 9.5 required = −2.5 FTE gap. Plan cover or recruitment before Aug.</div>
      </div>
    </div>
    <div style="display:flex;gap:12px;padding:12px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:9px;align-items:flex-start">
      <span style="font-size:18px;margin-top:1px">🔵</span>
      <div>
        <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:2px">Activate AI deflection (30%) to reduce FTE need</div>
        <div style="font-size:11px;color:#64748b;line-height:1.5">30% AI deflection reduces required FTE from 10.10 → 9.30 (−0.80 FTE). This effectively covers the post-aug supply drop and gives time to recruit without service degradation.</div>
      </div>
    </div>
    <div style="display:flex;gap:12px;padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:9px;align-items:flex-start">
      <span style="font-size:18px;margin-top:1px">🟢</span>
      <div>
        <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:2px">Migration: S1 needs +1 FTE recruited by Q4–Q6</div>
        <div style="font-size:11px;color:#64748b;line-height:1.5">S1 FTE requirement grows from 2.93 to 4.05 at Q10 (with AI deflection). Current S1 supply: 4.34 FTE. Sufficient for now — but monitor as Classic customers migrate and volume shifts to S1.</div>
      </div>
    </div>
    <div style="display:flex;gap:12px;padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:9px;align-items:flex-start">
      <span style="font-size:18px;margin-top:1px">🟢</span>
      <div>
        <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:2px">S1 + Frankly + Talent: stable — monitor growth</div>
        <div style="font-size:11px;color:#64748b;line-height:1.5">These pools have positive gaps (+1.89, +0.70, +0.54 FTE). No immediate action needed. Switchboard is tight (+0.04) — watch volume growth closely to avoid moving into deficit.</div>
      </div>
    </div>
  </div>
</div>

<!-- ─── ROW 5: Migration progress ─── -->
<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;box-shadow:0 2px 6px rgba(0,0,0,.06);margin-bottom:20px">
  <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:6px">Migration Progress: Classic → S1</div>
  <div style="font-size:12px;color:#64748b;margin-bottom:14px">Current phase: <strong style="color:#ef4444">🔴 Critical (Q0–Q1)</strong> — Classic still has −1.20 FTE deficit while migration is in early stage.</div>
  <div style="display:flex;gap:0;align-items:center;margin-bottom:12px">
    ${[
      {q:'Q0–Q1',label:'Critical',color:'#ef4444',active:true},
      {q:'Q2–Q3',label:'Phase 1', color:'#f59e0b',active:false},
      {q:'Q4–Q6',label:'Phase 2', color:'#f59e0b',active:false},
      {q:'Q7–Q8',label:'Phase 3', color:'#22c55e',active:false},
      {q:'Q9–Q10',label:'Expansion',color:'#3b82f6',active:false}
    ].map((ph,i,arr)=>`
    <div style="flex:1;text-align:center;padding:10px 4px;background:${ph.active ? ph.color+'22' : '#f8fafc'};border:2px solid ${ph.active ? ph.color : '#e2e8f0'};border-radius:${i===0?'8px 0 0 8px':i===arr.length-1?'0 8px 8px 0':'0'};margin-right:${i<arr.length-1?'-1px':'0'}">
      <div style="font-size:11px;font-weight:${ph.active?'800':'600'};color:${ph.active?ph.color:'#94a3b8'}">${ph.q}</div>
      <div style="font-size:10px;color:${ph.active?ph.color:'#cbd5e1'};margin-top:2px">${ph.label}</div>
    </div>`).join('')}
  </div>
  <div style="font-size:11px;color:#64748b;line-height:1.6">S1 FTE at Q0: <strong>2.93</strong> · S1 FTE at Q10 (with AI deflection): <strong>4.05</strong> · Current S1 supply: <strong>4.34</strong> (sufficient for migration peak)</div>
</div>

<!-- ─── Footer note ─── -->
<div style="padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:11px;color:#64748b;line-height:1.6">
  <strong>Source:</strong> CC_FTE_Calculator.xlsx (official planning model). All values are static and represent the current planning baseline — not real-time API data. For real-time operational data see the Planning and Analytics tabs.
  <br>Health Index formula: baseline 70 − 20 (Classic critical deficit) − 10 (post-aug risk) − probation/temp risk penalties + 5 (AI strategy headroom).
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
