// 4-tab panels mirror pep_fl: Overview · DM · Budget · Compounds.
import { CAT, SUPPLEMENTS, QUARTERS, VISIBLE_QIDS, STAGES } from './data.js?v=3';
import {
  S, rp, rpM, quarterLabel, daysInQuarter, quarterDateRange,
  quarterCost, monthlyCost, selFor,
  inventoryStatus, daysToEmpty,
  scoreCol, scoreLabel
} from './state.js?v=3';

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
        <div class="qcard-title">${lbl}</div>
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

// ════════════════════════════════════════════════════════════
// TAB 0 — OVERVIEW
// ════════════════════════════════════════════════════════════
export function pOverview(){
  if(!SUPPLEMENTS.length) return `<div class="card">${emptyState('⏳', 'Loading...')}</div>`;

  const allMode = S.viewAll === true;
  const qid = S.quarter || QUARTERS[0];
  const qLbl = allMode ? 'All Quarters' : quarterLabel(qid);
  const scopeQuarters = allMode ? VISIBLE_QIDS.filter(q => selFor(q).size > 0) : [qid];

  // Active union across scope
  const dealt = new Set();
  scopeQuarters.forEach(q => selFor(q).forEach(id => dealt.add(id)));

  // ── Card 1: Restock Alert
  const needRestock = SUPPLEMENTS.filter(s => inventoryStatus(s) !== 'ok');
  const restockCard = needRestock.length === 0
    ? `<div class="card"><div class="card-title"><span class="ico">✅</span> Restock Status</div>
       <div style="padding:14px 0;color:var(--vit);font-weight:700">Semua stock aman ✓</div></div>`
    : `<div class="card"><div class="card-title"><span class="ico">⚠️</span> Restock Alert · ${needRestock.length}</div>
       ${needRestock.slice(0,6).map(s => {
         const inv = S.inventoryBySupp[s.id];
         const qty = inv?.qty_containers || 0;
         const dte = daysToEmpty(s);
         return `<div class="daily-row">
           <div class="name">${catBadge(s.category)} ${s.name}</div>
           <div class="dose">${qty} botol · ${dte!==null ? dte+'h lagi' : '—'}</div>
           <div class="actions"><button class="btn btn-sm btn-primary" onclick="setTab(3)">Edit →</button></div>
         </div>`;
       }).join('')}
       </div>`;

  // ── Card 2: Biaya per Kategori
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

  // ── Card 3: Supplement Selected (sorted by score)
  const sortedSelected = [...dealt].map(id => findSupp(id)).filter(Boolean)
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
            <div style="font-size:11px;font-weight:700;color:var(--t0);width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.name}</div>
            <div style="flex:1;height:12px;background:var(--bg3);border-radius:3px;overflow:hidden">
              <div style="width:${Math.round(eff/maxEff*100)}%;height:100%;background:${scoreCol(eff)}"></div>
            </div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;color:${scoreCol(eff)};width:30px;text-align:right">${eff}</div>
            <span style="font-size:8px;color:var(--t3)">EFF</span>
          </div>`;
        }).join('')
    }
  </div>`;

  // ── Card 4: Kebutuhan Container per supplement
  const containerRecap = sortedSelected.map(s => {
    let containers = 0, cost = 0;
    scopeQuarters.forEach(q => {
      if(selFor(q).has(s.id)){
        const r = quarterCost(s, q);
        containers += r.containers;
        cost += r.cost;
      }
    });
    return { name: s.name, cat: s.category, containers, cost, unit: s.unit };
  }).filter(r => r.containers > 0).sort((a,b) => b.containers - a.containers);
  const maxC = Math.max(1, ...containerRecap.map(r => r.containers));
  const totalC = containerRecap.reduce((a,r) => a+r.containers, 0);
  const totalCost = containerRecap.reduce((a,r) => a+r.cost, 0);

  const containerCard = `<div class="card">
    <div class="card-title"><span class="ico">📦</span> Kebutuhan Container — ${qLbl}</div>
    ${containerRecap.length === 0
      ? '<div style="color:var(--t3);font-size:11px;padding:14px 0">Tidak ada kebutuhan container.</div>'
      : containerRecap.map(r => `<div style="display:flex;align-items:center;gap:8px;padding:4px 0">
          <div style="width:170px;font-size:11px"><span class="lb ${CAT[r.cat].cls}" style="font-size:8px">${CAT[r.cat].label}</span> ${r.name}</div>
          <div style="flex:1;height:12px;background:var(--bg3);border-radius:3px;overflow:hidden">
            <div style="width:${r.containers/maxC*100}%;height:100%;background:var(--acc)"></div>
          </div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;min-width:60px;text-align:right">${r.containers} btl</div>
        </div>`).join('') + `<div style="border-top:2px solid var(--bdr2);margin-top:8px;padding-top:8px;display:flex;justify-content:space-between">
          <span style="font-size:11px;font-weight:800">Total Cost: <span style="font-family:'JetBrains Mono',monospace;color:var(--acc)">${rpM(totalCost)}</span></span>
          <span style="font-size:11px;font-weight:800">Total: <span style="font-family:'JetBrains Mono',monospace;color:var(--acc)">${totalC} container</span></span>
        </div>`
    }
  </div>`;

  return `
  ${renderQuarterRow()}
  <div class="grid2" style="margin-bottom:12px">${restockCard}${biayaCard}</div>
  <div class="grid2">${selectedCard}${containerCard}</div>`;
}

