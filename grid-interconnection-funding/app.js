/* Grid Interconnection Funding Landscape — app.js */

let DATA = [];
let currentCountry = null;
let openProgrammes = new Set();
let faqOpen = false;
let noteOpen = false;
let currentRegionFilter = 'all';

// ── Data Loading ──

async function loadData() {
  try {
    if (Array.isArray(window.GRID_DATA) && window.GRID_DATA.length) {
      DATA = window.GRID_DATA;
    } else {
      const manifest = await fetch('data/manifest.json').then(r => {
        if (!r.ok) throw new Error(`Manifest load failed: ${r.status}`);
        return r.json();
      });

      DATA = await Promise.all((manifest.files || []).map(async file => {
        const response = await fetch(`data/${file}`);
        if (!response.ok) throw new Error(`Data load failed for ${file}: ${response.status}`);
        return response.json();
      }));
    }

    updateHeroStats();
    renderCards();
  } catch (error) {
    console.error(error);
    renderLoadError(error);
  }
}

function updateHeroStats() {
  const countriesEl = document.getElementById('heroCountries');
  const programmesEl = document.getElementById('heroProgrammes');
  if (countriesEl) countriesEl.textContent = `${DATA.length} Countries`;
  if (programmesEl) programmesEl.textContent = `${DATA.reduce((sum, country) => sum + country.studies.length, 0)} Programmes`;
}

function renderLoadError(error) {
  const grid = document.getElementById('cardsGrid');
  grid.innerHTML = `
    <div class="load-error">
      <div class="load-error-title">Funding data failed to load</div>
      <div class="load-error-body">${error.message}</div>
    </div>`;
}

// ── Cards ──

