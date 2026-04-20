/* Grid Interconnection Process — app.js */

const DATA_FILES = [
  'data/uk.json','data/usa.json','data/germany.json','data/netherlands.json',
  'data/france.json','data/spain.json','data/kenya.json'
];

let DATA = [];
let currentCountry = null;
let activeLevel = 'transmission'; // which tab is showing
let openSections = new Set();
let faqOpen = false;
let noteOpen = false;
let currentRegionFilter = 'all';
let currentLevelFilter = 'all';
let selectedFlowNode = null;

// ── Flow Diagram Config ──

const FLOW = {
  cellW: 240,
  cellH: 110,
  nodeW: 190,
  nodeH: 58,
  decisionSize: 38,
  forkW: 100,
  forkH: 6,
  pillW: 190,
  pillH: 36,
  pad: { top: 30, right: 50, bottom: 40, left: 50 },
  cornerR: 8
};

function flowTimelineLabel(text) {
  if (!text) return '';
  const compact = text
    .replace(/calendar days/g, 'days')
    .replace(/business days/g, 'biz days')
    .replace(/working days/g, 'work days')
    .replace(/months/g, 'mo')
    .replace(/energisation/g, 'energ.')
    .replace(/connection/g, 'conn.');
  return compact.length > 28 ? `${compact.slice(0, 25)}...` : compact;
}

// ── Data Loading ──

function showSkeletons() {
  const grid = document.getElementById('cardsGrid');
  grid.innerHTML = Array(7).fill(0).map(() =>
    `<div class="skeleton-card">
      <div class="skeleton" style="height:60px;margin-bottom:12px"></div>
      <div class="skeleton" style="height:16px;width:80%;margin-bottom:8px"></div>
      <div class="skeleton" style="height:16px;width:60%"></div>
    </div>`
  ).join('');
}

async function loadData() {
  showSkeletons();
  try {
    DATA = await Promise.all(DATA_FILES.map(f => fetch(f).then(r => r.json())));
    renderCards();
  } catch (e) {
    document.getElementById('cardsGrid').innerHTML =
      `<div class="skeleton-card"><p style="color:#991b1b;font-weight:600">Error loading data. <button onclick="loadData()">Retry</button></p></div>`;
  }
}

// ── Cards ──

function renderCards() {
  const grid = document.getElementById('cardsGrid');
  grid.style.opacity = '0';
  grid.style.transform = 'translateY(8px)';
  setTimeout(() => {
    grid.innerHTML = '';
    let idx = 0;
    DATA.forEach(c => {
      if (currentRegionFilter !== 'all' && !c.tags.includes(currentRegionFilter)) return;
      const card = document.createElement('div');
      card.className = 'country-card';
      card.style.borderLeftColor = c.accentColor;
      card.style.setProperty('--card-index', idx++);
      card.onclick = () => {
        card.style.transform = 'scale(0.97)';
        setTimeout(() => { card.style.transform = ''; openDetail(c.id); }, 120);
      };
      card.innerHTML = `
        <div class='card-header' style='background:${c.accentBg}'>
          <div class='card-icon'>${c.icon}</div>
          <div class='card-titles'>
            <div class='card-name'>${c.name}</div>
            <div class='card-type'>${c.type}</div>
            <div class='card-badges'>
              <span class='card-badge' style='background:${c.badgeColor};color:${c.badgeText}'>${c.badge}</span>
              ${c.badge2 ? `<span class='card-badge' style='background:${c.badgeColor};color:${c.badgeText}'>${c.badge2}</span>` : ''}
            </div>
          </div>
        </div>
        <div class='card-body'>
          <div class='card-tags'>${c.cardTags.map(t => `<span class='card-tag'>${t}</span>`).join('')}</div>
          <div class='card-desc'>${c.sub}</div>
        </div>
        <div class='card-footer'>
          <span class='card-detail-btn'>View Details &rarr;</span>
          <span class='card-count'>${c.transmission.steps.length + c.distribution.steps.length} steps</span>
        </div>`;
      grid.appendChild(card);
    });
    // Observe for viewport entry
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = 'running';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    grid.querySelectorAll('.country-card').forEach(card => {
      card.style.animationPlayState = 'paused';
      observer.observe(card);
    });
    grid.style.opacity = '1';
    grid.style.transform = 'translateY(0)';
    grid.style.transition = 'opacity 0.2s, transform 0.2s';
  }, 200);
}