// ════════════════════════════════════════════════════════════
// TAB 1 — DECISION MATRIX
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

  // Split supplements: by stage + library (belum di-stage)
  const stagedIds = new Set(dmMap.keys());
  const library = SUPPLEMENTS.filter(s => !stagedIds.has(s.id))
    .sort((a,b) => (b.efficiency_score||0) - (a.efficiency_score||0));

  const byStage = { watchlist: [], tentatif: [], deal: [] };
  dmMap.forEach((stage, suppId) => {
    const s = findSupp(suppId);
    if(s && byStage[stage]) byStage[stage].push(s);
  });
  Object.keys(byStage).forEach(k => {
    byStage[k].sort((a,b) => (b.efficiency_score||0) - (a.efficiency_score||0));
  });

  const renderSuppCard = (s, currentStage) => {
    const eff = s.efficiency_score || 0;
    const moveBtns = ['watchlist','tentatif','deal'].filter(st => st !== currentStage).map(st =>
      `<button class="dm-mvbtn" onclick="dmMove(${s.id}, '${st}')" title="Move to ${STAGES[st].label}">${STAGES[st].icon}</button>`
    ).join('');
    const removeBtn = currentStage ? `<button class="dm-mvbtn dm-rmbtn" onclick="dmRemove(${s.id})" title="Drop ke Library">↩</button>` : '';
    return `<div class="dm-card">
      <div class="dm-card-row">
        <span class="lb ${CAT[s.category].cls}" style="font-size:8px">${CAT[s.category].icon}</span>
        <div class="dm-card-name">${s.name}</div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;color:${scoreCol(eff)}">${eff}</span>
      </div>
      <div class="dm-card-actions">${moveBtns}${removeBtn}</div>
    </div>`;
  };

  const libCol = `<div class="dm-col">
    <div class="dm-col-hdr">📚 Library · ${library.length}</div>
    <div class="dm-col-body">
      ${library.length === 0 ? `<div style="color:var(--t3);font-size:10px;padding:10px 0;text-align:center">Semua sudah di-stage</div>` :
        library.map(s => {
          const eff = s.efficiency_score || 0;
          return `<div class="dm-card">
            <div class="dm-card-row">
              <span class="lb ${CAT[s.category].cls}" style="font-size:8px">${CAT[s.category].icon}</span>
              <div class="dm-card-name">${s.name}</div>
              <span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;color:${scoreCol(eff)}">${eff}</span>
            </div>
            <div class="dm-card-actions">
              <button class="dm-mvbtn" onclick="dmMove(${s.id}, 'watchlist')" title="To Watchlist">📋</button>
              <button class="dm-mvbtn" onclick="dmMove(${s.id}, 'tentatif')" title="To Tentatif">⚖️</button>
              <button class="dm-mvbtn" onclick="dmMove(${s.id}, 'deal')" title="To Deal">✅</button>
            </div>
          </div>`;
        }).join('')}
    </div>
  </div>`;

  const stageCol = (key) => {
    const st = STAGES[key];
    const items = byStage[key];
    return `<div class="dm-col" style="border-top:3px solid ${st.color}">
      <div class="dm-col-hdr" style="background:${st.bg};color:${st.color}">${st.icon} ${st.label} · ${items.length}</div>
      <div class="dm-col-body">
        ${items.length === 0 ? `<div style="color:var(--t3);font-size:10px;padding:10px 0;text-align:center">Drop supplement ke sini</div>` :
          items.map(s => renderSuppCard(s, key)).join('')}
      </div>
    </div>`;
  };

  return `${renderQuarterRow()}
  <div class="card">
    <div class="card-title"><span class="ico">🎯</span> Decision Matrix — ${qLbl}</div>
    <div class="dm-grid">
      ${libCol}
      ${stageCol('watchlist')}
      ${stageCol('tentatif')}
      ${stageCol('deal')}
    </div>
    <div class="note" style="margin-top:10px">
      <b>Workflow:</b> drag supplement dari Library → Watchlist (mau coba) → Tentatif (mau beli) → Deal (active konsumsi).
      Status <b>Deal</b> jadi default ON di Budget Filter.
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
    </div>`;
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
  </div>`;
}

// ════════════════════════════════════════════════════════════
// TAB 3 — COMPOUNDS (master list, ex-Catalog + Stock column)
// ════════════════════════════════════════════════════════════
export function pCompounds(){
  if(!SUPPLEMENTS.length) return `<div class="card">${emptyState('⏳', 'Loading catalog...')}</div>`;

  const rows = SUPPLEMENTS.map(s => {
    const inv = S.inventoryBySupp[s.id];
    const stk = inv?.qty_containers || 0;
    const status = inventoryStatus(s);
    const statusBadge = status==='empty' ? `<span class="badge-restock">⚠ Kosong</span>`
      : status==='restock' ? `<span class="badge-restock">⚠ Restock</span>`
      : `<span class="badge-ok">✓ OK</span>`;
    const doseUnit = s.dose_unit || s.unit;
    const score = s.efficiency_score;
    const sc = scoreCol(score);
    return `<tr>
      <td class="c"><div style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:800;color:${sc}">${score ?? '—'}</div><div style="font-size:9px;color:var(--t3)">${scoreLabel(score)}</div></td>
      <td>${catBadge(s.category)}</td>
      <td><div style="font-weight:700;color:var(--t0)">${s.name}</div>
          <div style="font-size:10px;color:var(--t3)">${s.brand || '—'}</div></td>
      <td class="c"><span class="mono">${s.dose_per_serving || '—'} ${doseUnit}</span><div style="font-size:9px;color:var(--t3)">${s.daily_servings||1}/hari</div></td>
      <td class="c"><span class="mono">${s.servings_per_container || '—'}</span><div style="font-size:9px;color:var(--t3)">${s.unit}/cont</div></td>
      <td class="r"><span class="mono">${rpM(s.price_idr || 0)}</span></td>
      <td class="c"><div style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:800">${stk}</div>${statusBadge}</td>
      <td class="c">
        <button class="btn btn-sm" onclick="openSuppEdit(${s.id})">✎</button>
        <button class="btn btn-sm" onclick="openInvModal(${s.id})">📦</button>
      </td>
    </tr>`;
  }).join('');

  return `${renderQuarterRow()}
  <div class="card">
    <div class="card-title">
      <span class="ico">📚</span>
      <span>Compounds — ${SUPPLEMENTS.length} supplement · sorted by score</span>
      <span style="margin-left:auto"><button class="btn btn-primary btn-sm" onclick="openSuppEdit(null)">+ Tambah Supplement</button></span>
    </div>
    <table>
      <thead><tr>
        <th class="c">Score</th><th>Kategori</th><th>Name</th>
        <th class="c">Dose</th><th class="c">Cont</th>
        <th class="r">Harga</th><th class="c">Stock</th><th class="c">Action</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="note" style="margin-top:10px">
      <b>Score 0-100</b> = utility × evidence × value-for-money. 85+ Strong · 65-84 Proven · 45-64 Situational · &lt;45 Weak.
      Catalog shared, stock per user. ✎ edit master · 📦 update stok.
    </div>
  </div>`;
}
