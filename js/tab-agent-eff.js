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
var res = await fetch(url);
if(!res.ok) throw new Error("HTTP " + res.status);
var data = await res.json();
var agents = data.agents || [];
// Filter: only show agents in the active team roster
var ACTIVE_ROSTER = ["Tobias Carneteg","Therese Nordtvedt","Ketil Olsen","Kari Engebaråten","Martin Apiwat Eriksson","Arkadiusz Zawodnik","Mats Larsen","Ilse Larsson","Ian Masite","Honya Mohammed","Hege Anita Aarnesen","Johanna Martinsson","Jimmy Skille","Jim Zsuppan","Katja Svennerholm","Anett Nilsen","Stefan Sahlin","Lukas Andersson"];
agents = agents.filter(function(a){
var norm=function(s){return s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();};
return ACTIVE_ROSTER.some(function(r){return norm(r)===norm(a.agent_name);});
});
if(meta) meta.textContent = (agents.length) + " agents · " + naFmt(data.total_handled||0) + " tickets";
if(!agents.length){
body.innerHTML = '<div class="na-empty">No agent data for this period.</div>';
return;
}
var max = Math.max.apply(null, agents.map(function(a){return a.handled_tickets;}));
if(max < 1) max = 1;
var rows = agents.map(function(a){
var w = Math.max(3, Math.round((a.handled_tickets / max) * 90));
var pools = (a.pools||[]).map(function(p){return p.pool;}).join(", ");
var ahtTxt = a.measured ? naFmt(a.avg_handle_minutes) : naFmt(a.avg_handle_minutes)+"*";
return "<tr>"
+"<td><div class='na-name'>"+naEsc(a.agent_name)+"</div><div class='na-pools'>"+naEsc(pools)+"</div></td>"
+"<td class='num'><div class='na-bar-wrap'><span>"+naFmt(a.handled_tickets)+"</span>"
+"<span class='na-bar-track'><span class='na-bar' style='width:"+w+"px;display:block'></span></span></div></td>"
+"<td class='num'>"+naFmt(a.cc_scope_tickets)+"</td>"
+"<td class='num'>"+ahtTxt+"</td>"
+"</tr>";
}).join("");
body.innerHTML = "<table>"
+"<thead><tr><th>Agent</th><th class='num'>Handled</th><th class='num'>CC-scope</th><th class='num'>AHT (min)</th></tr></thead>"
+"<tbody>"+rows+"</tbody>"
+"<tfoot><tr><td>Total ("+agents.length+" agents)</td><td class='num'>"+naFmt(data.total_handled||0)+"</td><td class='num'>"+naFmt(agents.reduce(function(s,a){return s+a.cc_scope_tickets;},0))+"</td><td class='num'></td></tr></tfoot>"
+"</table>";
}catch(e){
if(body) body.innerHTML = '<div class="na-error">Could not load agent data: ' + naEsc(e.message) + '</div>';
}
}

window.renderNamedAgents = renderNamedAgents;

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
}

export { naInit, renderNamedAgents };
