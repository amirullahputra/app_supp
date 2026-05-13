// Entry — error boundary, tab routing, modal + DM/Budget handlers, init flow.

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

import { S, initDMMaps } from './state.js?v=11';
import { SUPPLEMENTS, CAT, QUARTERS } from './data.js?v=11';
import {
  loadSupplements, saveSupplementEdit, createSupplement,
  loadInventory, saveInventory,
  loadAllDMStages, setDMStage, removeDMStage,
  loadAllBudgets, saveBudget,
  loadInitial,
  openAuthModal, closeAuthModal, doLogin, doLogout, onAuthBtnClick,
  updateAuthUI, setupAuthListener, supa
} from './supabase.js?v=11';
import * as panelFns from './panels.js?v=11';
import * as supaFns from './supabase.js?v=11';
import * as stateModule from './state.js?v=11';

Object.assign(window, panelFns, supaFns, stateModule, { S, SUPPLEMENTS, CAT });

// ── TAB DEFS ──
const TABS = [
  { id: 0, label: '📊 Overview',       fn: 'pOverview'  },
  { id: 1, label: '🎯 Decision Matrix', fn: 'pDM'        },
  { id: 2, label: '💰 Budget',          fn: 'pBudget'    },
  { id: 3, label: '📚 Compounds',       fn: 'pCompounds' },
];

window.setTab = function(idx){
  S.tab = idx;
  renderTabs();
  renderPanels();
};

window.setQuarter = function(qid){
  S.quarter = qid;
  S.viewAll = false;
  renderPanels();
};

window.setViewAll = function(){
  S.viewAll = !S.viewAll;
  renderPanels();
};

window.setBudCap = function(v){
  S.budCap = parseInt(v) || 1000000;
};

// ── FILTER HANDLERS (search + tier chips) ──
let _searchDebounce = null;
window.setSearch = function(v){
  S.search = v || '';
  if(_searchDebounce) clearTimeout(_searchDebounce);
  _searchDebounce = setTimeout(() => renderPanels(), 200);
};

window.setTierFilter = function(t){
  S.tierFilter = t;
  renderPanels();
};

window.clearFilters = function(){
  S.search = '';
  S.tierFilter = null;
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
  // Preserve focus + cursor position untuk avoid input "patah-patah" pas search
  const focused = document.activeElement;
  const focusId = focused?.id;
  const selStart = (focused && 'selectionStart' in focused) ? focused.selectionStart : null;
  const selEnd   = (focused && 'selectionEnd'   in focused) ? focused.selectionEnd   : null;

  const tab = TABS[S.tab] || TABS[0];
  const fn = panelFns[tab.fn];
  root.innerHTML = fn ? fn() : '<div class="card">Tab not found</div>';

  if(focusId){
    const el = document.getElementById(focusId);
    if(el && typeof el.focus === 'function'){
      el.focus();
      if(selStart != null && typeof el.setSelectionRange === 'function'){
        try { el.setSelectionRange(selStart, selEnd ?? selStart); } catch(_){}
      }
    }
  }
}
window.renderPanels = renderPanels;

// ── DECISION MATRIX HANDLERS (click + drag-drop) ──
window.dmMove = async function(suppId, toStage){
  if(!S.user){ alert('Login dulu'); return; }
  try {
    await setDMStage(S.quarter, suppId, toStage);
    renderPanels();
  } catch(e){ alert('Gagal save: '+(e.message||e)); }
};

window.dmRemove = async function(suppId){
  if(!S.user) return;
  try {
    await removeDMStage(S.quarter, suppId);
    renderPanels();
  } catch(e){ alert('Gagal remove: '+(e.message||e)); }
};

// Drag-and-drop: pakai HTML5 DnD API
let _dragState = null;

window.dmDragStart = function(event, suppId, sourceZone){
  _dragState = { suppId, sourceZone };
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(suppId));
  // Visual feedback on dragged card
  event.target.classList.add('dragging');
};

window.dmDragEnd = function(event){
  event.target.classList.remove('dragging');
  // Cleanup any leftover drag-over class
  document.querySelectorAll('.dm-col.drag-over').forEach(el => el.classList.remove('drag-over'));
};

window.dmDrop = async function(event, targetZone){
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  if(!_dragState){ return; }
  const { suppId, sourceZone } = _dragState;
  _dragState = null;
  if(sourceZone === targetZone){ return; }  // dropped in same column
  if(!S.user){ alert('Login dulu'); return; }
  try {
    if(targetZone === 'active'){
      await setDMStage(S.quarter, suppId, 'deal');
    } else if(targetZone === 'library'){
      await removeDMStage(S.quarter, suppId);
    }
    renderPanels();
  } catch(e){ alert('Gagal: '+(e.message||e)); }
};

// ── BUDGET HANDLERS ──
window.toggleBudSel = function(suppId){
  const qid = S.quarter;
  if(!S.budSelByQuarter[qid]){
    // Init dari deal supplements kalau belum ada selection
    S.budSelByQuarter[qid] = new Set();
    const dmMap = S.dmByQuarter[qid] || new Map();
    dmMap.forEach((stage, id) => { if(stage === 'deal') S.budSelByQuarter[qid].add(id); });
  }
  const sel = S.budSelByQuarter[qid];
  if(sel.has(suppId)) sel.delete(suppId);
  else sel.add(suppId);
  renderPanels();
};

window.saveBudgetCurrent = async function(){
  const qid = S.quarter;
  const sel = S.budSelByQuarter[qid] || new Set();
  try {
    await saveBudget(qid, sel, S.budCap);
  } catch(e){ alert('Gagal save: '+(e.message||e)); }
};

// ── MODAL: SUPPLEMENT EDIT ──
window.openSuppEdit = function(suppId){
  const s = suppId ? SUPPLEMENTS.find(x => x.id === suppId) : null;
  document.getElementById('supp-edit-title').textContent = s ? 'Edit Supplement' : 'Tambah Supplement';
  document.getElementById('supp-edit-id').value = suppId || '';
  document.getElementById('se-name').value     = s?.name || '';
  document.getElementById('se-cat').value      = s?.category || 'vitamin';
  document.getElementById('se-brand').value    = s?.brand || '';
  document.getElementById('se-unit').value     = s?.unit || 'tablet';
  document.getElementById('se-dose').value     = s?.dose_per_serving || '';
  document.getElementById('se-doseunit').value = s?.dose_unit || 'mg';
  document.getElementById('se-servings').value = s?.servings_per_container || '';
  document.getElementById('se-daily').value    = s?.daily_servings ?? 1;
  document.getElementById('se-price').value    = s?.price_idr || '';
  document.getElementById('se-score').value    = s?.efficiency_score ?? '';
  document.getElementById('se-timing').value   = s?.timing_note || '';
  document.getElementById('se-notes').value    = s?.notes || '';
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
    daily_servings: parseFloat(document.getElementById('se-daily').value) || 1,
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

// ── BOOTSTRAP ──
async function init(){
  initDMMaps();
  renderTabs();
  renderPanels();
  try {
    await loadSupplements();
    Object.assign(window, { SUPPLEMENTS });
    renderPanels();
  } catch(e){
    showInitError('Load Catalog Failed', e);
  }
  setupAuthListener(async (event, session) => {
    if(session?.user){
      try { await loadInitial(); } catch(_){}
    }
    renderPanels();
  });
}

init();
