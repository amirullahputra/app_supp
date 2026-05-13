// Static enums & label mappings — no DB I/O here.

export const CAT = {
  vitamin:    { label:'Vitamin',     icon:'💊', cls:'lb-vitamin' },
  protein:    { label:'Protein',     icon:'🥛', cls:'lb-protein' },
  creatine:   { label:'Creatine',    icon:'💪', cls:'lb-creatine' },
  eaa:        { label:'EAA',         icon:'🧬', cls:'lb-eaa' },
  preworkout: { label:'Pre-workout', icon:'⚡', cls:'lb-preworkout' },
  omega:      { label:'Omega/Fish',  icon:'🐟', cls:'lb-omega' },
  mineral:    { label:'Mineral',     icon:'🪨', cls:'lb-mineral' },
  other:      { label:'Other',       icon:'📦', cls:'lb-other' },
};

export const GOALS = ['cutting','bulking','recovery','maintenance','custom'];

export const TIMING_OPTS = [
  'Pagi',
  'Pagi (dengan makan)',
  'Pre-workout',
  'Post-workout',
  'Siang',
  'Sore',
  'Sebelum tidur',
  'Bebas (kapan saja)'
];

// Mutable refs populated by supabase.loadSupplements()
export let SUPPLEMENTS = [];
export function _setSupplements(arr){ SUPPLEMENTS = arr; }