function renderCards() {
  const grid = document.getElementById('cardsGrid');
  grid.innerHTML = '';
  DATA.forEach(c => {
    if (currentRegionFilter !== 'all' && !c.tags.includes(currentRegionFilter)) return;
    const card = document.createElement('div');
    card.className = 'country-card';
    card.style.borderLeftColor = c.accentColor;
    card.onclick = () => openDetail(c.id);
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
        <span class='card-count'>${c.studies.length} programmes</span>
      </div>`;
    grid.appendChild(card);
  });
}

function filterRegion(region, btn) {
  currentRegionFilter = region;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCards();
  closeDetail();
}

// ── Inline Detail ──

function openDetail(countryId) {
  currentCountry = DATA.find(c => c.id === countryId);
  openProgrammes = new Set();
  faqOpen = false;
  noteOpen = false;
  renderDetail();
  const section = document.getElementById('detailSection');
  section.style.display = 'block';
  setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

function closeDetail() {
  document.getElementById('detailSection').style.display = 'none';
  currentCountry = null;
}

function renderDetail() {
  if (!currentCountry) return;
  const c = currentCountry;
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
    <div class="section-heading">Programmes &amp; Innovation Routes</div>
    ${c.studies.map((s, i) => renderProgrammeNode(s, i)).join('')}
    ${c.dsoPartners && c.dsoPartners.length ? renderDSOSection(c) : ''}
    <div class="collapsible-header ${faqOpen ? 'open' : ''}" onclick="toggleFAQ()">
      <span class="collapsible-arrow">&#9654;</span>
      <span class="collapsible-title">Frequently Asked Questions (${c.faq.length})</span>
    </div>
    <div class="collapsible-body">${renderFAQ()}</div>
    <div class="collapsible-header ${noteOpen ? 'open' : ''}" onclick="toggleNote()">
      <span class="collapsible-arrow">&#9654;</span>
      <span class="collapsible-title">Strategy Note</span>
    </div>
    <div class="collapsible-body">${renderNote()}</div>`;
}

// ── Programme Nodes ──

function renderProgrammeNode(s, idx) {
  const isOpen = openProgrammes.has(idx);
  const el = s.eligibility || {};
  const rl = s.relevance || {};
  const elStatus = el.status || 'unknown';
  const rlLevel = rl.level || 'unknown';

  const elBadgeClass = elStatus === 'eligible' ? 'badge-eligible' : elStatus === 'partial' ? 'badge-partial' : 'badge-ineligible';
  const elLabel = elStatus === 'eligible' ? 'Eligible' : elStatus === 'partial' ? 'Conditional' : 'Not Eligible';
  const elIcon = elStatus === 'eligible' ? '\u2713' : elStatus === 'partial' ? '\u25D0' : '\u2717';

  const rlBadgeClass = rlLevel === 'high' ? 'badge-high' : rlLevel === 'medium' ? 'badge-medium' : 'badge-low';
  const rlLabel = rlLevel.charAt(0).toUpperCase() + rlLevel.slice(1);

  let body = '';
  if (isOpen) {
    const budgetEstHtml = s.budgetIsEstimate
      ? `<div class="estimate-tag">Estimated</div><div class="meta-explain">${s.budgetBasis || ''}</div>`
      : `<div class="confirmed-tag">Confirmed</div>`;

    body = `<div class="prog-body">
      <div class="prog-top-bar">
        ${s.programmeType ? `<span class="prog-type-badge">${s.programmeType}</span>` : ''}
        ${s.deadline ? `<span class="prog-deadline">${s.deadline}</span>` : ''}
      </div>
      <div class="prog-meta">
        <div class="meta-card">
          <div class="meta-label">Eligibility</div>
          <div class="meta-status ${elStatus}">${elIcon} ${elLabel}</div>
          <div class="meta-explain">${el.text || ''}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Relevance</div>
          <div class="meta-status ${rlLevel}">${rlLabel}</div>
          <div class="meta-explain">${rl.text || ''}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Budget</div>
          <div class="budget-value">${s.budget || 'N/A'}</div>
          ${budgetEstHtml}
        </div>
      </div>
      <div class="prog-desc">${s.text}</div>
      ${renderAppRoute(s)}
    </div>`;
  }

  return `<div class="programme-node ${isOpen ? 'open' : ''}" data-idx="${idx}">
    <div class="prog-header" onclick="toggleProgramme(${idx})">
      <span class="prog-arrow">&#9654;</span>
      <span class="prog-name">${s.label}</span>
      <div class="prog-badges">
        <span class="prog-badge ${elBadgeClass}">${elIcon} ${elLabel}</span>
        <span class="prog-badge ${rlBadgeClass}">${rlLabel}</span>
        ${s.programmeType ? `<span class="prog-badge badge-type">${s.programmeType}</span>` : ''}
      </div>
    </div>
    ${body}
  </div>`;
}

function renderAppRoute(s) {
  const route = s.applicationRoute;
  if (!route || !route.length) return '';
  return `<div class="app-route">
    <div class="app-route-title">Application Route &mdash; ${s.label}</div>
    ${route.map((r, i) => `<div class="route-step">
      <div class="route-num">${i + 1}</div>
      <div class="route-text">
        <div class="route-step-title">${r.step}</div>
        <div class="route-step-detail">${r.detail}</div>
      </div>
    </div>`).join('')}
  </div>`;
}

function toggleProgramme(idx) {
  if (openProgrammes.has(idx)) openProgrammes.delete(idx);
  else openProgrammes.add(idx);
  renderDetail();
}

// ── DSO Partners ──

function renderDSOSection(c) {
  const localTerm = c.dsoTerm || 'Distribution Network Operator';
  return `
    <div class="section-heading">Distribution Partners <span class="dso-term-label">(${localTerm}s)</span></div>
    <div class="dso-grid">
      ${c.dsoPartners.map(d => `
        <div class="dso-card">
          <div class="dso-card-header">
            <div class="dso-name">${d.name}</div>
            ${d.parent ? `<div class="dso-parent">${d.parent}</div>` : ''}
          </div>
          <div class="dso-meta">
            <span class="dso-customers">${d.customers}</span>
            ${d.region ? `<span class="dso-region">${d.region}</span>` : ''}
          </div>
          <div class="dso-engagement">${d.engagement}</div>
          ${d.innovationUrl ? `<a class="dso-link" href="${d.innovationUrl}" target="_blank">Innovation Portal &rarr;</a>` : ''}
        </div>
      `).join('')}
    </div>`;
}

// ── FAQ ──

function toggleFAQ() {
  faqOpen = !faqOpen;
  renderDetail();
}

function renderFAQ() {
  if (!faqOpen || !currentCountry) return '';
  return currentCountry.faq.map(f =>
    `<div class="faq-item"><div class="faq-q">${f.q}</div><div class="faq-a">${f.a}</div></div>`
  ).join('');
}

// ── Strategy Note ──

function toggleNote() {
  noteOpen = !noteOpen;
  renderDetail();
}

function renderNote() {
  if (!noteOpen || !currentCountry) return '';
  const c = currentCountry;
  return `<div class="note-box">${c.note}</div>
    <div class="md-section">
      <button class="copy-btn" onclick="copyMarkdown(event)">Copy Markdown</button>
      <div class="md-output" id="mdOutput">${buildMarkdown()}</div>
    </div>`;
}

function buildMarkdown() {
  const c = currentCountry;
  let md = `# ${c.full}\n\n**Type:** ${c.type}\n**Organisations:** ${c.vendor}\n\n## Overview\n${c.desc}\n\n## Programmes\n`;
  c.studies.forEach(s => {
    md += `\n### ${s.label}\n_${s.hint}_\n`;
    md += `- **Budget:** ${s.budget || 'N/A'}\n`;
    md += `- **Eligibility:** ${(s.eligibility||{}).status||'?'} — ${(s.eligibility||{}).text||''}\n`;
    md += `- **Relevance:** ${(s.relevance||{}).level||'?'} — ${(s.relevance||{}).text||''}\n\n`;
    md += `${s.text.replace(/<[^>]*>/g, '').substring(0, 200)}...\n`;
    if (s.applicationRoute && s.applicationRoute.length) {
      md += `\n**Application Route:**\n`;
      s.applicationRoute.forEach((r, i) => { md += `${i+1}. **${r.step}** — ${r.detail}\n`; });
    }
  });
  md += `\n## Strategy Note\n${c.note}\n`;
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

// ── Global Markdown Export ──

function buildFullMarkdown() {
  const strip = html => (html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  let md = `# AI Grid Interconnection Funding Landscape 2026\n\n`;
  md += `> ${DATA.length} countries | ${DATA.reduce((a, c) => a + c.studies.length, 0)} programmes | Compiled for Grid Agents — AI-powered grid connection application review, validation, and prioritisation.\n\n`;
  md += `---\n\n`;

  DATA.forEach(c => {
    md += `## ${c.icon} ${c.full}\n\n`;
    md += `**Type:** ${c.type} | **Organisations:** ${c.vendor}\n\n`;
    md += `${c.desc}\n\n`;

    // Programmes
    c.studies.forEach(s => {
      const el = s.eligibility || {};
      const rl = s.relevance || {};
      const elStatus = el.status === 'eligible' ? '✓ Eligible' : el.status === 'partial' ? '◐ Conditional' : '✗ Not Eligible';
      const rlLevel = (rl.level || 'unknown').charAt(0).toUpperCase() + (rl.level || 'unknown').slice(1);

      md += `### ${s.label}\n`;
      md += `_${s.hint}_\n\n`;
      md += `| Field | Value |\n|---|---|\n`;
      md += `| Budget | ${s.budget || 'N/A'}${s.budgetIsEstimate ? ' (estimated)' : ''} |\n`;
      md += `| Type | ${s.programmeType || 'N/A'} |\n`;
      md += `| Grid Level | ${s.gridLevel || 'N/A'} |\n`;
      md += `| Eligibility | ${elStatus} |\n`;
      md += `| Relevance | ${rlLevel} |\n`;
      if (s.deadline) md += `| Deadline | ${s.deadline} |\n`;
      md += `\n`;

      md += `**Eligibility detail:** ${el.text || 'N/A'}\n\n`;
      md += `**Relevance detail:** ${rl.text || 'N/A'}\n\n`;

      const desc = strip(s.text);
      if (desc) md += `${desc}\n\n`;

      if (s.applicationRoute && s.applicationRoute.length) {
        md += `**Application Route:**\n`;
        s.applicationRoute.forEach((r, i) => {
          md += `${i + 1}. **${r.step}** — ${r.detail}\n`;
        });
        md += `\n`;
      }
    });

    // DSO Partners
    const dso = c.dsoPartners || [];
    if (dso.length) {
      const term = c.dsoTerm || 'Distribution Network Operator';
      md += `### Distribution Partners (${term}s)\n\n`;
      md += `| Entity | Parent | Customers | Region | Engagement |\n`;
      md += `|---|---|---|---|---|\n`;
      dso.forEach(d => {
        md += `| ${d.name} | ${d.parent || '—'} | ${d.customers} | ${d.region || '—'} | ${d.engagement.substring(0, 120)}${d.engagement.length > 120 ? '...' : ''} |\n`;
      });
      md += `\n`;
    }

    // FAQ
    if (c.faq && c.faq.length) {
      md += `### FAQ\n\n`;
      c.faq.forEach(f => {
        md += `**Q: ${f.q}**\n${f.a}\n\n`;
      });
    }

    // Strategy Note
    if (c.note) {
      md += `### Strategy Note\n${c.note}\n\n`;
    }

    md += `---\n\n`;
  });

  return md;
}

function copyAllMarkdown(e) {
  const md = buildFullMarkdown();
  navigator.clipboard.writeText(md).then(() => {
    const btn = e.target;
    const chars = md.length;
    btn.textContent = `Copied! (${Math.round(chars / 1000)}K chars)`;
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy All as Markdown'; btn.classList.remove('copied'); }, 3000);
  });
}

// ── Init ──

document.addEventListener('DOMContentLoaded', loadData);
