import { analyse } from './analyse.js';

export const $ = sel => document.querySelector(sel);
const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };

const state = { result: null, filter: null, active: null };

// Rendering the document is where the safety claim becomes visible: the clause
// text shown is the text that was submitted, and highlights are placed by
// searching that same text. Nothing is re-written on the way to the screen.
function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function highlight(clauseText, matches) {
  if (!matches.length) return escapeHtml(clauseText);

  const spans = [];
  for (const m of matches) {
    const needle = m.matchText;
    // The stored quote is whitespace-normalised, so locate the match by its
    // first and last few words rather than by an exact string compare.
    const head = needle.slice(0, 24);
    let at = clauseText.indexOf(head);
    if (at === -1) {
      const loose = needle.split(/\s+/).slice(0, 3).join('\\s+');
      const re = new RegExp(loose.replace(/[.*+?^${}()|[\]]/g, '\\$&'), 'i');
      const found = clauseText.match(re);
      if (!found) continue;
      at = found.index;
    }
    spans.push({ start: at, end: Math.min(clauseText.length, at + needle.length), id: m.ruleId });
  }

  spans.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) { last.end = Math.max(last.end, s.end); last.ids.push(s.id); }
    else merged.push({ ...s, ids: [s.id] });
  }

  let out = '';
  let cursor = 0;
  for (const s of merged) {
    out += escapeHtml(clauseText.slice(cursor, s.start));
    out += `<mark data-rules="${s.ids.join(' ')}">${escapeHtml(clauseText.slice(s.start, s.end))}</mark>`;
    cursor = s.end;
  }
  out += escapeHtml(clauseText.slice(cursor));
  return out;
}

function renderDocument() {
  const host = $('#document');
  host.innerHTML = '';
  const byClause = new Map();
  for (const f of state.result.findings) {
    if (!byClause.has(f.clauseId)) byClause.set(f.clauseId, []);
    byClause.get(f.clauseId).push(f);
  }

  for (const clause of state.result.clauses) {
    const node = el('section', 'clause');
    node.id = clause.id;
    const body = el('p', 'clause-body');
    body.innerHTML = highlight(clause.text, byClause.get(clause.id) || []);
    node.appendChild(body);
    host.appendChild(node);
  }
}

function renderFindings() {
  const host = $('#findings-list');
  host.innerHTML = '';

  const list = state.filter
    ? state.result.findings.filter(f => f.severity === state.filter)
    : state.result.findings;

  if (!list.length) {
    const e = el('div', 'empty');
    e.textContent = 'No findings at this level.';
    host.appendChild(e);
    return;
  }

  list.forEach((f, i) => {
    const card = el('button', 'finding');
    card.type = 'button';
    card.dataset.sev = f.severity;
    card.dataset.ruleId = f.ruleId;
    card.dataset.clauseId = f.clauseId;
    // Stagger stays short. Long cascades read as slowness, not polish.
    card.style.animationDelay = `${Math.min(i, 12) * 40}ms`;

    const head = el('div', 'finding-head');
    const label = el('span', 'finding-label');
    label.textContent = f.label;
    const chip = el('span', 'chip');
    chip.dataset.sev = f.severity;
    chip.textContent = f.severity;
    head.append(label, chip);

    const cite = el('div', 'finding-cite');
    // The label carries the opening words of the clause so the list stays
    // scannable, but a citation should read like a citation.
    cite.textContent = f.clauseNumber ? `Clause ${f.clauseNumber}` : f.clauseLabel;

    const quote = el('div', 'finding-quote');
    quote.textContent = f.quote;

    const why = el('div', 'finding-why');
    why.textContent = f.explanation;

    card.append(head, cite, quote, why);
    card.addEventListener('click', () => jumpTo(f, card));
    host.appendChild(card);
  });
}

function jumpTo(finding, card) {
  document.querySelectorAll('.finding[data-active="true"]').forEach(n => (n.dataset.active = 'false'));
  document.querySelectorAll('.clause[data-lit="true"]').forEach(n => (n.dataset.lit = 'false'));
  document.querySelectorAll('mark[data-live="true"]').forEach(n => (n.dataset.live = 'false'));

  card.dataset.active = 'true';
  const clause = document.getElementById(finding.clauseId);
  if (!clause) return;

  clause.dataset.lit = 'true';
  clause.scrollIntoView({ behavior: 'smooth', block: 'center' });

  for (const mark of clause.querySelectorAll('mark')) {
    if (mark.dataset.rules.split(' ').includes(finding.ruleId)) mark.dataset.live = 'true';
  }
  state.active = finding;
}

function renderSummary() {
  const host = $('#summary');
  host.innerHTML = '';
  const order = [['risk', 'Risk'], ['watch', 'Watch'], ['info', 'Info']];

  for (const [sev, name] of order) {
    const b = el('button', 'tally');
    b.type = 'button';
    b.dataset.sev = sev;
    b.setAttribute('aria-pressed', String(state.filter === sev));

    const n = el('span', 'n');
    n.textContent = state.result.counts[sev];
    const k = el('span', 'k');
    k.textContent = name;
    b.append(n, k);

    b.addEventListener('click', () => {
      state.filter = state.filter === sev ? null : sev;
      renderSummary();
      renderFindings();
    });
    host.appendChild(b);
  }
}

export function run(text) {
  state.result = analyse(text);
  state.filter = null;
  $('#intake').hidden = true;
  $('#workspace').hidden = false;
  $('#reset').hidden = false;
  renderSummary();
  renderFindings();
  renderDocument();
  $('#coverage').textContent =
    `${state.result.coverage.clauses} clauses · ${state.result.coverage.words} words · ` +
    `${state.result.findings.length} findings, every one quoted from the text above`;
}

export function reset() {
  state.result = null;
  $('#intake').hidden = false;
  $('#workspace').hidden = true;
  $('#reset').hidden = true;
  $('#paste').value = '';
}
