// State container — single source of truth for runtime data.
import { SUPPLEMENTS } from './data.js?v=2';

export let S = {
  user: null,
  tab: 0,                       // 0=Catalog 1=Inventory 2=Daily Log 3=Stacks 4=Overview
  // Caches keyed by supplement_id
  inventoryBySupp: {},          // {supp_id: {qty_containers, qty_servings_remaining, min_threshold}}
  logToday: [],                 // [{id, supplement_id, consumed_at, qty_servings, notes}]
  logRecent: [],                // last 30 days
  stacks: [],                   // user's stacks list
  stackItemsByStack: {},        // {stack_id: [items]}
};

// Format Rupiah
export const rp  = n => 'Rp '+Math.round(n).toLocaleString('id-ID');
export const rpM = n => n>=1e6 ? 'Rp '+(n/1e6).toFixed(n%1e6===0?0:1)+' jt' : rp(n);

// Score color (tinggi = hijau, rendah = merah)
export function scoreCol(s){
  if(s == null) return 'var(--t3)';
  if(s >= 85) return 'var(--vit)';   // green
  if(s >= 65) return 'var(--pro)';   // amber
  if(s >= 45) return 'var(--pwo)';   // red-orange
  return 'var(--t3)';                // gray
}
export function scoreLabel(s){
  if(s == null) return '—';
  if(s >= 85) return 'Strong';
  if(s >= 65) return 'Proven';
  if(s >= 45) return 'Situational';
  return 'Weak';
}

// Date helpers
export function todayISO(){ return new Date().toISOString().split('T')[0]; }
export function isToday(d){
  const t = new Date();
  const x = new Date(d);
  return t.toDateString() === x.toDateString();
}
export function daysAgo(d){
  const ms = Date.now() - new Date(d).getTime();
  return Math.floor(ms / 86400000);
}

// Compute servings consumed per day average from recent log
// Returns avg servings/day for a supplement (across last 7 days with log entries)
export function avgDailyServings(supplementId){
  const last7 = S.logRecent.filter(r =>
    r.supplement_id === supplementId && daysAgo(r.consumed_at) <= 7
  );
  if(!last7.length) return 0;
  const byDay = {};
  last7.forEach(r => {
    const day = new Date(r.consumed_at).toDateString();
    byDay[day] = (byDay[day]||0) + Number(r.qty_servings||0);
  });
  const days = Object.keys(byDay).length || 1;
  const total = Object.values(byDay).reduce((a,b)=>a+b, 0);
  return total / days;
}

// Estimate days-to-empty for a supplement given its inventory + avg consumption.
// Returns null kalau belum cukup data.
export function daysToEmpty(supp){
  const inv = S.inventoryBySupp[supp.id];
  if(!inv) return null;
  const containers = inv.qty_containers || 0;
  const partialServings = inv.qty_servings_remaining || 0;
  const servingsPerContainer = supp.servings_per_container || 0;
  if(!servingsPerContainer) return null;
  const totalServings = containers * servingsPerContainer + partialServings;
  if(totalServings <= 0) return 0;
  const rate = avgDailyServings(supp.id);
  if(rate <= 0) return null; // no log = unknown
  return Math.floor(totalServings / rate);
}

// Inventory status: 'empty' | 'restock' | 'ok'
export function inventoryStatus(supp){
  const inv = S.inventoryBySupp[supp.id];
  if(!inv || inv.qty_containers <= 0) return 'empty';
  if(inv.qty_containers <= (inv.min_threshold || 1)) return 'restock';
  return 'ok';
}

// Cost calculations
export function monthlyCost(supp, servingsPerDay){
  // Cost per serving × servings/day × 30
  if(!supp.servings_per_container || !supp.price_idr) return 0;
  const costPerServing = supp.price_idr / supp.servings_per_container;
  return costPerServing * servingsPerDay * 30;
}
