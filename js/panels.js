// 4-tab panels mirror pep_fl: Overview · DM · Budget · Compounds.
import { CAT, SUPPLEMENTS, QUARTERS, VISIBLE_QIDS, STAGES } from './data.js?v=11';
import {
  S, rp, rpM, quarterLabel, daysInQuarter, quarterDateRange,
  quarterCost, monthlyCost, selFor,
  inventoryStatus, daysToEmpty,
  scoreCol, scoreLabel,
  extractTier, applyFilters,
  funcKey
} from './state.js?v=11';

// ── HELPERS ──
function emptyState(icon, msg){
  return `<div style="padding:1.5rem;text-align:center;color:var(--t2)">
    <div style="font-size:32px;margin-bottom:8px">${icon}</div>
    <div style="font-size:13px">${msg}</div>
  </div>`;
}

function catBadge(cat){
  const c = CAT[cat] || CAT.other;
  return `<span class="lb ${c.cls}">${c.icon} ${c.label}</span>`;
}

function findSupp(id){ return SUPPLEMENTS.find(s => s.id === id); }

// Tier badge color
function tierBadge(notes){
  const t = extractTier(notes);
  if(!t) return '';
  const col = t === 'S' ? 'var(--vit)' : t === 'A' ? 'var(--pro)' : t === 'B' ? 'var(--cre)' : t === 'C' ? 'var(--t2)' : 'var(--warn)';
  return `<span class="tier-bdg" style="background:${col};color:#fff">${t}</span>`;
}

// Reusable search + tier filter UI bar
const TIERS = ['S','A','B','C','D','F'];
function filterBar(){
  const t = S.tierFilter;
  const chips = ['ALL', ...TIERS].map(x => {
    const val = x === 'ALL' ? null : x;
    const active = (t === val) ? 'act' : '';
    const lbl = x === 'ALL' ? 'All' : `${x}`;
    return `<button class="tier-chip ${active}" onclick="setTierFilter(${val?`'${val}'`:'null'})" title="${x === 'ALL' ? 'All tiers' : x+' tier'}">${lbl}</button>`;
  }).join('');
  return `<div class="filter-bar">
    <input id="search-input" type="search" class="input" placeholder="🔍 Cari name/brand/notes..." value="${S.search||''}"
      oninput="setSearch(this.value)" style="max-width:280px" autocomplete="off">
    <div class="tier-chips">${chips}</div>
    ${(S.search || S.tierFilter) ? `<button class="btn btn-sm" onclick="clearFilters()" style="margin-left:auto">✕ Clear</button>` : ''}
  </div>`;
}

// ── QUARTER ROW (5 cards: Grand Total + 4 quarters) ──
// Render at top of EVERY tab, mirror pep_fl pattern.
export function renderQuarterRow(){
  const allStats = VISIBLE_QIDS.map(qid => {
    const sel = selFor(qid);
    let totalCost = 0, totalContainers = 0;
    sel.forEach(id => {
      const s = findSupp(id);
      if(!s) return;
      const r = quarterCost(s, qid);
      totalCost += r.cost;
      totalContainers += r.containers;
    });
    return { qid, count: sel.size, totalCost, totalContainers };
  });
  const grandCount = allStats.reduce((a,s)=>a+s.count, 0);
  const grandCost  = allStats.reduce((a,s)=>a+s.totalCost, 0);
  const grandCont  = allStats.reduce((a,s)=>a+s.totalContainers, 0);

  const activeQid = S.viewAll ? '__ALL__' : S.quarter;
  const grandActive = S.viewAll ? 'sel' : '';

  const cards = [];
  cards.push(`
    <div class="qcard ${grandActive}" onclick="setViewAll()">
      <div class="qcard-title">GRAND TOTAL · 4Q ${grandActive?'<span class="bdg-act">AKTIF</span>':''}</div>
      <div class="qcard-sub">Multi-Quarter Overview</div>
      <div class="qcard-stats">
        <div><div class="qstat-lbl">Total Cost</div><div class="qstat-val">${rpM(grandCost)}</div></div>
        <div><div class="qstat-lbl">Compounds</div><div class="qstat-val">${grandCount}</div></div>
        <div><div class="qstat-lbl">Total Cont</div><div class="qstat-val">${grandCont}</div></div>
      </div>
    </div>
  `);
  allStats.forEach(s => {
    const active = (!S.viewAll && S.quarter === s.qid) ? 'sel' : '';
    const lbl = quarterLabel(s.qid);
    cards.push(`
      <div class="qcard ${active}" onclick="setQuarter('${s.qid}')">
        <div class="qcard-title">${lbl} ${active?'<span class="bdg-act">AKTIF</span>':''}</div>
        <div class="qcard-sub">${daysInQuarter(s.qid)} hari</div>
        <div class="qcard-stats">
          <div><div class="qstat-lbl">Supps</div><div class="qstat-val">${s.count}</div></div>
          <div><div class="qstat-lbl">Cont</div><div class="qstat-val">${s.totalContainers}</div></div>
          <div><div class="qstat-lbl">Cost</div><div class="qstat-val">${rpM(s.totalCost)}</div></div>
        </div>
      </div>
    `);
  });
  return `<div class="phase-row">${cards.join('')}</div>`;
}

