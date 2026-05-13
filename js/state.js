// State container + cost utilities — single source of truth for runtime data.
import { SUPPLEMENTS, QUARTERS, VISIBLE_QIDS } from './data.js?v=15';

function defaultQuarter(){
  const today = new Date();
  const q = Math.floor(today.getMonth()/3) + 1;
  const cur = `Q${q}_${today.getFullYear()}`;
  // Kalau current quarter di VISIBLE list, pakai. Else fallback ke Q3_2026 (anchor protocol)
  if(VISIBLE_QIDS.includes(cur)) return cur;
  return VISIBLE_QIDS[0] || 'Q3_2026';
}

export let S = {
  user: null,
  tab: 0,                       // 0=Overview 1=DM 2=Budget 3=Compounds
  quarter: defaultQuarter(),    // active quarter for DM/Budget view (kalau viewAll=false)
  viewAll: true,                // DEFAULT: Grand Total mode (aggregate 4Q overview)
  budCap: 1000000,              // monthly budget cap (Rp 1jt default)
  search: '',                   // global search (filter by name/brand)
  tierFilter: null,             // null = all, atau 'S'|'A'|'B'|'C'|'D'|'F'
  // Caches keyed by supplement_id / quarter_id
  inventoryBySupp: {},          // {supp_id: {qty_containers, qty_servings_remaining, min_threshold}}
  dmByQuarter: {},              // {qid: Map<supp_id, stage>}
  budSelByQuarter: {},          // {qid: Set<supp_id>} — final checkbox state
};

// Extract tier (S/A/B/C/D/F) dari notes field. Mostly notes start with "X tier ..."
export function extractTier(notes){
  if(!notes) return null;
  const m = String(notes).match(/\b([SABCDF])\s+tier\b/);
  return m ? m[1].toUpperCase() : null;
}

// Extract "kandungan/ingredient" — fungsional name aja, tanpa dose + brand.
// Cap max 2 kata supaya brand prefix kayak "ON Gold Standard" ke-strip.
// Dipakai untuk dedupe di Running Sekarang (Vit D3 5000 + 10000 → 1 row "Vit D3").
// - "Vitamin D3 5000 IU Thorne"      → "Vitamin D3"
// - "Creatine Monohydrate 1kg"       → "Creatine Monohydrate"
// - "Iron Bisglycinate 25 mg Thorne" → "Iron Bisglycinate"
// - "Whey Isolate ON Gold Standard"  → "Whey Isolate"
// - "ALCAR 1000 mg"                  → "ALCAR"
// - "EAA Essential Amino Acids"      → "EAA Essential"
export function ingredientName(name){
  if(!name) return '';
  const units = new Set(['g','mg','mcg','kg','iu','lbs','ml','oz','tablet','capsule','scoop','softgel','lozenge']);
  const parts = String(name).trim().split(/\s+/);
  const out = [];
  for(const p of parts){
    if(/^\d/.test(p)) break;
    if(units.has(p.toLowerCase())) break;
    out.push(p);
    if(out.length >= 2) break;  // cap 2 words
  }
  return (out.join(' ') || name).trim();
}

// Extract "function + dose key" dari nama untuk grouping di container needs (dose-aware).
// Logic: func name + dose value + unit. Brand suffix di-strip.
// - "Creatine Monohydrate 300g ON"   → "Creatine Monohydrate 300g"
// - "Vitamin D3 5000 IU Thorne"      → "Vitamin D3 5000 IU"
// - "Vitamin D3 10000 IU"            → "Vitamin D3 10000 IU"  (beda dose = beda group)
// - "Iron Bisglycinate 25 mg Thorne" → "Iron Bisglycinate 25 mg"
// - "EAA Essential Amino Acids"      → "EAA Essential Amino Acids" (no number, full name)
export function funcKey(name){
  if(!name) return '';
  const tokens = String(name).trim().split(/\s+/);
  // Find first token yang start dgn digit (= dose)
  let numIdx = -1;
  for(let i=0; i<tokens.length; i++){
    if(/^\d/.test(tokens[i])){ numIdx = i; break; }
  }
  if(numIdx < 0) return name;  // no number = pakai full name
  // Include next token kalau unit (mg, IU, g, dll)
  const units = new Set(['g','mg','mcg','kg','iu','lbs','ml','oz','tablet','capsule','scoop','softgel','lozenge']);
  let endIdx = numIdx;
  if(numIdx+1 < tokens.length && units.has(tokens[numIdx+1].toLowerCase())){
    endIdx = numIdx + 1;
  }
  return tokens.slice(0, endIdx+1).join(' ');
}

