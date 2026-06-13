// ============================================================
// js/api.js  --  Fetch wrapper with TTL cache + error handling
// ============================================================
import { CC_API_BASE, ANON_KEY } from './config.js';

/** In-memory cache: cacheKey -> { data, expiresAt } */
const _cache = new Map();

/** Default TTL: 5 minutes */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Fetch a cc-dashboard-api endpoint with caching and consistent
 * error handling.
 *
 * @param {string} path      - Relative path, e.g. "/agent-breakdown"
 * @param {object} params    - Query params as plain object
 * @param {object} opts
 * @param {number} opts.ttl  - Cache TTL ms (default 5 min). 0 = no cache.
 * @returns {Promise<any>}   - Parsed JSON
 */
export async function apiFetch(path, params = {}, { ttl = DEFAULT_TTL_MS } = {}) {
  const url = _buildUrl(CC_API_BASE + path, params);

  if (ttl > 0) {
    const hit = _cache.get(url);
    if (hit && Date.now() < hit.expiresAt) return hit.data;
  }

  const res = await fetch(url, {
    headers: {
      apikey: ANON_KEY,
      Authorization: 'Bearer ' + ANON_KEY,
    },
  });

  if (!res.ok) throw new Error('API ' + path + ' returned HTTP ' + res.status);

  const data = await res.json();
  if (ttl > 0) _cache.set(url, { data, expiresAt: Date.now() + ttl });
  return data;
}

/** Invalidate all cached entries (e.g. after a manual refresh). */
export function clearCache() { _cache.clear(); }

/**
 * Show a user-facing error banner inside a container element.
 * Call from tab modules inside catch() blocks.
 *
 * @param {string} containerId - Element id to write into
 * @param {string} message     - Human-readable error text
 */
export function showError(containerId, message) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML =
    '<div style="color:#f59e0b;padding:16px;font-size:13px;border:1px solid #f59e0b;' +
    'border-radius:8px;margin:12px 0;">' +
    '<strong>&#9888; Fel:</strong> ' + message +
    '</div>';
}

// ---- private helpers ----

function _buildUrl(base, params) {
  const keys = Object.keys(params).filter(k => params[k] != null);
  if (!keys.length) return base;
  const qs = keys.map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
  return base + '?' + qs;
}
