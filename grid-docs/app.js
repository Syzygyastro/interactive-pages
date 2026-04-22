// ─────────────────────────────────────────────────────────────
// GB Grid Docs — interactive explorer + concept map + process
// ─────────────────────────────────────────────────────────────

let MANIFEST = null;
let DOCS = [];           // array of full doc objects
let DOC_BY_ID = {};
let ACTIVE_CATEGORY = 'all';
let ACTIVE_QUERY = '';
let ACTIVE_DOC_ID = null;

// Process tab state
let PROC_DATA = null;
let PROC_LEVEL = 'transmission';   // transmission | distribution
let PROC_PATH = 'g99';             // g98 | g99 (for distribution)
let PROC_SELECTED_STAGE = null;
let PROC_SELECTED_TYPE = null;     // 'stage' | 'doc' | 'entity'
let PROC_SELECTED_ID = null;
let ACTIVE_TAB = 'library';        // library | process

// ── Bootstrap ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    const [manifest, procData] = await Promise.all([
      fetch('data/manifest.json').then(r => r.json()),
      fetch('data/interconnection-process.json').then(r => r.json())
    ]);
    MANIFEST = manifest;
    PROC_DATA = procData;
    DOCS = await Promise.all(
      MANIFEST.documents.map(id => fetch(`data/${id}.json`).then(r => r.json()))
    );
    DOC_BY_ID = Object.fromEntries(DOCS.map(d => [d.id, d]));
  } catch (e) {
    document.getElementById('cardsGrid').innerHTML =
      `<div class="empty-state">Could not load data — ${e.message}. Serve the folder over http (eg. <code>python3 -m http.server</code>).</div>`;
    return;
  }

  // Hero counts
  document.getElementById('statDocs').textContent = `${DOCS.length} Documents`;
  document.getElementById('statCategories').textContent = `${MANIFEST.categories.length} Categories`;

  buildCategoryFilters();
  renderConceptMap();
  renderCards();
  wireUI();
  wireTopTabs();
}

function wireUI() {
  document.getElementById('copyAllBtn').addEventListener('click', copyAllMarkdown);
  document.getElementById('searchInput').addEventListener('input', e => {
    ACTIVE_QUERY = e.target.value.trim().toLowerCase();
    renderCards();
  });
}

// ── Filter bar ───────────────────────────────────────────────
function buildCategoryFilters() {
  const wrap = document.getElementById('categoryFilters');
  const cats = [{ id: 'all', name: 'All', icon: '' }].concat(
    MANIFEST.categories.sort((a, b) => a.order - b.order)
  );
  wrap.innerHTML = cats.map(c => {
    const isActive = c.id === ACTIVE_CATEGORY ? ' active' : '';
    const label = c.icon ? `${c.icon} ${c.name}` : c.name;
    return `<button class="filter-btn${isActive}" data-cat="${c.id}">${label}</button>`;
  }).join('');
  wrap.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ACTIVE_CATEGORY = btn.dataset.cat;
      wrap.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCards();
    });
  });
}

// ── Cards ────────────────────────────────────────────────────
function renderCards() {
  const grid = document.getElementById('cardsGrid');
  const filtered = DOCS.filter(d => {
    if (ACTIVE_CATEGORY !== 'all' && d.category !== ACTIVE_CATEGORY) return false;
    if (ACTIVE_QUERY) {
      const hay = [
        d.shortName, d.fullName, d.issuer, d.version, d.summary,
        (d.scope || []).join(' '),
        (d.keyParts || []).map(k => k.name + ' ' + k.detail).join(' ')
      ].join(' ').toLowerCase();
      if (!hay.includes(ACTIVE_QUERY)) return false;
    }
    return true;
  });

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state">No documents match the current filter.</div>`;
    return;
  }

  grid.innerHTML = filtered.map((d, i) => cardHTML(d, i)).join('');
  grid.querySelectorAll('.doc-card').forEach(card => {
    card.addEventListener('click', () => openDetail(card.dataset.id));
  });
}

