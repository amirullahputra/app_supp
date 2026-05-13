// Static enums & constants — no DB I/O.

export const CAT = {
  vitamin:     { label:'Vitamin',     icon:'💊', cls:'lb-vitamin' },
  protein:     { label:'Protein',     icon:'🥛', cls:'lb-protein' },
  creatine:    { label:'Creatine',    icon:'💪', cls:'lb-creatine' },
  eaa:         { label:'EAA',         icon:'🧬', cls:'lb-eaa' },
  preworkout:  { label:'Pre-workout', icon:'⚡', cls:'lb-preworkout' },
  omega:       { label:'Omega/Fish',  icon:'🐟', cls:'lb-omega' },
  mineral:     { label:'Mineral',     icon:'🪨', cls:'lb-mineral' },
  adaptogen:   { label:'Adaptogen',   icon:'🌿', cls:'lb-adaptogen' },
  performance: { label:'Performance', icon:'🚀', cls:'lb-performance' },
  other:       { label:'Other',       icon:'📦', cls:'lb-other' },
};

// Mirror pep_fl quarters — same 12 quarters Q1 2026 - Q4 2028
export const QUARTERS = [
  'Q1_2026','Q2_2026','Q3_2026','Q4_2026',
  'Q1_2027','Q2_2027','Q3_2027','Q4_2027',
  'Q1_2028','Q2_2028','Q3_2028','Q4_2028'
];

// 4 visible quarters di top row (mirror pep_fl)
export const VISIBLE_QIDS = ['Q3_2026','Q4_2026','Q1_2027','Q2_2027'];

// DM stage colors (mirror pep_fl style)
export const STAGES = {
  watchlist: { label:'Watchlist', icon:'📋', color:'var(--t2)',  bg:'var(--bg2)' },
  tentatif:  { label:'Tentatif',  icon:'⚖️', color:'var(--pro)', bg:'var(--pro-bg)' },
  deal:      { label:'Deal',      icon:'✅', color:'var(--vit)', bg:'var(--vit-bg)' },
};

// Mutable refs populated by supabase.loadSupplements()
export let SUPPLEMENTS = [];
export function _setSupplements(arr){ SUPPLEMENTS = arr; }
