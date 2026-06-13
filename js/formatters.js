// js/formatters.js  --  Shared number/date/string formatting

export function fmt(n, d = 1) {
  if (n == null || isNaN(n)) return '--';
  return Number(n).toFixed(d);
}

export function pct(ratio, d = 1) {
  if (ratio == null || isNaN(ratio)) return '--';
  return (ratio * 100).toFixed(d) + '%';
}

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function fmtMinutes(min) {
  if (min == null || isNaN(min)) return '--';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}

export function fmtMonth(ym) {
  if (!ym || !ym.includes('-')) return ym || '--';
  const [y, m] = ym.split('-');
  const names = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
  return (names[parseInt(m, 10) - 1] || m) + ' ' + y;
}

export function poolName(slug) {
  const M = { classic:'Classic', switchboard:'Switchboard', s1:'S1', frankly:'Frankly', talent:'Talent' };
  return M[slug] || slug || '--';
}

export function occupancyColor(value, target) {
  if (value == null) return '#64748b';
  if (value >= target) return '#22c55e';
  if (value >= target * 0.85) return '#f59e0b';
  return '#ef4444';
}
