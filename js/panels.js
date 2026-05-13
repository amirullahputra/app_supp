// Panel render functions — 5 tabs.
import { CAT, SUPPLEMENTS, TIMING_OPTS } from './data.js?v=2';
import { S, rp, rpM, todayISO, daysAgo, daysToEmpty, inventoryStatus, avgDailyServings, monthlyCost, scoreCol, scoreLabel } from './state.js?v=2';

// Empty-state helper
function emptyState(icon, msg){
  return `<div style="padding:2rem;text-align:center;color:var(--t2)">
    <div style="font-size:36px;margin-bottom:10px">${icon}</div>
    <div style="font-size:13px">${msg}</div>
  </div>`;
}

function catBadge(cat){
  const c = CAT[cat] || CAT.other;
  return `<span class="lb ${c.cls}">${c.icon} ${c.label}</span>`;
}

// ── TAB 0: CATALOG ──
export function pCatalog(){
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
      <td class="c"><span class="mono">${s.dose_per_serving || '—'} ${doseUnit}</span></td>
      <td class="c"><span class="mono">${s.servings_per_container || '—'}</span><div style="font-size:9px;color:var(--t3)">${s.unit}/cont</div></td>
      <td class="r"><span class="mono">${rpM(s.price_idr || 0)}</span></td>
      <td class="c">${statusBadge}<div style="font-size:9px;color:var(--t3);margin-top:2px">${stk} botol</div></td>
      <td class="c"><button class="btn btn-sm" onclick="openSuppEdit(${s.id})">✎ Edit</button></td>
    </tr>`;
  }).join('');

  return `<div class="card">
    <div class="card-title">
      <span class="ico">📚</span>
      <span>Catalog — ${SUPPLEMENTS.length} supplement · sorted by score</span>
      <span style="margin-left:auto"><button class="btn btn-primary btn-sm" onclick="openSuppEdit(null)">+ Tambah Supplement</button></span>
    </div>
    <table>
      <thead><tr>
        <th class="c">Score</th><th>Kategori</th><th>Name</th><th class="c">Dose</th><th class="c">Cont</th>
        <th class="r">Harga</th><th class="c">Stock</th><th class="c">Action</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="note" style="margin-top:10px">
      <b>Score 0-100</b> = utility × evidence × value-for-money. 85+ <span style="color:var(--vit);font-weight:700">Strong</span> ·
      65-84 <span style="color:var(--pro);font-weight:700">Proven</span> ·
      45-64 <span style="color:var(--pwo);font-weight:700">Situational</span> ·
      &lt;45 <span style="color:var(--t3);font-weight:700">Weak</span>.
      Catalog shared antar user; stock per user. Klik Edit untuk update harga/dosis/score.
    </div>
  </div>`;
}

// ── TAB 1: INVENTORY ──
export function pInventory(){
  if(!SUPPLEMENTS.length) return `<div class="card">${emptyState('⏳', 'Loading...')}</div>`;
  if(!S.user) return `<div class="card">${emptyState('🔒', 'Login dulu untuk lihat inventory.')}</div>`;

  // Sort: kosong/restock dulu, lalu by name
  const sorted = [...SUPPLEMENTS].sort((a,b) => {
    const sa = inventoryStatus(a), sb = inventoryStatus(b);
    const rank = { empty:0, restock:1, ok:2 };
    if(rank[sa] !== rank[sb]) return rank[sa] - rank[sb];
    return a.name.localeCompare(b.name);
  });

  const rows = sorted.map(s => {
    const inv = S.inventoryBySupp[s.id];
    const qty = inv?.qty_containers || 0;
    const thr = inv?.min_threshold || 1;
    const status = inventoryStatus(s);
    const dte = daysToEmpty(s);
    const rate = avgDailyServings(s.id);
    const statusBadge = status==='empty' ? `<span class="badge-restock">⚠ Kosong</span>`
      : status==='restock' ? `<span class="badge-restock">⚠ Restock</span>`
      : `<span class="badge-ok">✓ OK</span>`;
    const dteLabel = dte === null ? '—' : (dte === 0 ? 'habis' : `${dte} hari`);
    const dteCol = dte === null ? 'var(--t3)' : (dte <= 7 ? 'var(--warn)' : 'var(--vit)');
    return `<tr>
      <td>${catBadge(s.category)}</td>
      <td><div style="font-weight:700;color:var(--t0)">${s.name}</div>
          <div style="font-size:10px;color:var(--t3)">${s.brand || '—'}</div></td>
      <td class="c"><span class="mono" style="font-size:14px;font-weight:800">${qty}</span><div style="font-size:9px;color:var(--t3)">botol/jar</div></td>
      <td class="c"><span class="mono" style="color:${dteCol};font-weight:700">${dteLabel}</span><div style="font-size:9px;color:var(--t3)">${rate>0?rate.toFixed(1)+'/hari':'no log'}</div></td>
      <td class="c">${statusBadge}<div style="font-size:9px;color:var(--t3);margin-top:2px">min ${thr}</div></td>
      <td class="c"><button class="btn btn-sm" onclick="openInvModal(${s.id})">✎ Update</button></td>
    </tr>`;
  }).join('');

  return `<div class="card">
    <div class="card-title"><span class="ico">📦</span> Inventory — Stock & Restock Alert</div>
    <table>
      <thead><tr>
        <th>Kategori</th><th>Name</th><th class="c">Stock</th>
        <th class="c">Habis dalam</th><th class="c">Status</th><th class="c">Action</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="note" style="margin-top:10px">
      Status <span class="badge-restock" style="font-size:9px">Restock</span> = qty ≤ min threshold ·
      "Habis dalam" dihitung dari rata-rata konsumsi 7 hari terakhir di Daily Log.
    </div>
  </div>`;
}

// ── TAB 2: DAILY LOG ──
export function pDailyLog(){
  if(!SUPPLEMENTS.length) return `<div class="card">${emptyState('⏳', 'Loading...')}</div>`;
  if(!S.user) return `<div class="card">${emptyState('🔒', 'Login dulu untuk catat konsumsi.')}</div>`;

  // Today's entries grouped
  const todayRows = S.logToday.length === 0
    ? emptyState('📋', 'Belum ada konsumsi hari ini. Tap supplement di bawah untuk catat.')
    : S.logToday.map(r => {
        const s = SUPPLEMENTS.find(x => x.id === r.supplement_id);
        if(!s) return '';
        const time = new Date(r.consumed_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
        return `<div class="daily-row">
          <div class="name">${s.name}</div>
          <div class="dose">${r.qty_servings} ${s.unit} · ${time}</div>
          <div class="actions">
            <button class="btn btn-sm btn-warn" onclick="deleteLog('${r.id}')">✕</button>
          </div>
        </div>`;
      }).join('');

  // Quick-tap supplements
  const quickTap = SUPPLEMENTS.map(s => `
    <button class="btn btn-sm" style="margin:3px" onclick="openLogModal(${s.id})">
      ${CAT[s.category]?.icon || '•'} ${s.name}
    </button>
  `).join('');

  return `<div class="card">
    <div class="card-title">
      <span class="ico">📝</span>
      <span>Daily Log — ${new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span>
      <span style="margin-left:auto;font-size:11px;color:var(--t2)">${S.logToday.length} entry hari ini</span>
    </div>
    ${todayRows}
  </div>

  <div class="card">
    <div class="card-title"><span class="ico">⚡</span> Quick Add — Tap supplement</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">${quickTap}</div>
  </div>`;
}

// ── TAB 3: STACKS (Phase 2 placeholder) ──
export function pStacks(){
  if(!S.user) return `<div class="card">${emptyState('🔒', 'Login dulu untuk buat stack.')}</div>`;
  return `<div class="card">
    <div class="card-title"><span class="ico">🎯</span> Stacks — Protocol per Goal</div>
    ${emptyState('🚧', 'Coming in Phase 2 — buat stack per goal (cutting/bulking/recovery) dengan supplement + dosis spesifik. Untuk sekarang pakai Daily Log + Inventory.')}
  </div>`;
}

// ── TAB 4: OVERVIEW ──
export function pOverview(){
  if(!SUPPLEMENTS.length) return `<div class="card">${emptyState('⏳', 'Loading...')}</div>`;

  // Restock alerts
  const needRestock = SUPPLEMENTS.filter(s => inventoryStatus(s) !== 'ok');
  const alertCard = needRestock.length === 0
    ? `<div class="card"><div class="card-title"><span class="ico">✅</span> Restock Status</div>
       <div style="padding:14px 0;color:var(--vit);font-weight:700">Semua stock aman ✓</div></div>`
    : `<div class="card"><div class="card-title"><span class="ico">⚠️</span> Restock Alert (${needRestock.length})</div>
       ${needRestock.map(s => {
         const inv = S.inventoryBySupp[s.id];
         const qty = inv?.qty_containers || 0;
         const dte = daysToEmpty(s);
         return `<div class="daily-row">
           <div class="name">${catBadge(s.category)} ${s.name}</div>
           <div class="dose">${qty} botol · ${dte!==null ? dte+' hari lagi' : 'no log'}</div>
           <div class="actions"><button class="btn btn-sm btn-primary" onclick="setTab(1)">Update →</button></div>
         </div>`;
       }).join('')}
       </div>`;

  // Today's checklist
  const consumedIds = new Set(S.logToday.map(r => r.supplement_id));
  const todayCard = `<div class="card">
    <div class="card-title"><span class="ico">📅</span> Hari Ini · ${S.logToday.length} konsumsi</div>
    ${S.logToday.length === 0
      ? emptyState('🍃', 'Belum konsumsi apa-apa hari ini.')
      : S.logToday.slice(0,8).map(r => {
          const s = SUPPLEMENTS.find(x => x.id === r.supplement_id);
          if(!s) return '';
          const time = new Date(r.consumed_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
          return `<div class="daily-row">
            <div class="name">${catBadge(s.category)} ${s.name}</div>
            <div class="dose">${r.qty_servings} ${s.unit} · ${time}</div>
            <div class="actions"></div>
          </div>`;
        }).join('')}
  </div>`;

  // Monthly cost estimate (from avg consumption rate × price)
  let monthlyTotal = 0;
  const costRows = SUPPLEMENTS.map(s => {
    const rate = avgDailyServings(s.id);
    if(rate <= 0 || !s.price_idr || !s.servings_per_container) return null;
    const monthCost = monthlyCost(s, rate);
    monthlyTotal += monthCost;
    return { name: s.name, cat: s.category, rate, monthCost };
  }).filter(Boolean).sort((a,b) => b.monthCost - a.monthCost);

  const costCard = costRows.length === 0
    ? `<div class="card"><div class="card-title"><span class="ico">💰</span> Budget Estimate</div>
       ${emptyState('📊', 'Belum cukup data konsumsi untuk estimate. Log konsumsi minimal seminggu.')}</div>`
    : `<div class="card">
       <div class="card-title">
         <span class="ico">💰</span> Budget Estimate / Bulan
         <span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-weight:800;color:var(--acc)">${rpM(monthlyTotal)}</span>
       </div>
       <table>
         <thead><tr><th>Supplement</th><th class="c">Rate/hari</th><th class="r">Cost/bulan</th></tr></thead>
         <tbody>${costRows.slice(0,10).map(r => `<tr>
           <td>${catBadge(r.cat)} ${r.name}</td>
           <td class="c"><span class="mono">${r.rate.toFixed(1)}</span></td>
           <td class="r"><span class="mono">${rpM(r.monthCost)}</span></td>
         </tr>`).join('')}</tbody>
       </table>
       <div class="note" style="margin-top:10px">Estimate dihitung dari rata-rata konsumsi 7 hari × 30 × cost per serving. Yearly ≈ ${rpM(monthlyTotal*12)}.</div>
     </div>`;

  return `${alertCard}${todayCard}${costCard}`;
}