function filterRegion(region, btn) {
  currentRegionFilter = region;
  document.querySelectorAll('.filter-btn:not(.level-btn)').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCards();
  closeDetail();
}

function filterLevel(level, btn) {
  currentLevelFilter = level;
  document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // If detail is open, re-render to show correct level
  if (currentCountry) renderDetail();
}

// ── Inline Detail ──

function openDetail(countryId) {
  currentCountry = DATA.find(c => c.id === countryId);
  openSections = new Set();
  faqOpen = false;
  noteOpen = false;
  activeLevel = 'transmission';
  renderDetail();
  const section = document.getElementById('detailSection');
  section.style.display = 'block';
  setTimeout(() => {
    const y = section.getBoundingClientRect().top + window.scrollY - 20;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }, 50);
}

function closeDetail() {
  document.getElementById('detailSection').style.display = 'none';
  currentCountry = null;
}

function switchLevel(level) {
  activeLevel = level;
  openSections = new Set();
  renderDetail();
}

function renderDetail() {
  if (!currentCountry) return;
  const c = currentCountry;
  const t = c.transmission;
  const d = c.distribution;

  document.getElementById('detailBox').innerHTML = `
    <div class="detail-header" style="border-left:5px solid ${c.accentColor}">
      <div class="detail-icon">${c.icon}</div>
      <div class="detail-titles">
        <div class="detail-name">${c.name}</div>
        <div class="detail-full">${c.full}</div>
      </div>
      <button class="detail-close" onclick="closeDetail()">&times;</button>
    </div>
    <div class="detail-desc">${c.desc}</div>

    <div class="level-tabs">
      <button class="level-tab transmission ${activeLevel === 'transmission' ? 'active' : ''}" onclick="switchLevel('transmission')">
        <span class="tab-icon">⚡</span> Transmission (${t.voltageLevel})
      </button>
      <button class="level-tab distribution ${activeLevel === 'distribution' ? 'active' : ''}" onclick="switchLevel('distribution')">
        <span class="tab-icon">🔌</span> Distribution (${d.voltageLevel})
      </button>
    </div>

    ${activeLevel === 'transmission' ? renderProcessSection(t, 'transmission') : renderProcessSection(d, 'distribution')}

    ${renderReforms(c)}

    <div class="collapsible-header ${faqOpen ? 'open' : ''}" onclick="toggleFAQ()">
      <span class="collapsible-arrow">&#9654;</span>
      <span class="collapsible-title">Frequently Asked Questions (${c.faq.length})</span>
    </div>
    <div class="collapsible-body">${faqOpen ? renderFAQ() : ''}</div>

    <div class="collapsible-header ${noteOpen ? 'open' : ''}" onclick="toggleNote()">
      <span class="collapsible-arrow">&#9654;</span>
      <span class="collapsible-title">Strategy Note</span>
    </div>
    <div class="collapsible-body">${noteOpen ? renderNote() : ''}
    </div>`;
}

// ── Flow Diagram Renderer ──

function flowNodeCenter(node) {
  return {
    x: FLOW.pad.left + node.col * FLOW.cellW + FLOW.cellW / 2,
    y: FLOW.pad.top + node.row * FLOW.cellH + FLOW.cellH / 2
  };
}

function flowNodeOffsets(node) {
  const t = node.type;
  if (t === 'step') return { top: FLOW.nodeH / 2, bottom: FLOW.nodeH / 2 };
  if (t === 'decision') return { top: FLOW.decisionSize, bottom: FLOW.decisionSize };
  if (t === 'fork' || t === 'join') return { top: FLOW.forkH / 2, bottom: FLOW.forkH / 2 };
  if (t === 'start' || t === 'end') return { top: FLOW.pillH / 2, bottom: FLOW.pillH / 2 };
  return { top: 20, bottom: 20 };
}