// Apply S.search + S.tierFilter ke supplement list (Compounds + DM Library)
export function applyFilters(arr){
  const q = (S.search||'').trim().toLowerCase();
  const tier = S.tierFilter;
  return arr.filter(s => {
    if(tier && extractTier(s.notes) !== tier) return false;
    if(q){
      const hay = `${s.name||''} ${s.brand||''} ${s.notes||''}`.toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}

// Init empty DM map for all quarters (called after load)
export function initDMMaps(){
  QUARTERS.forEach(q => {
    if(!S.dmByQuarter[q]) S.dmByQuarter[q] = new Map();
  });
}

// ── FORMATTERS ──
export const rp  = n => 'Rp '+Math.round(n).toLocaleString('id-ID');
export const rpM = n => n>=1e6 ? 'Rp '+(n/1e6).toFixed(n%1e6===0?0:1)+' jt' : rp(n);

// 'Q3_2026' → 'Q3 2026'
export const quarterLabel = qid => qid.replace('_',' ');

// ── QUARTER UTILS ──
export function daysInQuarter(qid){
  const [q, yr] = qid.split('_');
  const year = parseInt(yr);
  const qNum = parseInt(q.replace('Q',''));
  const start = new Date(year, (qNum-1)*3, 1);
  const end   = new Date(year, qNum*3, 0);
  return Math.floor((end - start) / 86400000) + 1;
}

// Date range untuk quarter (display)
export function quarterDateRange(qid){
  const [q, yr] = qid.split('_');
  const year = parseInt(yr);
  const qNum = parseInt(q.replace('Q',''));
  const start = new Date(year, (qNum-1)*3, 1);
  const end   = new Date(year, qNum*3, 0);
  return { start, end };
}

// ── COST CALCULATIONS ──
// Cost untuk 1 supplement di 1 quarter
export function quarterCost(supp, qid){
  if(!supp) return { servings:0, containers:0, cost:0 };
  const days  = daysInQuarter(qid);
  const daily = supp.daily_servings || 1;
  const totalServings = days * daily;
  const spc   = supp.servings_per_container || 30;
  const containers = totalServings > 0 ? Math.ceil(totalServings / spc) : 0;
  return {
    servings: totalServings,
    containers,
    cost: containers * (supp.price_idr || 0)
  };
}

// Monthly cost (30 days)
export function monthlyCost(supp){
  if(!supp) return 0;
  const daily = supp.daily_servings || 1;
  const monthlyServings = daily * 30;
  const spc = supp.servings_per_container || 30;
  return (monthlyServings / spc) * (supp.price_idr || 0);
}

// Selection source per quarter — Budget Filter checkbox = final deal,
// fallback ke DM stage='deal' kalau Budget belum di-set.
export function selFor(qid){
  const bs = S.budSelByQuarter?.[qid];
  if(bs && bs.size > 0) return bs;
  // Fallback: DM 'deal' supplements
  const out = new Set();
  const dmMap = S.dmByQuarter?.[qid];
  if(dmMap){
    dmMap.forEach((stage, suppId) => {
      if(stage === 'deal') out.add(suppId);
    });
  }
  return out;
}

// ── INVENTORY STATUS HELPERS ──
export function inventoryStatus(supp){
  const inv = S.inventoryBySupp[supp.id];
  if(!inv || inv.qty_containers <= 0) return 'empty';
  if(inv.qty_containers <= (inv.min_threshold || 1)) return 'restock';
  return 'ok';
}

// Days-to-empty based on daily_servings (deterministic, no log dependency)
export function daysToEmpty(supp){
  const inv = S.inventoryBySupp[supp.id];
  if(!inv) return null;
  const containers = inv.qty_containers || 0;
  const partial   = inv.qty_servings_remaining || 0;
  const spc       = supp.servings_per_container || 0;
  const daily     = supp.daily_servings || 1;
  if(!spc || daily <= 0) return null;
  const totalServings = containers * spc + partial;
  if(totalServings <= 0) return 0;
  return Math.floor(totalServings / daily);
}

// ── SCORE HELPERS ──
export function scoreCol(s){
  if(s == null) return 'var(--t3)';
  if(s >= 85) return 'var(--vit)';
  if(s >= 65) return 'var(--pro)';
  if(s >= 45) return 'var(--pwo)';
  return 'var(--t3)';
}
export function scoreLabel(s){
  if(s == null) return '—';
  if(s >= 85) return 'Strong';
  if(s >= 65) return 'Proven';
  if(s >= 45) return 'Situational';
  return 'Weak';
}