// ── HELPER: scope quarters + active union ──
function getScope(){
  const allMode = S.viewAll === true;
  const qid = S.quarter || QUARTERS[0];
  const qLbl = allMode ? 'All Quarters' : quarterLabel(qid);
  const scopeQuarters = allMode ? VISIBLE_QIDS.filter(q => selFor(q).size > 0) : [qid];
  const activeUnion = new Set();
  scopeQuarters.forEach(q => selFor(q).forEach(id => activeUnion.add(id)));
  return { allMode, qid, qLbl, scopeQuarters, activeUnion };
}

// ── HELPER: render Restock Alert card (used di Budget tab) ──
function restockCardHTML(){
  const { qLbl, scopeQuarters, activeUnion } = getScope();
  const needRestock = SUPPLEMENTS.filter(s => activeUnion.has(s.id) && inventoryStatus(s) !== 'ok');
  if(activeUnion.size === 0){
    return `<div class="card"><div class="card-title"><span class="ico">📋</span> Restock Alert — ${qLbl}</div>
      <div style="padding:14px 0;color:var(--t3);font-size:12px">Belum ada supplement aktif di quarter ini. Buka <button onclick="setTab(1)" class="btn btn-sm btn-primary" style="margin-left:6px">Decision Matrix</button> untuk aktivasi.</div></div>`;
  }
  if(needRestock.length === 0){
    return `<div class="card"><div class="card-title"><span class="ico">✅</span> Restock Alert · ${activeUnion.size} active</div>
      <div style="padding:14px 0;color:var(--vit);font-weight:700">Semua stock supplement aktif aman ✓</div></div>`;
  }
  return `<div class="card">
    <div class="card-title"><span class="ico">⚠️</span> Restock Alert · ${needRestock.length}/${activeUnion.size} active</div>
    <table>
      <thead><tr>
        <th class="c">Tier</th><th>Kategori</th><th>Supplement (Brand)</th>
        <th class="c">Dose</th><th class="c">Score</th><th class="c">Stock</th><th class="c">Habis</th><th class="c">Action</th>
      </tr></thead>
      <tbody>
      ${needRestock.map(s => {
        const inv = S.inventoryBySupp[s.id];
        const qty = inv?.qty_containers || 0;
        const dte = daysToEmpty(s);
        const dteCol = dte !== null && dte <= 7 ? 'var(--warn)' : 'var(--t1)';
        return `<tr>
          <td class="c">${tierBadge(s.notes)}</td>
          <td>${catBadge(s.category)}</td>
          <td>
            <div style="font-weight:700;color:var(--t0)">${s.name}</div>
            <div style="font-size:10px;color:var(--acc);font-weight:600">${s.brand || '—'}</div>
          </td>
          <td class="c"><span class="mono">${s.dose_per_serving || '—'} ${s.dose_unit || s.unit}</span><div style="font-size:9px;color:var(--t3)">${s.daily_servings||1}/hari</div></td>
          <td class="c"><span class="mono" style="color:${scoreCol(s.efficiency_score)};font-weight:800">${s.efficiency_score ?? '—'}</span></td>
          <td class="c"><span class="mono" style="font-size:14px;font-weight:800;color:var(--warn)">${qty}</span><div style="font-size:9px;color:var(--t3)">botol</div></td>
          <td class="c"><span class="mono" style="color:${dteCol};font-weight:700">${dte === null ? '—' : dte+'h'}</span></td>
          <td class="c"><button class="btn btn-sm btn-primary" onclick="openInvModal(${s.id})">Stok →</button></td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
    <div class="note" style="margin-top:8px">Scope: supplement yang ke-centang di Budget Filter (atau Active di DM kalau Budget belum di-set).</div>
  </div>`;
}

// ── HELPER: render Kebutuhan Container card (used di Budget tab) ──
function containerCardHTML(){
  const { qLbl, scopeQuarters, activeUnion } = getScope();
  const sortedSelected = [...activeUnion].map(id => findSupp(id)).filter(Boolean)
    .sort((a,b) => (b.efficiency_score||0) - (a.efficiency_score||0));
  // Group by funcKey (dose-aware): "Vitamin D3 5000 IU" ≠ "Vitamin D3 10000 IU"
  const groupMap = new Map();
  sortedSelected.forEach(s => {
    let containers = 0, cost = 0;
    scopeQuarters.forEach(q => {
      if(selFor(q).has(s.id)){
        const r = quarterCost(s, q);
        containers += r.containers;
        cost += r.cost;
      }
    });
    if(containers <= 0) return;
    const key = funcKey(s.name);
    if(!groupMap.has(key)){
      groupMap.set(key, { funcName: key, cat: s.category, containers: 0, cost: 0 });
    }
    const g = groupMap.get(key);
    g.containers += containers;
    g.cost += cost;
  });
  const groups = [...groupMap.values()].sort((a,b) => b.containers - a.containers);
  const maxC = Math.max(1, ...groups.map(g => g.containers));
  const totalC = groups.reduce((a,g) => a+g.containers, 0);
  const totalCost = groups.reduce((a,g) => a+g.cost, 0);

  return `<div class="card">
    <div class="card-title"><span class="ico">📦</span> Kebutuhan Container — ${qLbl}</div>
    ${groups.length === 0
      ? '<div style="color:var(--t3);font-size:11px;padding:14px 0">Tidak ada kebutuhan container.</div>'
      : groups.map(g => `
          <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--bdr)">
            <div style="width:220px;font-size:12px;display:flex;align-items:center;gap:6px">
              <span class="lb ${CAT[g.cat].cls}" style="font-size:8px;flex-shrink:0">${CAT[g.cat].icon}</span>
              <b style="color:var(--t0)">${g.funcName}</b>
            </div>
            <div style="flex:1;height:12px;background:var(--bg3);border-radius:3px;overflow:hidden">
              <div style="width:${g.containers/maxC*100}%;height:100%;background:var(--acc)"></div>
            </div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:800;min-width:70px;text-align:right;color:var(--acc)">${g.containers} btl</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;min-width:80px;text-align:right;color:var(--t2)">${rpM(g.cost)}</div>
          </div>`).join('') +
        `<div style="border-top:2px solid var(--bdr2);margin-top:10px;padding-top:10px;display:flex;justify-content:space-between">
          <span style="font-size:11px;font-weight:800">Total Cost: <span style="font-family:'JetBrains Mono',monospace;color:var(--acc)">${rpM(totalCost)}</span></span>
          <span style="font-size:11px;font-weight:800">Total: <span style="font-family:'JetBrains Mono',monospace;color:var(--acc)">${totalC} container</span></span>
        </div>`
    }
  </div>`;
}

// ════════════════════════════════════════════════════════════
// TAB 0 — OVERVIEW (data bersih — biaya per kategori + supplement selected)
// ════════════════════════════════════════════════════════════
export function pOverview(){
  if(!SUPPLEMENTS.length) return `<div class="card">${emptyState('⏳', 'Loading...')}</div>`;
  const { qLbl, scopeQuarters, activeUnion } = getScope();

  // ── Card 1: Biaya per Kategori
  const cc = {}; Object.keys(CAT).forEach(k => cc[k] = 0);
  scopeQuarters.forEach(q => {
    const sel = selFor(q);
    sel.forEach(id => {
      const s = findSupp(id);
      if(!s) return;
      cc[s.category] = (cc[s.category]||0) + quarterCost(s, q).cost;
    });
  });
  const mxcc = Math.max(...Object.values(cc), 1);
  const catBars = Object.entries(cc).filter(([,v]) => v > 0).map(([k,v]) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span class="lb ${CAT[k].cls}" style="font-size:8px;min-width:80px;flex-shrink:0">${CAT[k].icon} ${CAT[k].label}</span>
      <div style="flex:1;height:14px;background:var(--bg3);border-radius:4px;overflow:hidden">
        <div style="width:${v/mxcc*100}%;height:100%;background:var(--acc);border-radius:4px"></div>
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;min-width:70px;text-align:right">${rpM(v)}</div>
    </div>`).join('') || '<div style="color:var(--t3);font-size:11px;padding:10px 0">Belum ada supplement dipilih</div>';

  const biayaCard = `<div class="card">
    <div class="card-title"><span class="ico">📊</span> Biaya per Kategori — ${qLbl}</div>
    ${catBars}
  </div>`;

  // ── Card 2: Supplement Selected (sorted by score)
  const sortedSelected = [...activeUnion].map(id => findSupp(id)).filter(Boolean)
    .sort((a,b) => (b.efficiency_score||0) - (a.efficiency_score||0));
  const maxEff = Math.max(...sortedSelected.map(s => s.efficiency_score||0), 1);
  const selectedCard = `<div class="card">
    <div class="card-title"><span class="ico">🏆</span> Supplement Selected — ${qLbl} (${sortedSelected.length} aktif)</div>
    ${sortedSelected.length === 0
      ? '<div style="color:var(--t3);font-size:11px;padding:14px 0;text-align:center">Belum ada supplement dipilih. <button onclick="setTab(1)" class="btn btn-primary btn-sm" style="margin-left:8px">Buka Decision Matrix →</button></div>'
      : sortedSelected.map((s,i) => {
          const eff = s.efficiency_score || 0;
          return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
            <div style="font-size:9px;color:var(--t3);width:14px;text-align:right">${i+1}</div>
            <span class="lb ${CAT[s.category].cls}" style="font-size:8px;min-width:80px;text-align:center">${CAT[s.category].label}</span>
            <div style="font-size:11px;font-weight:700;color:var(--t0);width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.name}</div>
            <div style="flex:1;height:12px;background:var(--bg3);border-radius:3px;overflow:hidden">
              <div style="width:${Math.round(eff/maxEff*100)}%;height:100%;background:${scoreCol(eff)}"></div>
            </div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;color:${scoreCol(eff)};width:30px;text-align:right">${eff}</div>
            <span style="font-size:8px;color:var(--t3)">EFF</span>
          </div>`;
        }).join('')
    }
  </div>`;

  return `
  ${renderQuarterRow()}
  <div class="grid2">${biayaCard}${selectedCard}</div>`;
}

// ════════════════════════════════════════════════════════════
// TAB 1 — DECISION MATRIX (2-col drag-drop: Library ↔ Active)
// ════════════════════════════════════════════════════════════
export function pDM(){
  if(!SUPPLEMENTS.length) return `<div class="card">${emptyState('⏳', 'Loading...')}</div>`;
  if(!S.user) return `${renderQuarterRow()}<div class="card">${emptyState('🔒', 'Login dulu untuk planning.')}</div>`;
  if(S.viewAll){
    return `${renderQuarterRow()}<div class="card">${emptyState('📊', 'Mode All Quarters aktif. DM cuma per-quarter — pilih quarter di atas.')}</div>`;
  }

  const qid = S.quarter;
  const qLbl = quarterLabel(qid);
  const dmMap = S.dmByQuarter[qid] || new Map();

  // Active = stage 'deal' (binary: library OR active)
  const activeIds = new Set();
  dmMap.forEach((stage, id) => { if(stage === 'deal') activeIds.add(id); });

  // Library = SUPPLEMENTS - active, apply search/tier filter
  const libraryAll = SUPPLEMENTS.filter(s => !activeIds.has(s.id))
    .sort((a,b) => (b.efficiency_score||0) - (a.efficiency_score||0));
  const library = applyFilters(libraryAll);
  const active = SUPPLEMENTS.filter(s => activeIds.has(s.id))
    .sort((a,b) => (b.efficiency_score||0) - (a.efficiency_score||0));

  const renderCard = (s, sourceZone) => {
    const eff = s.efficiency_score || 0;
    return `<div class="dm-card" draggable="true"
      ondragstart="dmDragStart(event, ${s.id}, '${sourceZone}')"
      ondragend="dmDragEnd(event)">
      <div class="dm-card-row">
        <span class="lb ${CAT[s.category].cls}" style="font-size:8px">${CAT[s.category].icon}</span>
        <div class="dm-card-name">${s.name}</div>
        ${tierBadge(s.notes)}
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;color:${scoreCol(eff)}">${eff}</span>
      </div>
      ${s.brand ? `<div class="dm-card-brand">${s.brand}</div>` : ''}
      <div class="dm-card-actions">
        ${sourceZone === 'library'
          ? `<button class="dm-mvbtn dm-mvbtn-active" onclick="dmMove(${s.id}, 'deal')" title="Aktifkan">✅ Aktifkan</button>`
          : `<button class="dm-mvbtn dm-rmbtn" onclick="dmRemove(${s.id})" title="Drop ke Library">↩ Drop</button>`}
      </div>
    </div>`;
  };

  const libCol = `<div class="dm-col"
      ondragover="event.preventDefault(); this.classList.add('drag-over')"
      ondragleave="this.classList.remove('drag-over')"
      ondrop="dmDrop(event, 'library')">
    <div class="dm-col-hdr">📚 Library · ${library.length}${library.length !== libraryAll.length ? ` <span style="font-weight:400;color:var(--t3);font-size:10px">(filtered dari ${libraryAll.length})</span>` : ''}</div>
    <div class="dm-col-body">
      ${library.length === 0
        ? `<div style="color:var(--t3);font-size:11px;padding:14px 0;text-align:center">${libraryAll.length === 0 ? 'Semua supplement aktif' : 'Tidak ada match dengan filter'}</div>`
        : library.map(s => renderCard(s, 'library')).join('')}
    </div>
  </div>`;

  const activeCol = `<div class="dm-col dm-col-active"
      ondragover="event.preventDefault(); this.classList.add('drag-over')"
      ondragleave="this.classList.remove('drag-over')"
      ondrop="dmDrop(event, 'active')">
    <div class="dm-col-hdr dm-col-hdr-active">✅ Active · ${active.length} <span style="font-weight:400;font-size:10px;margin-left:4px">(konsumsi quarter ini)</span></div>
    <div class="dm-col-body">
      ${active.length === 0
        ? `<div style="color:var(--t3);font-size:11px;padding:20px 10px;text-align:center;border:2px dashed var(--bdr2);border-radius:6px;margin:10px 0">⬅️ Drag supplement dari Library<br>atau klik tombol <b>✅ Aktifkan</b></div>`
        : active.map(s => renderCard(s, 'active')).join('')}
    </div>
  </div>`;

  return `${renderQuarterRow()}
  <div class="card">
    <div class="card-title">
      <span class="ico">🎯</span>
      <span>Decision Matrix — ${qLbl}</span>
      <span style="margin-left:auto;font-size:11px;color:var(--t2)">${active.length} active · ${libraryAll.length} library</span>
    </div>
    ${filterBar()}
    <div class="dm-grid-2">
      ${libCol}
      ${activeCol}
    </div>
    <div class="note" style="margin-top:10px">
      <b>Cara pakai:</b> drag supplement dari Library ke Active (atau sebaliknya). Bisa juga klik tombol <b>✅ Aktifkan</b> / <b>↩ Drop</b>.
      Search/filter cuma effect ke Library. <b>Active</b> jadi default ON di Budget Filter.
    </div>
  </div>`;
}

// ════════════════════════════════════════════════════════════
// TAB 2 — BUDGET + CONFLICT
// ════════════════════════════════════════════════════════════
export function pBudget(){
  if(!SUPPLEMENTS.length) return `<div class="card">${emptyState('⏳', 'Loading...')}</div>`;
  if(!S.user) return `${renderQuarterRow()}<div class="card">${emptyState('🔒', 'Login dulu untuk Budget filter.')}</div>`;
  if(S.viewAll){
    return `${renderQuarterRow()}<div class="card">${emptyState('📊', 'Mode All Quarters aktif. Budget cuma per-quarter — pilih quarter di atas.')}</div>`;
  }

  const qid = S.quarter;
  const qLbl = quarterLabel(qid);
  const dmMap = S.dmByQuarter[qid] || new Map();
  // Source: supplements di stage 'deal' di quarter ini
  const dealIds = new Set();
  dmMap.forEach((stage, suppId) => { if(stage === 'deal') dealIds.add(suppId); });
  const dealSupps = [...dealIds].map(id => findSupp(id)).filter(Boolean)
    .sort((a,b) => (b.efficiency_score||0) - (a.efficiency_score||0));

  if(dealSupps.length === 0){
    return `${renderQuarterRow()}<div class="card">
      <div class="card-title"><span class="ico">💰</span> Filter Budget — ${qLbl}</div>
      ${emptyState('📋', 'Belum ada supplement di stage Deal untuk quarter ini.')}
      <div style="text-align:center;margin-top:8px"><button class="btn btn-primary" onclick="setTab(1)">Buka Decision Matrix →</button></div>
    </div>
    ${restockCardHTML()}
    ${containerCardHTML()}`;
  }

  // Current Budget selection (fallback ke deal kalau belum ada selection)
  const currentSel = S.budSelByQuarter[qid] || new Set(dealIds);

  let totalQuarterCost = 0, totalMonthCost = 0;
  const rows = dealSupps.map(s => {
    const isCheck = currentSel.has(s.id);
    const qr = quarterCost(s, qid);
    const mc = monthlyCost(s);
    if(isCheck){ totalQuarterCost += qr.cost; totalMonthCost += mc; }
    const eff = s.efficiency_score || 0;
    return `<tr class="${isCheck?'':'bud-row-off'}">
      <td class="c">
        <input type="checkbox" ${isCheck?'checked':''} onchange="toggleBudSel(${s.id})" class="bud-check">
      </td>
      <td>${catBadge(s.category)}</td>
      <td>
        <div style="font-weight:700;color:var(--t0)">${s.name}</div>
        <div style="font-size:9px;color:var(--t3)">${s.daily_servings||1} ${s.unit}/hari</div>
      </td>
      <td class="c"><span class="mono" style="color:${scoreCol(eff)};font-weight:800">${eff}</span></td>
      <td class="c"><span class="mono">${qr.containers}</span><div style="font-size:9px;color:var(--t3)">cont</div></td>
      <td class="r"><span class="mono">${rpM(mc)}</span><div style="font-size:9px;color:var(--t3)">/bulan</div></td>
      <td class="r"><span class="mono" style="font-weight:800">${rpM(qr.cost)}</span><div style="font-size:9px;color:var(--t3)">${qLbl}</div></td>
    </tr>`;
  }).join('');

  const overBudget = totalMonthCost > S.budCap;

  return `${renderQuarterRow()}
  <div class="card">
    <div class="card-title">
      <span class="ico">💰</span>
      <span>Filter Budget — ${qLbl}</span>
      <span style="margin-left:auto;font-size:11px;color:var(--t2)">
        ${currentSel.size}/${dealSupps.length} selected ·
        <span style="color:${overBudget?'var(--warn)':'var(--vit)'};font-weight:800">${rpM(totalMonthCost)}/bulan</span>
      </span>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">
      <label style="font-size:11px;font-weight:700;color:var(--t2)">Budget Cap/bulan:</label>
      <input id="bud-cap-input" type="number" value="${S.budCap}" onchange="setBudCap(this.value)" class="input" style="max-width:160px;font-family:'JetBrains Mono',monospace">
      <button class="btn btn-primary btn-sm" onclick="saveBudgetCurrent()">💾 Save Budget</button>
      <span style="margin-left:auto;font-size:11px;${overBudget?'color:var(--warn);font-weight:800':'color:var(--vit)'}">${overBudget?'⚠ Over budget':'✓ Within budget'}</span>
    </div>
    <table>
      <thead><tr>
        <th class="c" style="width:40px"></th>
        <th>Kategori</th>
        <th>Supplement</th>
        <th class="c">EFF</th>
        <th class="c">Cont</th>
        <th class="r">Cost/bln</th>
        <th class="r">Cost ${qLbl}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="border-top:2px solid var(--bdr2)">
        <td colspan="5" class="r" style="font-weight:800;padding:10px">TOTAL</td>
        <td class="r"><span class="mono" style="font-weight:800;color:var(--acc)">${rpM(totalMonthCost)}</span></td>
        <td class="r"><span class="mono" style="font-weight:800;color:var(--acc)">${rpM(totalQuarterCost)}</span></td>
      </tr></tfoot>
    </table>
    <div class="note" style="margin-top:10px">
      Centang/uncheck untuk include/exclude. Source: stage <b>Deal</b> di Decision Matrix.
      Klik <b>💾 Save Budget</b> untuk persist selection ke DB.
    </div>
  </div>
  ${restockCardHTML()}
  ${containerCardHTML()}`;
}

// ════════════════════════════════════════════════════════════
// TAB 3 — COMPOUNDS (master list, no Stock col)
// ════════════════════════════════════════════════════════════
export function pCompounds(){
  if(!SUPPLEMENTS.length) return `<div class="card">${emptyState('⏳', 'Loading catalog...')}</div>`;

  const filtered = applyFilters(SUPPLEMENTS);
  const rows = filtered.map(s => {
    const doseUnit = s.dose_unit || s.unit;
    const score = s.efficiency_score;
    const sc = scoreCol(score);
    return `<tr>
      <td class="c"><div style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:800;color:${sc}">${score ?? '—'}</div><div style="font-size:9px;color:var(--t3)">${scoreLabel(score)}</div></td>
      <td class="c">${tierBadge(s.notes)}</td>
      <td>${catBadge(s.category)}</td>
      <td><div style="font-weight:700;color:var(--t0)">${s.name}</div>
          <div style="font-size:10px;color:var(--acc);font-weight:600">${s.brand || '—'}</div></td>
      <td class="c"><span class="mono">${s.dose_per_serving || '—'} ${doseUnit}</span><div style="font-size:9px;color:var(--t3)">${s.daily_servings||1}/hari</div></td>
      <td class="c"><span class="mono">${s.servings_per_container || '—'}</span><div style="font-size:9px;color:var(--t3)">${s.unit}/cont</div></td>
      <td class="r"><span class="mono">${rpM(s.price_idr || 0)}</span></td>
      <td class="c">
        <button class="btn btn-sm" onclick="openSuppEdit(${s.id})">✎ Edit</button>
      </td>
    </tr>`;
  }).join('');

  return `${renderQuarterRow()}
  <div class="card">
    <div class="card-title">
      <span class="ico">📚</span>
      <span>Compounds — ${filtered.length}/${SUPPLEMENTS.length} supplement · sorted by score</span>
      <span style="margin-left:auto"><button class="btn btn-primary btn-sm" onclick="openSuppEdit(null)">+ Tambah Supplement</button></span>
    </div>
    ${filterBar()}
    <table>
      <thead><tr>
        <th class="c">Score</th><th class="c">Tier</th><th>Kategori</th><th>Name</th>
        <th class="c">Dose</th><th class="c">Cont</th>
        <th class="r">Harga</th><th class="c">Action</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="note" style="margin-top:10px">
      <b>Score 0-100</b> = utility × evidence × value-for-money. <b>Tier</b> S=foundational A=proven B=useful C=situational D=optional F=DROP.
      Stock management dipindah ke Overview tab. Catalog shared antar user.
    </div>
  </div>`;
}
