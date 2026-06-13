// ============================================================
// js/config.js  --  Central configuration for cc-dashboard
// All environment-specific values live here.
// ============================================================

/** Supabase Edge Function base URL (dashboard-api v18+) */
export const CC_API_BASE = "https://psyelfxaehmtnfdaobyi.supabase.co/functions/v1/cc-dashboard-api";

/** Supabase project ref */
export const SUPABASE_URL = "https://psyelfxaehmtnfdaobyi.supabase.co";

/**
 * Supabase anon key.
 * NOTE: intentionally public -- scoped to anon role, all tables
 * are protected by RLS.  To tighten further, route all calls
 * through cc-dashboard-api and remove this key from the client.
 */
export const ANON_KEY = "REPLACE_WITH_SUPABASE_ANON_KEY";

/** Agent IDs excluded from all agent-facing views */
export const EXCLUDED_AGENTS = ["freshdesk_bot", "automations", "system"];

/** FTE model parameters (mirrors CC_FTE_Calculator.xlsx) */
export const FTE_PARAMS = {
  hoursPerDay: 7.5,
  shrinkage: 0.25,
  occupancyTarget: 0.75,
  seniorFactor: 1.0,
  juniorFactor: 0.7,
};
