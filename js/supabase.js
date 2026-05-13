// Supabase config + auth + DB layer.
// Pattern: bypass GoTrueClient (navigator.locks hang di Chrome incognito) dengan
// authFetch + JWT cache. Mirror pep_fl/js/supabase.js.
import { _setSupplements, SUPPLEMENTS, QUARTERS } from './data.js?v=8';
import { S, initDMMaps } from './state.js?v=8';

const SUPA_URL = 'https://guhhoqpvwzzrlwgfugsb.supabase.co';
const SUPA_KEY = 'sb_publishable_yu8KTS5mId2hV7kVjScvZA_-geYqKHv';
export const supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);

// ── REST helpers ──
async function restFetch(table, query=''){
  const url = `${SUPA_URL}/rest/v1/${table}${query?'?'+query:''}`;
  const res = await fetch(url, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } });
  if(!res.ok){
    const body = await res.text().catch(()=>'');
    throw new Error(`${table}: HTTP ${res.status} ${body.slice(0,200)}`);
  }
  return res.json();
}

let _jwt = null;
function readJwtFromStorage(){
  try {
    const projectRef = SUPA_URL.match(/https:\/\/([^.]+)/)?.[1];
    if(!projectRef) return null;
    const raw = localStorage.getItem(`sb-${projectRef}-auth-token`);
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token || parsed?.[0] || null;
  } catch(_){ return null; }
}

async function authFetch(table, query='', opts={}){
  const jwt = _jwt || readJwtFromStorage();
  if(!jwt) throw new Error(`${table}: no auth session`);
  const url = `${SUPA_URL}/rest/v1/${table}${query?'?'+query:''}`;
  const headers = {
    apikey: SUPA_KEY,
    Authorization: `Bearer ${jwt}`,
    'Content-Type': 'application/json',
    ...(opts.headers || {})
  };
  const res = await fetch(url, { method: opts.method || 'GET', headers, body: opts.body });
  if(!res.ok){
    const body = await res.text().catch(()=>'');
    throw new Error(`${table}: HTTP ${res.status} ${body.slice(0,200)}`);
  }
  if(res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function showSaveInd(){
  const el = document.getElementById('save-ind');
  if(!el) return;
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), 1800);
}

// ── SUPPLEMENT CATALOG (public read) ──
let _suppLoaded = false;
export async function loadSupplements(){
  if(_suppLoaded) return;
  const rows = await restFetch('supplements',
    'select=*&order=efficiency_score.desc.nullslast,name.asc');
  _setSupplements(rows || []);
  _suppLoaded = true;
}

