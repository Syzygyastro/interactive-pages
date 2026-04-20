// ─────────────────────────────────────────────────────────────
// GB Grid Docs — interactive explorer + concept map
// ─────────────────────────────────────────────────────────────

let MANIFEST = null;
let DOCS = [];           // array of full doc objects
let DOC_BY_ID = {};
let ACTIVE_CATEGORY = 'all';
let ACTIVE_QUERY = '';
let ACTIVE_DOC_ID = null;

// ── Bootstrap ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    MANIFEST = await fetch('data/manifest.json').then(r => r.json());
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
const MAP_LAYOUT = {
  'electricity-act-1989': { x:  80, y:  40, w: 200, h: 44 },
  'esqcr-2002':           { x: 720, y:  40, w: 200, h: 44 },

  'grid-code':            { x:  40, y: 170, w: 150, h: 54 },
  'cusc':                 { x: 210, y: 170, w: 150, h: 54 },
  'stc':                  { x: 380, y: 170, w: 150, h: 54 },
  'nets-sqss':            { x: 550, y: 170, w: 170, h: 54 },
  'dcusa':                { x: 740, y: 170, w: 150, h: 54 },
  'd-code':               { x: 740, y: 240, w: 150, h: 54 },

  'g99':                  { x: 740, y: 330, w: 150, h: 44 },

  'tmo4-plus':            { x: 100, y: 330, w: 180, h: 54 },
  'g2cm':                 { x:  40, y: 430, w: 150, h: 44 },
  'cndm':                 { x: 210, y: 430, w: 150, h: 44 },
  'further-methodologies':{ x: 380, y: 430, w: 200, h: 44 },
  'demand-connections-cfi':{ x: 540, y: 430, w: 180, h: 54 }
};

const MAP_EDGES = [
  // Electricity Act enables the industry codes
  { from: 'electricity-act-1989', to: 'grid-code',  type: 'enable' },
  { from: 'electricity-act-1989', to: 'cusc',       type: 'enable' },
  { from: 'electricity-act-1989', to: 'stc',        type: 'enable' },
  { from: 'electricity-act-1989', to: 'nets-sqss',  type: 'enable' },
  { from: 'electricity-act-1989', to: 'dcusa',      type: 'enable' },
  { from: 'esqcr-2002',           to: 'd-code',     type: 'enable' },
  { from: 'esqcr-2002',           to: 'g99',        type: 'enable' },

  // Pairings
  { from: 'grid-code', to: 'cusc',  type: 'pair' },
  { from: 'dcusa',     to: 'd-code', type: 'pair' },
  { from: 'd-code',    to: 'g99',    type: 'pair' },

  // TMO4+ reforms modify CUSC and spawn the methodologies
  { from: 'tmo4-plus', to: 'cusc',                  type: 'modify' },
  { from: 'tmo4-plus', to: 'g2cm',                  type: 'enable' },
  { from: 'tmo4-plus', to: 'cndm',                  type: 'enable' },
  { from: 'tmo4-plus', to: 'further-methodologies', type: 'enable' },

  // Demand reform relates to CUSC and DCUSA
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
