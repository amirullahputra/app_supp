// Entry point — error boundary, tab routing, modal handlers, init flow.

// Global error boundary (banner red kalau ada throw/unhandled rejection)
function showInitError(label, err){
  const root = document.getElementById('panels-root');
  if(!root) return;
  root.innerHTML = `<div class="err-banner">
    <div class="err-banner-title">🔥 ${label}</div>
    <div class="err-banner-body">${(err?.message || err || 'Unknown error').toString().slice(0,500)}</div>
  </div>`;
}
window.addEventListener('error', (e) => showInitError('Script Error', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => showInitError('Promise Rejection', e.reason));

import { S } from './state.js?v=2';
import { SUPPLEMENTS, CAT, TIMING_OPTS } from './data.js?v=2';
import {
  loadSupplements, saveSupplementEdit, createSupplement,
  loadInventory, saveInventory,
  loadLog, addLogEntry, deleteLogEntry,
  loadStacks, loadInitial,
  openAuthModal, closeAuthModal, doLogin, doLogout, onAuthBtnClick,
  updateAuthUI, setupAuthListener, supa
} from './supabase.js?v=2';
import * as panelFns from './panels.js?v=2';
import * as supaFns from './supabase.js?v=2';
import * as stateModule from './state.js?v=2';

// Expose to window for inline onclick handlers
Object.assign(window, panelFns, supaFns, stateModule, { S, SUPPLEMENTS, CAT });

// ── TAB DEFS ──
const TABS = [
  { id: 0, label: '📚 Catalog',   fn: 'pCatalog'   },
  { id: 1, label: '📦 Inventory', fn: 'pInventory' },
  { id: 2, label: '📝 Daily Log', fn: 'pDailyLog'  },
  { id: 3, label: '🎯 Stacks',    fn: 'pStacks'    },
  { id: 4, label: '📊 Overview',  fn: 'pOverview'  },
];

window.setTab = function(idx){
  S.tab = idx;
  renderTabs();
  renderPanels();
};

function renderTabs(){
  const root = document.getElementById('tabs-root');
  if(!root) return;
  root.innerHTML = TABS.map(t =>
    `<button class="tab ${S.tab===t.id?'act':''}" onclick="setTab(${t.id})">${t.label}</button>`
  ).join('');
}

function renderPanels(){
  const root = document.getElementById('panels-root');
  if(!root) return;
  const tab = TABS[S.tab] || TABS[0];
  const fn = panelFns[tab.fn];
  root.innerHTML = fn ? fn() : '<div class="card">Tab not found</div>';
}
window.renderPanels = renderPanels;

// ── MODAL: SUPPLEMENT EDIT ──
window.openSuppEdit = function(suppId){
  const s = suppId ? SUPPLEMENTS.find(x => x.id === suppId) : null;
  document.getElementById('supp-edit-title').textContent = s ? 'Edit Supplement' : 'Tambah Supplement';
  document.getElementById('supp-edit-id').value = suppId || '';
  document.getElementById('se-name').value = s?.name || '';
  document.getElementById('se-cat').value = s?.category || 'vitamin';
  document.getElementById('se-brand').value = s?.brand || '';
  document.getElementById('se-unit').value = s?.unit || 'tablet';
  document.getElementById('se-dose').value = s?.dose_per_serving || '';
  document.getElementById('se-doseunit').value = s?.dose_unit || 'mg';
  document.getElementById('se-servings').value = s?.servings_per_container || '';
  document.getElementById('se-price').value = s?.price_idr || '';
  document.getElementById('se-score').value = s?.efficiency_score ?? '';
  document.getElementById('se-timing').value = s?.timing_note || '';
  document.getElementById('se-notes').value = s?.notes || '';
  document.getElementById('supp-edit-err').textContent = '';
  document.getElementById('supp-edit-modal').classList.add('open');
};

window.closeSuppEdit = function(){
  document.getElementById('supp-edit-modal').classList.remove('open');
};

window.saveSuppEdit = async function(){
  const id = document.getElementById('supp-edit-id').value;
  const errEl = document.getElementById('supp-edit-err');
  errEl.textContent = 'Menyimpan...';
  const payload = {
    name: document.getElementById('se-name').value.trim(),
    category: document.getElementById('se-cat').value,
    brand: document.getElementById('se-brand').value.trim() || null,
    unit: document.getElementById('se-unit').value,
    dose_per_serving: parseFloat(document.getElementById('se-dose').value) || null,
    dose_unit: document.getElementById('se-doseunit').value,
    servings_per_container: parseInt(document.getElementById('se-servings').value) || null,
    price_idr: parseInt(document.getElementById('se-price').value) || null,
    efficiency_score: parseInt(document.getElementById('se-score').value) || null,
    timing_note: document.getElementById('se-timing').value.trim() || null,
    notes: document.getElementById('se-notes').value.trim() || null,
  };
  if(!payload.name){ errEl.textContent = 'Name wajib diisi'; return; }
  try {
    if(id){ await saveSupplementEdit(Number(id), payload); }
    else  { await createSupplement(payload); }
    window.closeSuppEdit();
    renderPanels();
  } catch(e){
    errEl.textContent = 'Error: ' + (e.message || e);
  }
};

// ── MODAL: INVENTORY ──
window.openInvModal = function(suppId){
  const s = SUPPLEMENTS.find(x => x.id === suppId);
  if(!s) return;
  document.getElementById('inv-modal-title').textContent = 'Update Stok — ' + s.name;
  document.getElementById('inv-supp-id').value = suppId;
  const inv = S.inventoryBySupp[suppId];
  document.getElementById('inv-qty').value = inv?.qty_containers || 0;
  document.getElementById('inv-thr').value = inv?.min_threshold || 1;
  document.getElementById('inv-modal').classList.add('open');
};

window.closeInvModal = function(){
  document.getElementById('inv-modal').classList.remove('open');
};

window.saveInv = async function(){
  const id = Number(document.getElementById('inv-supp-id').value);
  const qty = parseInt(document.getElementById('inv-qty').value) || 0;
  const thr = parseInt(document.getElementById('inv-thr').value) || 1;
  try {
    await saveInventory(id, qty, thr);
    window.closeInvModal();
    renderPanels();
  } catch(e){ alert('Gagal save: ' + (e.message || e)); }
};

// ── MODAL: LOG ENTRY ──
window.openLogModal = function(suppId){
  const s = SUPPLEMENTS.find(x => x.id === suppId);
  if(!s) return;
  document.getElementById('log-modal-title').textContent = 'Catat — ' + s.name;
  document.getElementById('log-supp-id').value = suppId;
  document.getElementById('log-qty').value = 1;
  // datetime-local needs format YYYY-MM-DDTHH:MM
  const now = new Date();
  const iso = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  document.getElementById('log-when').value = iso;
  document.getElementById('log-notes').value = '';
  document.getElementById('log-modal').classList.add('open');
};

window.closeLogModal = function(){
  document.getElementById('log-modal').classList.remove('open');
};

window.saveLog = async function(){
  const id = Number(document.getElementById('log-supp-id').value);
  const qty = parseFloat(document.getElementById('log-qty').value) || 1;
  const whenLocal = document.getElementById('log-when').value;
  const notes = document.getElementById('log-notes').value.trim();
  // datetime-local interpreted as local — convert to ISO UTC
  const consumedAt = whenLocal ? new Date(whenLocal).toISOString() : null;
  try {
    await addLogEntry(id, qty, consumedAt, notes);
    window.closeLogModal();
    renderPanels();
  } catch(e){ alert('Gagal catat: ' + (e.message || e)); }
};

window.deleteLog = async function(id){
  if(!confirm('Hapus log entry ini?')) return;
  try {
    await deleteLogEntry(id);
    renderPanels();
  } catch(e){ alert('Gagal hapus: ' + (e.message || e)); }
};

// ── BOOTSTRAP ──
async function init(){
  renderTabs();
  renderPanels();

  // Try load catalog (public) immediately
  try {
    await loadSupplements();
    Object.assign(window, { SUPPLEMENTS }); // refresh after load
    renderPanels();
  } catch(e){
    showInitError('Load Catalog Failed', e);
  }

  // Auth listener — reload user tables saat login/logout
  setupAuthListener(async (event, session) => {
    if(session?.user){
      try { await loadInitial(); } catch(_){}
    }
    renderPanels();
  });
}

init();