function cardHTML(d, i) {
  const catName = catMeta(d.category).name;
  return `
    <article class="doc-card cat-${d.category}" data-id="${d.id}" style="--card-index:${i}">
      <div class="card-header">
        <div class="card-icon">${d.icon || '📄'}</div>
        <div class="card-titles">
          <div class="card-name">${escapeHTML(d.shortName)}</div>
          <div class="card-issuer">${escapeHTML(d.issuer || '')}</div>
          <div class="card-badges">
            <span class="card-badge badge-${d.category}">${catName}</span>
            ${d.version ? `<span class="card-badge badge-codes" style="background:#f1f5f9;color:#334155">${escapeHTML(d.version)}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="card-desc">${escapeHTML(truncate(d.summary, 220))}</div>
      </div>
      <div class="card-footer">
        <span class="card-version">${escapeHTML(d.statusDate || '')}</span>
        <button class="card-detail-btn">View Details →</button>
      </div>
    </article>
  `;
}

// ── Detail view ──────────────────────────────────────────────
function openDetail(id) {
  const d = DOC_BY_ID[id];
  if (!d) return;
  ACTIVE_DOC_ID = id;
  const host = document.getElementById('detailBox');
  const sec  = document.getElementById('detailSection');
  const cat  = catMeta(d.category);

  host.innerHTML = `
    <div class="detail-header">
      <div class="detail-icon">${d.icon || '📄'}</div>
      <div class="detail-titles">
        <div class="detail-name">${escapeHTML(d.shortName)}</div>
        <div class="detail-full">${escapeHTML(d.fullName)}</div>
      </div>
      <button class="detail-close" aria-label="Close">×</button>
    </div>

    <div class="detail-meta">
      ${metaCard('Category', cat.name)}
      ${metaCard('Issuer', d.issuer)}
      ${metaCard('Version', d.version)}
      ${metaCard('Status / Date', d.statusDate)}
      ${metaCard('Authority', d.authority)}
    </div>

    <div class="detail-summary">${escapeHTML(d.summary)}</div>

    ${d.scope && d.scope.length ? `
      <div class="detail-block">
        <div class="detail-block-title">Scope</div>
        <ul class="detail-list">${d.scope.map(s => `<li>${escapeHTML(s)}</li>`).join('')}</ul>
      </div>` : ''}

    ${d.keyParts && d.keyParts.length ? `
      <div class="detail-block">
        <div class="detail-block-title">Key Parts / Sections</div>
        <div class="key-parts">
          ${d.keyParts.map(k => `
            <div class="key-part">
              <div class="key-part-name">${escapeHTML(k.name)}</div>
              <div class="key-part-detail">${escapeHTML(k.detail)}</div>
            </div>`).join('')}
        </div>
      </div>` : ''}

    ${d.notableSections && d.notableSections.length ? `
      <div class="detail-block">
        <div class="detail-block-title">Notable Sections</div>
        <div class="key-parts">
          ${d.notableSections.map(n => `
            <div class="key-part">
              <div class="key-part-name">${escapeHTML(n.s ? n.s + ' — ' : '')}${escapeHTML(n.name)}</div>
              <div class="key-part-detail">${escapeHTML(n.detail)}</div>
            </div>`).join('')}
        </div>
      </div>` : ''}

    ${d.whoCares && d.whoCares.length ? `
      <div class="detail-block">
        <div class="detail-block-title">Who this affects</div>
        <ul class="detail-list">${d.whoCares.map(s => `<li>${escapeHTML(s)}</li>`).join('')}</ul>
      </div>` : ''}

    ${renderRelationships(d)}

    <div class="detail-block">
      <div class="detail-block-title">Local file</div>
      <div class="detail-file">~/Documents/Grid Docs/${escapeHTML(d.file)} · ${escapeHTML(d.size || '')}</div>
      ${d.url ? `<div><a class="detail-link" href="${d.url}" target="_blank" rel="noopener">Official source ↗</a></div>` : ''}
    </div>
  `;

  host.querySelector('.detail-close').addEventListener('click', closeDetail);
  host.querySelectorAll('.rel-pill[data-id]').forEach(pill => {
    pill.addEventListener('click', () => openDetail(pill.dataset.id));
  });

  sec.style.display = 'block';
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  highlightMap(id);
}

function closeDetail() {
  document.getElementById('detailSection').style.display = 'none';
  ACTIVE_DOC_ID = null;
  highlightMap(null);
}

function metaCard(label, value) {
  if (!value) return '';
  return `<div class="meta-card"><div class="meta-label">${escapeHTML(label)}</div><div class="meta-value">${escapeHTML(value)}</div></div>`;
}

function renderRelationships(d) {
  const r = d.relationships || {};
  const groups = [
    ['Enabled by',      r.enabledBy,                       'default'],
    ['Enables',         r.enables,                         'default'],
    ['Paired with',     r.pairedWith ? [r.pairedWith] : [], 'pair'],
    ['Modified by',     r.modifiedBy,                      'modify'],
    ['Modifies',        r.modifies,                        'modify'],
    ['Related',         r.related,                         'default'],
    ['Complements',     r.complementsGenerationReform ? [r.complementsGenerationReform] : [], 'default']
  ].filter(([, v]) => v && v.length);

  if (!groups.length) return '';

  return `<div class="detail-block">
    <div class="detail-block-title">Relationships</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${groups.map(([label, ids, cls]) => `
        <div class="rel-group">
          <span class="rel-label">${label}</span>
          ${ids.map(id => {
            const target = DOC_BY_ID[id];
            if (!target) return `<span class="rel-pill ${cls}" style="opacity:.6">${escapeHTML(id)}</span>`;
            return `<button class="rel-pill ${cls}" data-id="${id}">${escapeHTML(target.shortName)}</button>`;
          }).join('')}
        </div>`).join('')}
    </div>
  </div>`;
}

// ── Concept map (SVG) ───────────────────────────────────────
// Node layout — manually tuned for a clear visual hierarchy.
// Canvas is 1200 x 620.
const MAP_LAYOUT = {
  // Row 1 — Statutory (top)
  'electricity-act-1989': { x:  80, y:  30, w: 230, h: 46 },
  'esqcr-2002':           { x: 880, y:  30, w: 230, h: 46 },

  // Row 2 — Industry codes & standard (middle)
  'grid-code':            { x:  30, y: 180, w: 150, h: 58 },
  'cusc':                 { x: 200, y: 180, w: 150, h: 58 },
  'stc':                  { x: 370, y: 180, w: 150, h: 58 },
  'nets-sqss':            { x: 540, y: 180, w: 160, h: 58 },
  'dcusa':                { x: 720, y: 180, w: 150, h: 58 },
  'd-code':               { x: 890, y: 180, w: 150, h: 58 },

  // G99 — engineering recommendation, paired with D-Code
  'g99':                  { x: 1060, y: 184, w: 120, h: 50 },

  // Row 3 — Reform package (lower)
  'tmo4-plus':            { x: 200, y: 340, w: 200, h: 58 },
  'demand-connections-cfi': { x: 720, y: 340, w: 220, h: 58 },

  // Row 4 — Methodologies under TMO4+
  'g2cm':                 { x:  30, y: 480, w: 150, h: 50 },
  'cndm':                 { x: 200, y: 480, w: 150, h: 50 },
  'further-methodologies':{ x: 370, y: 480, w: 220, h: 50 }
};

const MAP_EDGES = [
  // Electricity Act 1989 enables the licence-required industry codes & standards
  { from: 'electricity-act-1989', to: 'grid-code',  type: 'enable' },
  { from: 'electricity-act-1989', to: 'cusc',       type: 'enable' },
  { from: 'electricity-act-1989', to: 'stc',        type: 'enable' },
  { from: 'electricity-act-1989', to: 'nets-sqss',  type: 'enable' },
  { from: 'electricity-act-1989', to: 'dcusa',      type: 'enable' },
  { from: 'electricity-act-1989', to: 'd-code',     type: 'enable' },

  // ESQCR 2002 (statutory safety SI) applies to all licensees;
  // shown via the codes/recommendations that give effect to its rules.
  { from: 'esqcr-2002', to: 'grid-code', type: 'enable' },
  { from: 'esqcr-2002', to: 'nets-sqss', type: 'enable' },
  { from: 'esqcr-2002', to: 'dcusa',     type: 'enable' },
  { from: 'esqcr-2002', to: 'd-code',    type: 'enable' },
  { from: 'esqcr-2002', to: 'g99',       type: 'enable' },

  // Pairings (commercial code paired with technical code)
  { from: 'grid-code', to: 'cusc',   type: 'pair' },
  { from: 'dcusa',     to: 'd-code', type: 'pair' },
  { from: 'd-code',    to: 'g99',    type: 'pair' },

  // TMO4+ reforms modify CUSC and spawn the methodologies
  { from: 'tmo4-plus', to: 'cusc',                  type: 'modify' },
  { from: 'tmo4-plus', to: 'g2cm',                  type: 'enable' },
  { from: 'tmo4-plus', to: 'cndm',                  type: 'enable' },
  { from: 'tmo4-plus', to: 'further-methodologies', type: 'enable' },

  // Demand Connections CfI proposes to modify CUSC and DCUSA
  { from: 'demand-connections-cfi', to: 'cusc',  type: 'modify' },
  { from: 'demand-connections-cfi', to: 'dcusa', type: 'modify' }
];

function renderConceptMap() {
  const svg = document.getElementById('conceptMap');
  svg.innerHTML = `
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" class="edge-arrow"/>
      </marker>
      <marker id="arrow-modify" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" class="edge-arrow modify"/>
      </marker>
    </defs>
  `;

  // Edges first so they sit under nodes
  const edgesG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  edgesG.setAttribute('id', 'edges');
  MAP_EDGES.forEach((e, i) => {
    const a = MAP_LAYOUT[e.from], b = MAP_LAYOUT[e.to];
    if (!a || !b) return;
    const p = routeEdge(a, b);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', p);
    path.setAttribute('class', `edge ${e.type === 'pair' ? 'pair' : ''} ${e.type === 'modify' ? 'modify' : ''}`.trim());
    path.setAttribute('data-from', e.from);
    path.setAttribute('data-to', e.to);
    if (e.type !== 'pair') {
      path.setAttribute('marker-end', e.type === 'modify' ? 'url(#arrow-modify)' : 'url(#arrow)');
    }
    edgesG.appendChild(path);
  });
  svg.appendChild(edgesG);

  // Nodes
  const nodesG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  nodesG.setAttribute('id', 'nodes');
  Object.entries(MAP_LAYOUT).forEach(([id, pos]) => {
    const d = DOC_BY_ID[id];
    if (!d) return;
    const cat = catMeta(d.category);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'node');
    g.setAttribute('data-id', id);
    g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', pos.w);
    rect.setAttribute('height', pos.h);
    rect.setAttribute('rx', 8);
    rect.setAttribute('fill', cat.bg);
    rect.setAttribute('stroke', cat.color);
    rect.setAttribute('stroke-width', 1.4);
    g.appendChild(rect);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', pos.w / 2);
    label.setAttribute('y', pos.h / 2 - 2);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'middle');
    label.textContent = d.shortName;
    g.appendChild(label);

    if (pos.h > 46) {
      const sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      sub.setAttribute('x', pos.w / 2);
      sub.setAttribute('y', pos.h - 10);
      sub.setAttribute('text-anchor', 'middle');
      sub.setAttribute('class', 'sub');
      sub.textContent = truncate(d.issuer || '', 26);
      g.appendChild(sub);
    }

    g.addEventListener('click', () => openDetail(id));
    nodesG.appendChild(g);
  });
  svg.appendChild(nodesG);
}

function routeEdge(a, b) {
  // Exit from bottom-centre of "a" (or top, depending) and enter the top of "b"
  const ax = a.x + a.w / 2;
  const ay = a.y + a.h;       // bottom of a
  const bx = b.x + b.w / 2;
  const by = b.y;             // top of b
  // if b is above a, route from top of a to bottom of b instead
  if (by < ay) {
    const ay2 = a.y;
    const by2 = b.y + b.h;
    const my = (ay2 + by2) / 2;
    return `M ${ax} ${ay2} C ${ax} ${my}, ${bx} ${my}, ${bx} ${by2}`;
  }
  const my = (ay + by) / 2;
  return `M ${ax} ${ay} C ${ax} ${my}, ${bx} ${my}, ${bx} ${by}`;
}

function highlightMap(id) {
  const svg = document.getElementById('conceptMap');
  svg.querySelectorAll('.node').forEach(n => n.classList.toggle('active', n.dataset.id === id));
  svg.querySelectorAll('.edge').forEach(e => {
    const related = id && (e.dataset.from === id || e.dataset.to === id);
    e.classList.toggle('highlight', !!related);
  });
}

// ── Copy All as Markdown ─────────────────────────────────────
function copyAllMarkdown() {
  const lines = [];
  lines.push('# GB Grid Docs — Regulatory & Technical Framework');
  lines.push('');
  lines.push(`_${DOCS.length} documents · ${MANIFEST.categories.length} categories · generated from ${MANIFEST.sourceFolder}_`);
  lines.push('');

  MANIFEST.categories.sort((a,b)=>a.order-b.order).forEach(cat => {
    const inCat = DOCS.filter(d => d.category === cat.id);
    if (!inCat.length) return;
    lines.push(`## ${cat.icon} ${cat.name}`);
    lines.push('');
    inCat.forEach(d => {
      lines.push(`### ${d.shortName} — ${d.fullName}`);
      lines.push('');
      lines.push(`- **Issuer:** ${d.issuer}`);
      lines.push(`- **Version:** ${d.version}`);
      lines.push(`- **Status / Date:** ${d.statusDate}`);
      lines.push(`- **Authority:** ${d.authority}`);
      lines.push(`- **Local file:** \`~/Documents/Grid Docs/${d.file}\``);
      if (d.url) lines.push(`- **Source:** ${d.url}`);
      lines.push('');
      lines.push(d.summary);
      lines.push('');
      if (d.scope && d.scope.length) {
        lines.push('**Scope:**');
        d.scope.forEach(s => lines.push(`- ${s}`));
        lines.push('');
      }
      if (d.keyParts && d.keyParts.length) {
        lines.push('**Key parts:**');
        d.keyParts.forEach(k => lines.push(`- **${k.name}** — ${k.detail}`));
        lines.push('');
      }
      if (d.notableSections && d.notableSections.length) {
        lines.push('**Notable sections:**');
        d.notableSections.forEach(n => lines.push(`- **${n.s ? n.s + ' — ' : ''}${n.name}** — ${n.detail}`));
        lines.push('');
      }
      if (d.whoCares && d.whoCares.length) {
        lines.push('**Who it affects:** ' + d.whoCares.join('; '));
        lines.push('');
      }
    });
  });

  const md = lines.join('\n');
  navigator.clipboard.writeText(md).then(() => {
    const btn = document.getElementById('copyAllBtn');
    btn.classList.add('copied');
    btn.textContent = 'Copied ✓';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.textContent = 'Copy All as Markdown';
    }, 1600);
  }).catch(err => alert('Could not copy: ' + err.message));
}

