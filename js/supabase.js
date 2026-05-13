// Supabase config + auth + DB layer.
// Pattern: bypass GoTrueClient (navigator.locks hang di Chrome incognito) dengan
// authFetch + JWT cache. Lihat pep_fl/js/supabase.js untuk root context.
import { _setSupplements, SUPPLEMENTS } from './data.js?v=2';
import { S } from './state.js?v=2';

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

// JWT cache (set via onAuthStateChange callback, fallback localStorage)
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

// ── Save indicator ──
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
  // Returns array of updated rows; empty = RLS rejection.
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

// ── DAILY LOG ──
export async function loadLog(){
  S.logToday = [];
  S.logRecent = [];
  if(!S.user) return;
  // Recent 30 days
  const sinceISO = new Date(Date.now() - 30*86400000).toISOString();
  const data = await authFetch('supp_consumption_log',
    `select=*&user_id=eq.${S.user.id}&consumed_at=gte.${sinceISO}&order=consumed_at.desc`);
  S.logRecent = data || [];
  S.logToday = (data||[]).filter(r => {
    const d = new Date(r.consumed_at);
    return d.toDateString() === new Date().toDateString();
  });
}

export async function addLogEntry(suppId, qtyServings, consumedAt, notes){
  if(!S.user){ alert('Login dulu'); return; }
  const data = await authFetch('supp_consumption_log', '', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: S.user.id,
      supplement_id: suppId,
      qty_servings: qtyServings,
      consumed_at: consumedAt || new Date().toISOString(),
      notes: notes || null,
    })
  });
  const row = Array.isArray(data) ? data[0] : data;
  if(row){
    S.logRecent.unshift(row);
    if(new Date(row.consumed_at).toDateString() === new Date().toDateString()){
      S.logToday.unshift(row);
    }
  }
  showSaveInd();
}

export async function deleteLogEntry(id){
  if(!S.user) return;
  await authFetch('supp_consumption_log',
    `id=eq.${id}&user_id=eq.${S.user.id}`,
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  S.logToday = S.logToday.filter(r => r.id !== id);
  S.logRecent = S.logRecent.filter(r => r.id !== id);
  showSaveInd();
}

// ── STACKS ──
export async function loadStacks(){
  S.stacks = [];
  S.stackItemsByStack = {};
  if(!S.user) return;
  const stacks = await authFetch('supp_stacks',
    `select=*&user_id=eq.${S.user.id}&order=created_at.desc`);
  S.stacks = stacks || [];
  if(S.stacks.length === 0) return;
  const ids = S.stacks.map(s => s.id).join(',');
  const items = await authFetch('supp_stack_items',
    `select=*&stack_id=in.(${ids})`);
  (items||[]).forEach(it => {
    if(!S.stackItemsByStack[it.stack_id]) S.stackItemsByStack[it.stack_id] = [];
    S.stackItemsByStack[it.stack_id].push(it);
  });
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
    // onAuthStateChange listener akan trigger reload & render.
  } catch(e){
    errEl.textContent = 'Login gagal: ' + (e.message || e);
  }
}

export function doLogout(){
  // Manual: clear localStorage Supabase keys + reset state.
  try {
    Object.keys(localStorage).forEach(k => {
      if(k.startsWith('sb-')) localStorage.removeItem(k);
    });
  } catch(_){}
  _jwt = null;
  S.user = null;
  S.inventoryBySupp = {};
  S.logToday = [];
  S.logRecent = [];
  S.stacks = [];
  S.stackItemsByStack = {};
  updateAuthUI(null);
  window.renderPanels && window.renderPanels();
  // Fire-and-forget — kalau supa.auth.signOut hang, skip.
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

// Timeout wrapper (avoid hang block)
function withTimeout(promise, ms, label){
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timeout ${ms}ms`)), ms))
  ]);
}

// Initial data load — supplements (public) + user tables (if auth)
export async function loadInitial(){
  await loadSupplements();
  if(!S.user) return;
  await Promise.allSettled([
    withTimeout(loadInventory(), 8000, 'inventory'),
    withTimeout(loadLog(), 8000, 'log'),
    withTimeout(loadStacks(), 8000, 'stacks'),
  ]);
}

// Re-export caches for window binding from main.js
export { _jwt };