export async function saveSupplementEdit(id, updates){
  const data = await authFetch('supplements', `id=eq.${id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(updates)
  });
  if(!Array.isArray(data) || data.length === 0){
    throw new Error('RLS reject — pastikan policy supplements_auth_write aktif');
  }
  _suppLoaded = false;
  await loadSupplements();
  showSaveInd();
}

export async function createSupplement(supp){
  const data = await authFetch('supplements', '', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(supp)
  });
  if(!Array.isArray(data) || data.length === 0){
    throw new Error('Gagal create supplement (RLS reject)');
  }
  _suppLoaded = false;
  await loadSupplements();
  showSaveInd();
  return data[0];
}

// ── INVENTORY ──
export async function loadInventory(){
  S.inventoryBySupp = {};
  if(!S.user) return;
  const data = await authFetch('supp_inventory',
    `select=*&user_id=eq.${S.user.id}`);
  (data||[]).forEach(r => {
    S.inventoryBySupp[r.supplement_id] = {
      qty_containers: r.qty_containers || 0,
      qty_servings_remaining: r.qty_servings_remaining || 0,
      min_threshold: r.min_threshold || 1,
    };
  });
}

export async function saveInventory(suppId, qtyContainers, minThreshold){
  if(!S.user){ alert('Login dulu'); return; }
  await authFetch('supp_inventory', 'on_conflict=user_id,supplement_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: S.user.id,
      supplement_id: suppId,
      qty_containers: qtyContainers,
      min_threshold: minThreshold,
      last_updated: new Date().toISOString(),
    })
  });
  S.inventoryBySupp[suppId] = {
    qty_containers: qtyContainers,
    qty_servings_remaining: S.inventoryBySupp[suppId]?.qty_servings_remaining || 0,
    min_threshold: minThreshold,
  };
  showSaveInd();
}

// ── DECISION MATRIX (mirror pep_fl loadDMStages + setDMStage) ──
// Load ALL DM stages user di semua quarter → S.dmByQuarter[qid] = Map<supp_id, stage>
export async function loadAllDMStages(){
  initDMMaps();
  if(!S.user) return;
  const data = await authFetch('supp_dm_stages',
    `select=quarter_id,supplement_id,stage,sort_order&user_id=eq.${S.user.id}`);
  (data||[]).forEach(r => {
    if(!S.dmByQuarter[r.quarter_id]) S.dmByQuarter[r.quarter_id] = new Map();
    S.dmByQuarter[r.quarter_id].set(r.supplement_id, r.stage);
  });
}

// Set/upsert stage untuk 1 supplement di 1 quarter
export async function setDMStage(qid, suppId, stage, sortOrder=100){
  if(!S.user) throw new Error('Login dulu');
  if(!['watchlist','tentatif','deal'].includes(stage)){
    throw new Error('Invalid stage: '+stage);
  }
  await authFetch('supp_dm_stages', 'on_conflict=user_id,quarter_id,supplement_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: S.user.id,
      quarter_id: qid,
      supplement_id: suppId,
      stage,
      sort_order: sortOrder,
      updated_at: new Date().toISOString()
    })
  });
  if(!S.dmByQuarter[qid]) S.dmByQuarter[qid] = new Map();
  S.dmByQuarter[qid].set(suppId, stage);
  showSaveInd();
}

// Remove dari DM (drop balik ke library)
export async function removeDMStage(qid, suppId){
  if(!S.user) return;
  await authFetch('supp_dm_stages',
    `user_id=eq.${S.user.id}&quarter_id=eq.${qid}&supplement_id=eq.${suppId}`,
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  S.dmByQuarter[qid]?.delete(suppId);
  showSaveInd();
}

// ── BUDGET SELECTIONS (per-quarter checkbox state) ──
// Load semua user budget selection → S.budSelByQuarter
export async function loadAllBudgets(){
  S.budSelByQuarter = {};
  if(!S.user) return;
  const data = await authFetch('supp_budget_selections',
    `select=quarter_id,selected_supplement_ids,budget_cap_idr&user_id=eq.${S.user.id}`);
  (data||[]).forEach(r => {
    S.budSelByQuarter[r.quarter_id] = new Set(r.selected_supplement_ids || []);
    // Pakai budget_cap dari quarter aktif sebagai default S.budCap
    if(r.quarter_id === S.quarter && r.budget_cap_idr){
      S.budCap = r.budget_cap_idr;
    }
  });
}

// Save selection + budget cap untuk 1 quarter
export async function saveBudget(qid, selectedIds, budgetCap){
  if(!S.user) return;
  await authFetch('supp_budget_selections', 'on_conflict=user_id,quarter_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: S.user.id,
      quarter_id: qid,
      selected_supplement_ids: [...selectedIds],
      budget_cap_idr: budgetCap,
      updated_at: new Date().toISOString()
    })
  });
  S.budSelByQuarter[qid] = new Set(selectedIds);
  showSaveInd();
}

// ── AUTH ──
export function openAuthModal(){ document.getElementById('auth-modal').classList.add('open'); }
export function closeAuthModal(){
  document.getElementById('auth-modal').classList.remove('open');
  document.getElementById('auth-err').textContent = '';
}

export function updateAuthUI(user){
  const lbl = document.getElementById('auth-user-label');
  const btn = document.getElementById('auth-action-btn');
  if(user){
    lbl.textContent = '👤 ' + user.email.split('@')[0];
    btn.textContent = 'Logout';
  } else {
    lbl.textContent = 'Belum login';
    btn.textContent = 'Login';
  }
}

export function onAuthBtnClick(){
  if(S.user){ doLogout(); } else { openAuthModal(); }
}

export async function doLogin(){
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl = document.getElementById('auth-err');
  errEl.textContent = '';
  if(!email || !password){ errEl.textContent = 'Email + password required'; return; }
  try {
    const { data, error } = await supa.auth.signInWithPassword({ email, password });
    if(error) throw error;
    closeAuthModal();
  } catch(e){
    errEl.textContent = 'Login gagal: ' + (e.message || e);
  }
}

export function doLogout(){
  try {
    Object.keys(localStorage).forEach(k => {
      if(k.startsWith('sb-')) localStorage.removeItem(k);
    });
  } catch(_){}
  _jwt = null;
  S.user = null;
  S.inventoryBySupp = {};
  S.dmByQuarter = {};
  S.budSelByQuarter = {};
  initDMMaps();
  updateAuthUI(null);
  window.renderPanels && window.renderPanels();
  try { supa.auth.signOut(); } catch(_){}
}

export function setupAuthListener(onAuthChange){
  supa.auth.onAuthStateChange((event, session) => {
    if(session?.access_token) _jwt = session.access_token;
    S.user = session?.user || null;
    updateAuthUI(S.user);
    onAuthChange && onAuthChange(event, session);
  });
}

function withTimeout(promise, ms, label){
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timeout ${ms}ms`)), ms))
  ]);
}

// Initial data load
export async function loadInitial(){
  await loadSupplements();
  if(!S.user) return;
  await Promise.allSettled([
    withTimeout(loadInventory(), 8000, 'inventory'),
    withTimeout(loadAllDMStages(), 8000, 'dm'),
    withTimeout(loadAllBudgets(), 8000, 'budget'),
  ]);
}