// ── Utils ────────────────────────────────────────────────────
function catMeta(id) {
  return (MANIFEST && MANIFEST.categories.find(c => c.id === id)) ||
    { id, name: id, icon: '', color: '#666', bg: '#eee' };
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

function escapeHTML(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ═══════════════════════════════════════════════════════════════
//  TOP-LEVEL TABS  (Document Library ↔ Process & Documents)
// ═══════════════════════════════════════════════════════════════

function wireTopTabs() {
  document.querySelectorAll('.top-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTopTab(btn.dataset.tab));
  });
  // Support hash-based tab switching (e.g. #process)
  const hash = location.hash.replace('#', '');
  if (hash === 'process') switchTopTab('process');
}

function switchTopTab(tab) {
  if (tab === ACTIVE_TAB) return;
  ACTIVE_TAB = tab;
  document.querySelectorAll('.top-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('tabLibrary').style.display = tab === 'library' ? '' : 'none';
  document.getElementById('tabProcess').style.display  = tab === 'process' ? '' : 'none';
  if (tab === 'process') renderProcessTab();
}

// ═══════════════════════════════════════════════════════════════
//  PROCESS & DOCUMENTS TAB
// ═══════════════════════════════════════════════════════════════

function renderProcessTab() {
  if (!PROC_DATA) return;
  const container = document.getElementById('procContainer');

  const levelData = PROC_LEVEL === 'transmission' ? PROC_DATA.transmission : PROC_DATA.distribution;
  const stats = levelData.stats;

  // Build stats HTML
  const statItems = Object.entries(stats).map(([k, v]) => {
    const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
    return `<div class="proc-stat"><div class="proc-stat-value">${escapeHTML(v)}</div><div class="proc-stat-label">${escapeHTML(label)}</div></div>`;
  }).join('');

  // Get stages
  let stages, pathTabsHTML = '';
  if (PROC_LEVEL === 'transmission') {
    stages = levelData.stages;
  } else {
    const paths = levelData.paths;
    pathTabsHTML = `
      <div class="proc-path-tabs">
        <button class="proc-path-tab ${PROC_PATH === 'g98' ? 'active' : ''}" onclick="switchProcPath('g98')">
          ${paths.g98.name}
        </button>
        <button class="proc-path-tab ${PROC_PATH === 'g99' ? 'active' : ''}" onclick="switchProcPath('g99')">
          ${paths.g99.name}
        </button>
      </div>
      <div class="proc-path-desc">${escapeHTML(paths[PROC_PATH].description)}</div>`;
    stages = paths[PROC_PATH].stages;
  }

  container.innerHTML = `
    <div class="proc-level-tabs">
      <button class="proc-level-tab transmission ${PROC_LEVEL === 'transmission' ? 'active' : ''}" onclick="switchProcLevel('transmission')">
        <span class="proc-tab-icon">&#9889;</span> Transmission (${escapeHTML(PROC_DATA.transmission.voltageLevel)})
      </button>
      <button class="proc-level-tab distribution ${PROC_LEVEL === 'distribution' ? 'active' : ''}" onclick="switchProcLevel('distribution')">
        <span class="proc-tab-icon">&#128268;</span> Distribution (${escapeHTML(PROC_DATA.distribution.voltageLevel)})
      </button>
    </div>

    <div class="proc-overview-section">
      <div class="proc-overview-text">${escapeHTML(levelData.overview)}</div>
      <div class="proc-stats-row">${statItems}</div>
    </div>

    ${pathTabsHTML}

    <div class="proc-timeline">
      ${stages.map((s, i) => renderStageCard(s, i, stages.length)).join('')}
    </div>
  `;

  // Wire stage card click handlers
  container.querySelectorAll('.proc-stage-card').forEach(card => {
    card.addEventListener('click', () => {
      const stageId = card.dataset.stageId;
      openProcStageDetail(stageId);
    });
  });

  // Wire doc pill click handlers
  container.querySelectorAll('.proc-doc-pill[data-doc-id]').forEach(pill => {
    pill.addEventListener('click', e => {
      e.stopPropagation();
      const docId = pill.dataset.docId;
      const stageId = pill.closest('.proc-stage-card').dataset.stageId;
      openProcDocDetail(docId, stageId);
    });
  });

  // Wire entity pill click handlers
  container.querySelectorAll('.proc-entity-pill[data-entity-name]').forEach(pill => {
    pill.addEventListener('click', e => {
      e.stopPropagation();
      const entityName = pill.dataset.entityName;
      const stageId = pill.closest('.proc-stage-card').dataset.stageId;
      openProcEntityDetail(entityName, stageId);
    });
  });
}

function renderStageCard(stage, index, total) {
  const levelColor = PROC_LEVEL === 'transmission' ? '#dc2626' : '#2563eb';
  const levelBg = PROC_LEVEL === 'transmission' ? '#fee2e2' : '#dbeafe';
  const isSelected = PROC_SELECTED_STAGE === stage.id;

  const docPills = stage.documents.map(d => {
    const doc = DOC_BY_ID[d.docId];
    if (!doc) return '';
    const cat = catMeta(doc.category);
    return `<button class="proc-doc-pill" data-doc-id="${d.docId}" style="background:${cat.bg};color:${cat.color};border:1px solid ${cat.color}22" title="${escapeHTML(d.sections)}">${doc.icon || '📄'} ${escapeHTML(doc.shortName)}</button>`;
  }).join('');

  const entityColors = {
    applicant: { bg: '#f0fdf4', color: '#166534', border: '#16653422' },
    operator: { bg: '#eff6ff', color: '#1e40af', border: '#1e40af22' },
    regulator: { bg: '#fefce8', color: '#854d0e', border: '#854d0e22' },
    builder: { bg: '#fdf4ff', color: '#7e22ce', border: '#7e22ce22' },
    installer: { bg: '#f0fdfa', color: '#0f766e', border: '#0f766e22' }
  };

  const entityPills = stage.entities.map(e => {
    const ec = entityColors[e.type] || entityColors.operator;
    return `<button class="proc-entity-pill" data-entity-name="${escapeHTML(e.name)}" style="background:${ec.bg};color:${ec.color};border:1px solid ${ec.border}">${escapeHTML(e.name)}</button>`;
  }).join('');

  return `
    <div class="proc-stage-card ${isSelected ? 'selected' : ''}" data-stage-id="${stage.id}" style="--stage-index:${index}">
      <div class="proc-stage-connector">
        <div class="proc-stage-num" style="background:${levelColor};color:#fff">${index + 1}</div>
        ${index < total - 1 ? `<div class="proc-stage-line" style="background:${levelColor}20"></div>` : ''}
      </div>
      <div class="proc-stage-content">
        <div class="proc-stage-header">
          <div class="proc-stage-name">${escapeHTML(stage.name)}</div>
          ${stage.timeline ? `<span class="proc-stage-timeline" style="background:${levelBg};color:${levelColor}">${escapeHTML(stage.timeline)}</span>` : ''}
        </div>
        <div class="proc-stage-desc">${escapeHTML(truncate(stage.description, 180))}</div>
        <div class="proc-stage-section">
          <div class="proc-stage-section-label">Documents</div>
          <div class="proc-pills-wrap">${docPills}</div>
        </div>
        <div class="proc-stage-section">
          <div class="proc-stage-section-label">Entities</div>
          <div class="proc-pills-wrap">${entityPills}</div>
        </div>
      </div>
    </div>`;
}

function switchProcLevel(level) {
  PROC_LEVEL = level;
  PROC_PATH = 'g99';
  closeProcDetail();
  renderProcessTab();
}

function switchProcPath(path) {
  PROC_PATH = path;
  closeProcDetail();
  renderProcessTab();
}

// ── Process detail panels ──

function getStagesForCurrentLevel() {
  if (PROC_LEVEL === 'transmission') return PROC_DATA.transmission.stages;
  return PROC_DATA.distribution.paths[PROC_PATH].stages;
}

function openProcStageDetail(stageId) {
  const stages = getStagesForCurrentLevel();
  const stage = stages.find(s => s.id === stageId);
  if (!stage) return;

  if (PROC_SELECTED_TYPE === 'stage' && PROC_SELECTED_ID === stageId) {
    closeProcDetail();
    return;
  }

  PROC_SELECTED_STAGE = stageId;
  PROC_SELECTED_TYPE = 'stage';
  PROC_SELECTED_ID = stageId;

  const levelColor = PROC_LEVEL === 'transmission' ? '#dc2626' : '#2563eb';
  const host = document.getElementById('procDetailBox');
  const sec = document.getElementById('procDetailSection');

  // Documents detail
  const docsHTML = stage.documents.map(d => {
    const doc = DOC_BY_ID[d.docId];
    if (!doc) return '';
    const cat = catMeta(doc.category);
    return `
      <div class="proc-detail-doc">
        <div class="proc-detail-doc-header">
          <span class="proc-detail-doc-icon" style="background:${cat.bg};border-color:${cat.color}">${doc.icon || '📄'}</span>
          <div class="proc-detail-doc-titles">
            <div class="proc-detail-doc-name">${escapeHTML(doc.shortName)}</div>
            <div class="proc-detail-doc-sections">${escapeHTML(d.sections)}</div>
          </div>
          <span class="proc-detail-doc-cat" style="background:${cat.bg};color:${cat.color}">${escapeHTML(cat.name)}</span>
        </div>
        <div class="proc-detail-doc-relevance">${escapeHTML(d.relevance)}</div>
        ${doc.url ? `<a class="proc-detail-link" href="${doc.url}" target="_blank" rel="noopener">${escapeHTML(doc.shortName)} official source &#8599;</a>` : ''}
      </div>`;
  }).join('');

  // Entities detail
  const entitiesHTML = stage.entities.map(e => {
    return `
      <div class="proc-detail-entity">
        <div class="proc-detail-entity-header">
          <div class="proc-detail-entity-name">${escapeHTML(e.name)}</div>
          ${e.fullName ? `<div class="proc-detail-entity-full">${escapeHTML(e.fullName)}</div>` : ''}
        </div>
        <div class="proc-detail-entity-role">${escapeHTML(e.role)}</div>
        ${e.url ? `<a class="proc-detail-link" href="${e.url}" target="_blank" rel="noopener">${escapeHTML(e.name)} website &#8599;</a>` : ''}
      </div>`;
  }).join('');

  // Sources
  const sourcesHTML = stage.sources && stage.sources.length ? `
    <div class="proc-detail-block">
      <div class="proc-detail-block-title">Official Sources</div>
      <div class="proc-detail-sources-grid">
        ${stage.sources.map(s => `<a class="proc-source-btn" href="${s.url}" target="_blank" rel="noopener">${escapeHTML(s.label)} &#8599;</a>`).join('')}
      </div>
    </div>` : '';

  host.innerHTML = `
    <div class="proc-detail-header" style="border-left:5px solid ${levelColor}">
      <div class="proc-detail-titles">
        <div class="proc-detail-name">${escapeHTML(stage.name)}</div>
        ${stage.timeline ? `<span class="proc-detail-timeline-badge" style="background:${levelColor}15;color:${levelColor}">${escapeHTML(stage.timeline)}</span>` : ''}
      </div>
      <button class="proc-detail-close" onclick="closeProcDetail()">&#215;</button>
    </div>
    <div class="proc-detail-description">${escapeHTML(stage.description)}</div>
    <div class="proc-detail-block">
      <div class="proc-detail-block-title">Documents Required at This Stage (${stage.documents.length})</div>
      <div class="proc-detail-docs-grid">${docsHTML}</div>
    </div>
    <div class="proc-detail-block">
      <div class="proc-detail-block-title">Entities Involved (${stage.entities.length})</div>
      <div class="proc-detail-entities-grid">${entitiesHTML}</div>
    </div>
    ${sourcesHTML}
  `;

  sec.style.display = 'block';
  highlightStageCard(stageId);
  setTimeout(() => sec.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

function openProcDocDetail(docId, stageId) {
  const doc = DOC_BY_ID[docId];
  if (!doc) return;

  if (PROC_SELECTED_TYPE === 'doc' && PROC_SELECTED_ID === docId) {
    closeProcDetail();
    return;
  }

  PROC_SELECTED_STAGE = stageId;
  PROC_SELECTED_TYPE = 'doc';
  PROC_SELECTED_ID = docId;

  const cat = catMeta(doc.category);
  const host = document.getElementById('procDetailBox');
  const sec = document.getElementById('procDetailSection');

  // Find all stages where this document appears
  const stages = getStagesForCurrentLevel();
  const appearsIn = stages.filter(s => s.documents.some(d => d.docId === docId));

  const stagesHTML = appearsIn.map(s => {
    const docRef = s.documents.find(d => d.docId === docId);
    return `
      <div class="proc-detail-stage-ref" onclick="openProcStageDetail('${s.id}')">
        <div class="proc-detail-stage-ref-name">${escapeHTML(s.name)}</div>
        <div class="proc-detail-stage-ref-sections">${escapeHTML(docRef.sections)}</div>
        <div class="proc-detail-stage-ref-why">${escapeHTML(docRef.relevance)}</div>
      </div>`;
  }).join('');

  host.innerHTML = `
    <div class="proc-detail-header" style="border-left:5px solid ${cat.color}">
      <div class="proc-detail-doc-icon-lg" style="background:${cat.bg};border-color:${cat.color}">${doc.icon || '📄'}</div>
      <div class="proc-detail-titles">
        <div class="proc-detail-name">${escapeHTML(doc.shortName)}</div>
        <div class="proc-detail-subtitle">${escapeHTML(doc.fullName)}</div>
      </div>
      <button class="proc-detail-close" onclick="closeProcDetail()">&#215;</button>
    </div>

    <div class="proc-detail-meta-grid">
      ${procMetaCard('Category', cat.name)}
      ${procMetaCard('Issuer', doc.issuer)}
      ${procMetaCard('Version', doc.version)}
      ${procMetaCard('Authority', doc.authority)}
    </div>

    <div class="proc-detail-description">${escapeHTML(doc.summary)}</div>

    <div class="proc-detail-block">
      <div class="proc-detail-block-title">Used in ${appearsIn.length} Stage${appearsIn.length !== 1 ? 's' : ''} of the ${PROC_LEVEL === 'transmission' ? 'Transmission' : 'Distribution'} Process</div>
      <div class="proc-detail-stages-list">${stagesHTML}</div>
    </div>

    ${doc.url ? `<div class="proc-detail-block"><a class="proc-source-btn" href="${doc.url}" target="_blank" rel="noopener">Official source: ${escapeHTML(doc.shortName)} &#8599;</a></div>` : ''}
  `;

  sec.style.display = 'block';
  highlightStageCard(stageId);
  setTimeout(() => sec.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

function openProcEntityDetail(entityName, stageId) {
  if (PROC_SELECTED_TYPE === 'entity' && PROC_SELECTED_ID === entityName) {
    closeProcDetail();
    return;
  }

  PROC_SELECTED_STAGE = stageId;
  PROC_SELECTED_TYPE = 'entity';
  PROC_SELECTED_ID = entityName;

  const stages = getStagesForCurrentLevel();
  const appearsIn = stages.filter(s => s.entities.some(e => e.name === entityName));

  // Get the entity data from the first occurrence (for url/fullName)
  let entityData = null;
  for (const s of stages) {
    const e = s.entities.find(e => e.name === entityName);
    if (e) { entityData = e; break; }
  }
  if (!entityData) return;

  const levelColor = PROC_LEVEL === 'transmission' ? '#dc2626' : '#2563eb';
  const host = document.getElementById('procDetailBox');
  const sec = document.getElementById('procDetailSection');

  const stagesHTML = appearsIn.map(s => {
    const entRef = s.entities.find(e => e.name === entityName);
    return `
      <div class="proc-detail-stage-ref" onclick="openProcStageDetail('${s.id}')">
        <div class="proc-detail-stage-ref-name">${escapeHTML(s.name)}</div>
        <div class="proc-detail-stage-ref-why">${escapeHTML(entRef.role)}</div>
      </div>`;
  }).join('');

  host.innerHTML = `
    <div class="proc-detail-header" style="border-left:5px solid ${levelColor}">
      <div class="proc-detail-titles">
        <div class="proc-detail-name">${escapeHTML(entityData.name)}</div>
        ${entityData.fullName ? `<div class="proc-detail-subtitle">${escapeHTML(entityData.fullName)}</div>` : ''}
      </div>
      <button class="proc-detail-close" onclick="closeProcDetail()">&#215;</button>
    </div>

    <div class="proc-detail-description">${escapeHTML(entityData.role)}</div>

    <div class="proc-detail-block">
      <div class="proc-detail-block-title">Involved in ${appearsIn.length} of ${stages.length} Stages</div>
      <div class="proc-detail-stages-list">${stagesHTML}</div>
    </div>

    ${entityData.url ? `<div class="proc-detail-block"><a class="proc-source-btn" href="${entityData.url}" target="_blank" rel="noopener">${escapeHTML(entityData.name)} website &#8599;</a></div>` : ''}
  `;

  sec.style.display = 'block';
  highlightStageCard(stageId);
  setTimeout(() => sec.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

function closeProcDetail() {
  document.getElementById('procDetailSection').style.display = 'none';
  PROC_SELECTED_STAGE = null;
  PROC_SELECTED_TYPE = null;
  PROC_SELECTED_ID = null;
  highlightStageCard(null);
}

function highlightStageCard(stageId) {
  document.querySelectorAll('.proc-stage-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.stageId === stageId);
  });
}

function procMetaCard(label, value) {
  if (!value) return '';
  return `<div class="proc-meta-card"><div class="proc-meta-label">${escapeHTML(label)}</div><div class="proc-meta-value">${escapeHTML(value)}</div></div>`;
}