function flowEdgePath(fromNode, toNode) {
  const fc = flowNodeCenter(fromNode);
  const tc = flowNodeCenter(toNode);
  const fo = flowNodeOffsets(fromNode);
  const to2 = flowNodeOffsets(toNode);
  const sy = fc.y + fo.bottom + 2;
  const ey = tc.y - to2.top - 2;
  const r = FLOW.cornerR;

  if (fromNode.col === toNode.col) {
    return `M ${fc.x} ${sy} L ${fc.x} ${ey}`;
  }

  // Orthogonal routing with rounded corners
  const midY = sy + (ey - sy) * 0.4;
  const dx = tc.x - fc.x;
  const signX = dx > 0 ? 1 : -1;
  return `M ${fc.x} ${sy} L ${fc.x} ${midY - r} Q ${fc.x} ${midY} ${fc.x + signX * r} ${midY} L ${tc.x - signX * r} ${midY} Q ${tc.x} ${midY} ${tc.x} ${midY + r} L ${tc.x} ${ey}`;
}

function flowNodeSVG(node, level) {
  const c = flowNodeCenter(node);
  const t = node.type;
  const levelColor = level === 'transmission' ? '#dc2626' : '#2563eb';
  const levelColorLight = level === 'transmission' ? '#fee2e2' : '#dbeafe';

  let shape = '';
  let labelEl = '';
  let badgeEl = '';

  if (t === 'start') {
    shape = `<rect x="${c.x - FLOW.pillW/2}" y="${c.y - FLOW.pillH/2}" width="${FLOW.pillW}" height="${FLOW.pillH}" rx="${FLOW.pillH/2}" class="node-shape node-start"/>`;
    labelEl = `<text x="${c.x}" y="${c.y + 4}" class="node-label node-label-start">${node.label}</text>`;
  } else if (t === 'end') {
    shape = `<rect x="${c.x - FLOW.pillW/2}" y="${c.y - FLOW.pillH/2}" width="${FLOW.pillW}" height="${FLOW.pillH}" rx="${FLOW.pillH/2}" class="node-shape node-end"/>`;
    labelEl = `<text x="${c.x}" y="${c.y + 4}" class="node-label node-label-end">${node.label}</text>`;
  } else if (t === 'decision') {
    const s = FLOW.decisionSize;
    shape = `<polygon points="${c.x},${c.y - s} ${c.x + s * 1.3},${c.y} ${c.x},${c.y + s} ${c.x - s * 1.3},${c.y}" class="node-shape node-decision"/>`;
    labelEl = `<text x="${c.x}" y="${c.y + 4}" class="node-label node-label-decision">${node.label}</text>`;
  } else if (t === 'fork' || t === 'join') {
    shape = `<rect x="${c.x - FLOW.forkW/2}" y="${c.y - FLOW.forkH/2}" width="${FLOW.forkW}" height="${FLOW.forkH}" rx="3" class="node-shape node-fork" style="fill:${levelColor}"/>`;
    return `<g class="flow-node flow-node-structural" data-id="${node.id}" data-type="${t}" data-row="${node.row}">${shape}</g>`;
  } else {
    // step node
    shape = `<rect x="${c.x - FLOW.nodeW/2}" y="${c.y - FLOW.nodeH/2}" width="${FLOW.nodeW}" height="${FLOW.nodeH}" rx="8" class="node-shape node-step"/>`;
    // Use foreignObject for text wrapping
    const foX = c.x - FLOW.nodeW/2 + 8;
    const foY = c.y - FLOW.nodeH/2 + 6;
    const foW = FLOW.nodeW - 16;
    labelEl = `<foreignObject x="${foX}" y="${foY}" width="${foW}" height="${FLOW.nodeH - 12}" class="node-fo"><div xmlns="http://www.w3.org/1999/xhtml" class="node-fo-label">${node.label}</div></foreignObject>`;

    // Timeline badge below node
    if (node.timeline) {
      const timelineLabel = flowTimelineLabel(node.timeline);
      const basisDot = node.timelineBasis === 'evidence'
        ? `<circle cx="${c.x - 36}" cy="${c.y + FLOW.nodeH/2 + 12}" r="4" class="basis-dot basis-evidence"/>`
        : `<circle cx="${c.x - 36}" cy="${c.y + FLOW.nodeH/2 + 12}" r="4" class="basis-dot basis-assumption"/>`;
      badgeEl = `<g class="node-timeline-badge">
        <rect x="${c.x - FLOW.nodeW/2 + 10}" y="${c.y + FLOW.nodeH/2 + 3}" width="${FLOW.nodeW - 20}" height="18" rx="9" class="timeline-badge-bg" style="fill:${levelColorLight}"/>
        ${basisDot}
        <text x="${c.x}" y="${c.y + FLOW.nodeH/2 + 15}" class="timeline-badge-text" style="fill:${levelColor}">${timelineLabel}</text>
      </g>`;
    }
  }

  const clickable = (t === 'step' || t === 'decision') && node.detail;
  return `<g class="flow-node ${clickable ? 'flow-node-clickable' : ''} ${level}" data-id="${node.id}" data-type="${t}" data-row="${node.row}" ${clickable ? `tabindex="0" onclick="handleFlowNodeClick('${node.id}')" onkeydown="if(event.key==='Enter')handleFlowNodeClick('${node.id}')"` : ''}>
    ${shape}${labelEl}${badgeEl}
  </g>`;
}

