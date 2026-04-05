/* Grid Interconnection Funding Landscape — app.js
   Loads country data from data/*.json, renders cards + detail panel. */

const DATA_FILES = [
  'data/uk.json',
  'data/usa.json',
  'data/germany.json',
  'data/netherlands.json',
  'data/spain.json',
  'data/france.json',
  'data/india.json',
  'data/australia.json',
  'data/south-africa.json',
  'data/kenya.json',
  'data/nigeria.json'
];

let DATA = [];
let currentCountry = null;
let selectedStudy = null;
let currentRegionFilter = 'all';

// ── Data Loading ──

async function loadData() {
  const responses = await Promise.all(DATA_FILES.map(f => fetch(f).then(r => r.json())));
  DATA = responses;
  renderCards();
}

// ── Card Rendering ──

function renderCards() {
  const grid = document.getElementById('cardsGrid');
  grid.innerHTML = '';

  DATA.forEach(country => {
    if (currentRegionFilter === 'all' || country.tags.includes(currentRegionFilter)) {
      const card = document.createElement('div');
      card.className = 'country-card';
      card.style.borderLeftColor = country.accentColor;

      const badgeHtml = `<span class='card-badge' style='background:${country.badgeColor};color:${country.badgeText}'>${country.badge}</span>` +
                        (country.badge2 ? `<span class='card-badge' style='background:${country.badgeColor};color:${country.badgeText}'>${country.badge2}</span>` : '');

      card.onclick = function() { openPanel(country.id); };
      card.innerHTML = `
        <div class='card-header' style='background:${country.accentBg}'>
          <div class='card-icon'>${country.icon}</div>
          <div class='card-titles'>
            <div class='card-name'>${country.name}</div>
            <div class='card-type'>${country.type}</div>
            <div class='card-badges'>${badgeHtml}</div>
          </div>
        </div>
        <div class='card-body'>
          <div class='card-tags'>${country.cardTags.map(t => `<span class='card-tag'>${t}</span>`).join('')}</div>
          <div class='card-desc'>${country.sub}</div>
        </div>
        <div class='card-footer'>
          <span class='card-detail-btn'>View Details &rarr;</span>
          <span class='card-count'>${country.studies.length} programmes</span>
        </div>
      `;
      grid.appendChild(card);
    }
  });
}

// ── Filters ──

function filterRegion(region, btn) {
  currentRegionFilter = region;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCards();
}

// ── Detail Panel ──

function openPanel(countryId) {
  currentCountry = DATA.find(c => c.id === countryId);
  selectedStudy = null;

  document.getElementById('panelIcon').textContent = currentCountry.icon;
  document.getElementById('panelTitle').textContent = currentCountry.name;
  document.getElementById('panelSubtitle').textContent = currentCountry.full;

  renderStudies();

  // Reset tabs to Programmes
  document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(t => t.classList.remove('active'));
  document.querySelector('.panel-tab').classList.add('active');
  document.getElementById('tab-programmes').classList.add('active');

  document.getElementById('detailPanel').classList.add('open');
  document.getElementById('detailPanel').scrollIntoView({behavior:'smooth', block:'start'});
}

function closePanel() {
  document.getElementById('detailPanel').classList.remove('open');
  currentCountry = null;
  selectedStudy = null;
}

// ── Studies (Programmes) ──

function renderStudies() {
  const list = document.getElementById('studiesList');
  list.innerHTML = '';

  currentCountry.studies.forEach((study, idx) => {
    const item = document.createElement('div');
    item.className = 'study-item';
    item.innerHTML = `
      <div class='study-label'>${study.label}</div>
      <div class='study-hint'>${study.hint}</div>
      ${selectedStudy === idx ? `<div class='study-detail'><div class='study-detail-text'>${study.text}</div></div>` : ''}
    `;
    item.onclick = (e) => { if (!e.target.closest('.link-box')) toggleStudy(idx); };
    list.appendChild(item);
  });
}

function toggleStudy(idx) {
  selectedStudy = selectedStudy === idx ? null : idx;
  renderStudies();
}

// ── Tab Switching ──

function switchTab(tabName, tabEl) {
  document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(t => t.classList.remove('active'));

  if (tabEl) tabEl.classList.add('active');
  else document.querySelector(`.panel-tab[onclick*="${tabName}"]`).classList.add('active');
  document.getElementById('tab-' + tabName).classList.add('active');

  if (tabName === 'programmes') renderStudies();
  else if (tabName === 'pathway') renderWorkflow();
  else if (tabName === 'faq') renderFAQ();
  else if (tabName === 'note') renderNote();
}

// ── Workflow ──

function renderWorkflow() {
  const content = document.getElementById('workflowContent');
  content.innerHTML = currentCountry.workflow.map(step => `
    <div class='workflow-step'>
      <div class='step-title'>${step.step}</div>
      <div class='step-detail'>${step.detail}</div>
      <span class='step-tag' style='background:${step.tagColor}'>${step.tag}</span>
    </div>
  `).join('');
}

// ── FAQ ──

function renderFAQ() {
  const content = document.getElementById('faqContent');
  content.innerHTML = currentCountry.faq.map(item => `
    <div class='faq-item'>
      <div class='faq-q'>${item.q}</div>
      <div class='faq-a'>${item.a}</div>
    </div>
  `).join('');
}

// ── Strategy Note + Markdown Export ──

function renderNote() {
  const content = document.getElementById('noteContent');
  content.innerHTML = `<div class='note-box'>${currentCountry.note}</div>`;

  content.innerHTML += `
    <div class='markdown-section'>
      <button class='copy-btn' onclick='copyMarkdown()'>Copy Markdown</button>
      <div class='markdown-output' id='markdownOutput'></div>
    </div>
  `;

  renderMarkdown();
}

function renderMarkdown() {
  let md = `# ${currentCountry.full}\n\n`;
  md += `**Type:** ${currentCountry.type}\n`;
  md += `**Vendor:** ${currentCountry.vendor}\n\n`;
  md += `## Overview\n${currentCountry.desc}\n\n`;

  md += `## Programmes\n`;
  currentCountry.studies.forEach(study => {
    md += `\n### ${study.label}\n`;
    md += `_${study.hint}_\n\n`;
    md += `${study.text.replace(/<[^>]*>/g, '').substring(0, 200)}...\n`;
  });

  md += `\n## Application Workflow\n`;
  currentCountry.workflow.forEach((step, idx) => {
    md += `${idx + 1}. **${step.step}** (${step.tag})\n   ${step.detail}\n\n`;
  });

  md += `\n## Strategy Note\n${currentCountry.note}\n`;

  document.getElementById('markdownOutput').textContent = md;
}

function copyMarkdown() {
  const text = document.getElementById('markdownOutput').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = event.target;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copy Markdown';
      btn.classList.remove('copied');
    }, 2000);
  });
}

// ── Init ──

document.addEventListener('DOMContentLoaded', loadData);