function renderFlowDiagram(processFlow, level) {
  if (!processFlow || !processFlow.nodes || !processFlow.nodes.length) return '';

  const minCol = Math.min(...processFlow.nodes.map(n => n.col || 0));
  const nodes = processFlow.nodes.map(n => ({ ...n, col: (n.col || 0) - minCol }));
  const edges = processFlow.edges || [];
  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });

  // Calculate viewBox
  let maxRow = 0, maxCol = 0;
  nodes.forEach(n => { maxRow = Math.max(maxRow, n.row); maxCol = Math.max(maxCol, n.col); });
  const svgW = FLOW.pad.left + (maxCol + 1) * FLOW.cellW + FLOW.pad.right;
  const svgH = FLOW.pad.top + (maxRow + 1) * FLOW.cellH + FLOW.pad.bottom;

  const levelColor = level === 'transmission' ? '#dc2626' : '#2563eb';
  const levelColorLight = level === 'transmission' ? '#fca5a5' : '#93c5fd';

  // Render edges
  const edgeSVGs = edges.map((e, i) => {
    const fn = nodeMap[e.from];
    const tn = nodeMap[e.to];
    if (!fn || !tn) return '';
    const d = flowEdgePath(fn, tn);
    const cls = e.type === 'conditional' ? 'edge-path edge-conditional' : e.type === 'parallel' ? 'edge-path edge-parallel' : 'edge-path';

    // Edge label positioning
    let labelSVG = '';
    if (e.label) {
      const fc = flowNodeCenter(fn);
      const tc = flowNodeCenter(tn);
      const lx = (fc.x + tc.x) / 2;
      const ly = (fc.y + tc.y) / 2 - 6;
      labelSVG = `<rect x="${lx - e.label.length * 3.5 - 4}" y="${ly - 10}" width="${e.label.length * 7 + 8}" height="16" rx="3" fill="#fff" stroke="#e2e8f0" stroke-width="0.5"/>
        <text x="${lx}" y="${ly + 2}" class="edge-label">${e.label}</text>`;
    }

    return `<g class="flow-edge" data-idx="${i}">
      <path d="${d}" class="${cls}" style="stroke:${e.type === 'conditional' ? levelColorLight : '#cbd5e0'}" marker-end="url(#arrow-${level})"/>
      ${labelSVG}
    </g>`;
  }).join('');

  // Render nodes
  const nodeSVGs = nodes.map(n => flowNodeSVG(n, level)).join('');

  // Legend
  const legend = `<g class="flow-legend" transform="translate(${FLOW.pad.left}, ${svgH - 24})">
    <circle cx="0" cy="0" r="4" class="basis-dot basis-evidence"/>
    <text x="8" y="4" class="legend-text">Evidence-based timeline</text>
    <circle cx="160" cy="0" r="4" class="basis-dot basis-assumption"/>
    <text x="168" y="4" class="legend-text">Estimated timeline</text>
  </g>`;

  return `
    <div class="flow-diagram-container">
      <div class="flow-diagram-scroll">
        <svg class="flow-diagram" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMin meet">
          <defs>
            <marker id="arrow-${level}" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 4 L 0 8 Z" fill="${levelColor}" opacity="0.6"/>
            </marker>
          </defs>
          <g class="flow-edges-layer">${edgeSVGs}</g>
          <g class="flow-nodes-layer">${nodeSVGs}</g>
          ${legend}
        </svg>
      </div>
      <div class="flow-node-detail" id="flowNodeDetail" style="display:none"></div>
    </div>`;
}

function handleFlowNodeClick(nodeId) {
  if (!currentCountry) return;
  const proc = currentCountry[activeLevel];
  if (!proc.processFlow) return;
  const node = proc.processFlow.nodes.find(n => n.id === nodeId);
  if (!node) return;

  const detailEl = document.getElementById('flowNodeDetail');
  const level = activeLevel;
  const levelColor = level === 'transmission' ? '#dc2626' : '#2563eb';

  // Toggle
  if (selectedFlowNode === nodeId) {
    selectedFlowNode = null;
    detailEl.style.display = 'none';
    document.querySelectorAll('.flow-node').forEach(el => el.classList.remove('selected'));
    return;
  }

  selectedFlowNode = nodeId;
  document.querySelectorAll('.flow-node').forEach(el => el.classList.remove('selected'));
  const svgNode = document.querySelector(`.flow-node[data-id="${nodeId}"]`);
  if (svgNode) svgNode.classList.add('selected');

  const basisLabel = node.timelineBasis === 'evidence'
    ? '<span class="basis-tag evidence">Evidence-based</span>'
    : node.timelineBasis === 'assumption'
    ? '<span class="basis-tag assumption">Estimated</span>'
    : '';

  const sourcesHTML = (node.sources && node.sources.length)
    ? `<div class="flow-detail-sources"><div class="flow-detail-sources-label">Sources</div><div class="links-row">${node.sources.map(s => `<a class="link-box" href="${s.url}" target="_blank">${s.label}</a>`).join('')}</div></div>`
    : '';

  detailEl.style.display = 'block';
  detailEl.style.borderLeftColor = levelColor;
  detailEl.innerHTML = `
    <div class="flow-detail-header">
      <div class="flow-detail-title">${node.label}</div>
      <button class="flow-detail-close" onclick="handleFlowNodeClick('${nodeId}')">&times;</button>
    </div>
    ${node.timeline ? `<div class="flow-detail-timeline">${node.timeline} ${basisLabel}</div>` : ''}
    ${node.detail ? `<div class="flow-detail-body">${node.detail}</div>` : ''}
    ${sourcesHTML}
  `;

  detailEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Process Section ──

function renderProcessSection(proc, level) {
  return `
    <div class="process-section">
      <div class="process-header">
        <span class="process-level-badge ${level}">${level === 'transmission' ? '⚡ Transmission' : '🔌 Distribution'}</span>
        <span class="process-title">${proc.title}</span>
      </div>
      <div class="process-overview">${proc.overview}</div>

      <div class="section-heading" style="padding-left:0">Key Bodies</div>
      <div class="bodies-grid">
        ${proc.keyBodies.map(b => `
          <div class="body-card">
            <div class="body-card-name">${b.name}</div>
            ${b.fullName ? `<div class="body-card-full">${b.fullName}</div>` : ''}
            <div class="body-card-role">${b.role}</div>
            ${b.url ? `<a class="body-card-url" href="${b.url}" target="_blank">Website &rarr;</a>` : ''}
          </div>
        `).join('')}
      </div>

      <div class="info-grid">
        <div class="info-card" style="--meta-index:0">
          <div class="info-label">Voltage Level</div>
          <div class="info-value">${proc.voltageLevel}</div>
        </div>
        <div class="info-card" style="--meta-index:1">
          <div class="info-label">Typical Timeline</div>
          <div class="info-value">${proc.typicalTimeline}</div>
          ${proc.timelineDetail ? `<div class="info-detail">${proc.timelineDetail}</div>` : ''}
        </div>
        <div class="info-card" style="--meta-index:2">
          <div class="info-label">Cost Range</div>
          <div class="info-value">${proc.costRange}</div>
          ${proc.costDetail ? `<div class="info-detail">${proc.costDetail}</div>` : ''}
        </div>
        ${proc.queueSize ? `
        <div class="info-card" style="--meta-index:3">
          <div class="info-label">Queue / Backlog</div>
          <div class="info-value">${proc.queueSize}</div>
          ${proc.queueDetail ? `<div class="info-detail">${proc.queueDetail}</div>` : ''}
        </div>` : ''}
      </div>

      ${proc.processFlow
        ? `<div class="process-steps-title" style="padding:16px 0 0">Interconnection Process Flow</div>
           ${renderFlowDiagram(proc.processFlow, level)}`
        : `<div class="process-steps">
            <div class="process-steps-title">Interconnection Process Steps</div>
            ${proc.steps.map((s, i) => `
              <div class="step-item" style="--step-index:${i}">
                <div class="step-connector">
                  <div class="step-num ${level}">${i + 1}</div>
                  <div class="step-line ${level}"></div>
                </div>
                <div class="step-content">
                  <div class="step-name">${s.name}</div>
                  <div class="step-detail">${s.detail}</div>
                  ${s.timeline ? `<span class="step-timeline-badge ${level}">${s.timeline}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>`
      }

      ${proc.challenges ? `
      <div class="section-heading" style="padding-left:0">Key Challenges</div>
      <div class="process-overview">${proc.challenges}</div>
      ` : ''}
    </div>`;
}

// ── Reforms ──

function renderReforms(c) {
  if (!c.reforms || !c.reforms.length) return '';
  return `
    <div class="section-heading">Recent Reforms &amp; Policy Changes</div>
    ${c.reforms.map((r, i) => {
      const isOpen = openSections.has('reform-' + i);
      return `<div class="programme-node ${isOpen ? 'open' : ''}">
        <div class="prog-header" onclick="toggleSection('reform-${i}')">
          <span class="prog-arrow">&#9654;</span>
          <span class="prog-name">${r.title}</span>
          <div class="prog-badges">
            ${r.year ? `<span class="prog-badge badge-type">${r.year}</span>` : ''}
            <span class="prog-badge ${r.level === 'transmission' ? 'badge-transmission' : r.level === 'distribution' ? 'badge-distribution' : 'badge-both'}">${r.level === 'both' ? 'T+D' : r.level === 'transmission' ? 'Transmission' : 'Distribution'}</span>
          </div>
        </div>
        <div class="prog-body">
          <div class="prog-desc">${r.description}</div>
        </div>
      </div>`;
    }).join('')}`;
}

function toggleSection(key) {
  if (openSections.has(key)) openSections.delete(key);
  else openSections.add(key);
  renderDetail();
}

// ── FAQ ──

function toggleFAQ() { faqOpen = !faqOpen; renderDetail(); }

function renderFAQ() {
  if (!currentCountry) return '';
  return currentCountry.faq.map(f =>
    `<div class="faq-item"><div class="faq-q">${f.q}</div><div class="faq-a">${f.a}</div></div>`
  ).join('');
}

// ── Strategy Note ──

function toggleNote() { noteOpen = !noteOpen; renderDetail(); }

function renderNote() {
  if (!currentCountry) return '';
  return `<div class="note-box">${currentCountry.note}</div>
    <div class="md-section">
      <button class="copy-btn" onclick="copyMarkdown(event)">Copy Markdown</button>
      <div class="md-output" id="mdOutput">${buildMarkdown()}</div>
    </div>`;
}

// ── Markdown Export ──

function buildMarkdown() {
  const c = currentCountry;
  if (!c) return '';
  let md = `# ${c.full}\n\n${c.desc}\n\n`;

  ['transmission', 'distribution'].forEach(level => {
    const p = c[level];
    md += `## ${level === 'transmission' ? '⚡' : '🔌'} ${p.title}\n\n`;
    md += `${p.overview}\n\n`;
    md += `| Field | Value |\n|---|---|\n`;
    md += `| Voltage | ${p.voltageLevel} |\n`;
    md += `| Timeline | ${p.typicalTimeline} |\n`;
    md += `| Cost | ${p.costRange} |\n`;
    if (p.queueSize) md += `| Queue | ${p.queueSize} |\n`;
    md += `\n### Key Bodies\n`;
    p.keyBodies.forEach(b => { md += `- **${b.name}**${b.fullName ? ` (${b.fullName})` : ''}: ${b.role}\n`; });
    md += `\n### Process Steps\n`;
    p.steps.forEach((s, i) => {
      md += `${i + 1}. **${s.name}** — ${s.detail}`;
      if (s.timeline) md += ` _(${s.timeline})_`;
      md += `\n`;
    });
    if (p.challenges) md += `\n### Challenges\n${p.challenges}\n`;
    md += `\n`;
  });

  if (c.reforms && c.reforms.length) {
    md += `## Recent Reforms\n`;
    c.reforms.forEach(r => {
      md += `### ${r.title}${r.year ? ` (${r.year})` : ''}\n`;
      md += `${r.description.replace(/<[^>]*>/g, '')}\n\n`;
    });
  }

  md += `## Strategy Note\n${c.note}\n`;
  return md;
}

function copyMarkdown(e) {
  const text = document.getElementById('mdOutput').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = e.target;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy Markdown'; btn.classList.remove('copied'); }, 2000);
  });
}

function buildFullMarkdown() {
  const strip = html => (html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  let md = `# Grid Interconnection Process — Global Comparison\n\n`;
  md += `> ${DATA.length} countries | Transmission & Distribution processes compared\n\n---\n\n`;

  DATA.forEach(c => {
    md += `## ${c.icon} ${c.full}\n\n`;
    md += `${c.desc}\n\n`;

    ['transmission', 'distribution'].forEach(level => {
      const p = c[level];
      md += `### ${level === 'transmission' ? '⚡' : '🔌'} ${p.title}\n\n`;
      md += `${strip(p.overview)}\n\n`;
      md += `| Field | Value |\n|---|---|\n`;
      md += `| Voltage | ${p.voltageLevel} |\n`;
      md += `| Timeline | ${p.typicalTimeline} |\n`;
      md += `| Cost | ${p.costRange} |\n`;
      if (p.queueSize) md += `| Queue | ${p.queueSize} |\n`;
      md += `\n**Key Bodies:** ${p.keyBodies.map(b => `${b.name}`).join(', ')}\n\n`;
      md += `**Process Steps:**\n`;
      p.steps.forEach((s, i) => {
        md += `${i + 1}. **${s.name}** — ${strip(s.detail)}`;
        if (s.timeline) md += ` _(${s.timeline})_`;
        md += `\n`;
      });
      if (p.challenges) md += `\n**Challenges:** ${strip(p.challenges)}\n`;
      md += `\n`;
    });

    if (c.reforms && c.reforms.length) {
      md += `### Recent Reforms\n`;
      c.reforms.forEach(r => { md += `- **${r.title}** (${r.year || ''}): ${strip(r.description)}\n`; });
      md += `\n`;
    }

    if (c.note) md += `### Strategy Note\n${c.note}\n\n`;
    md += `---\n\n`;
  });

  return md;
}

function copyAllMarkdown(e) {
  const md = buildFullMarkdown();
  navigator.clipboard.writeText(md).then(() => {
    const btn = e.target;
    btn.textContent = `Copied! (${Math.round(md.length / 1000)}K chars)`;
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy All as Markdown'; btn.classList.remove('copied'); }, 3000);
  });
}

// ── Init ──

document.addEventListener('DOMContentLoaded', loadData);
