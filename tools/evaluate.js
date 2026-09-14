import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { analyse } from '../src/analyse.js';

// The question this answers is not "does Anchor find things" but "does it find
// things in contracts nobody wrote for it". Recall is measured against a plain
// keyword search of the same document: if the phrase is in there and Anchor
// did not report it, that is a miss, and misses are the number that matters.

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const corpus = join(root, 'corpus');

// Each probe is a term a contract lawyer would expect a reviewer to surface,
// paired with the wording it actually appears as. Deliberately broader than
// Anchor's own patterns, so the comparison is not graded on its own curve.
const PROBES = [
  { rule: 'auto_renewal',            name: 'Automatic renewal',   re: /automatic(ally)?\s+renew|auto-?renew|successive\s+(?:one|1|two|renewal)[\s-]*(?:year|month)|evergreen/i },
  { rule: 'notice_period',           name: 'Notice period',       re: /\b(?:\d{1,3}|thirty|sixty|ninety)\s*[-\s]?(?:days?|months?)['’]?\s*(?:prior\s+)?(?:written\s+)?notice|notice\s+of\s+(?:at\s+least\s+)?\d{1,3}\s+days/i },
  { rule: 'termination_convenience', name: 'Termination for convenience', re: /terminate[^.]{0,60}(?:for\s+convenience|without\s+cause|for\s+any\s+reason\s+or\s+no\s+reason)/i },
  { rule: 'termination_cause',       name: 'Termination for cause', re: /terminate[^.]{0,80}(?:material\s+breach|for\s+cause|default)/i },
  { rule: 'liability_cap',           name: 'Liability cap',       re: /liability[^.]{0,120}(?:shall\s+not\s+exceed|limited\s+to|capped\s+at)|aggregate\s+liability/i },
  { rule: 'indemnity',               name: 'Indemnity',           re: /indemnif(?:y|ies|ication)|hold\s+harmless/i },
  { rule: 'governing_law',           name: 'Governing law',       re: /governed\s+by[^.]{0,80}laws?\s+of\s+(?:the\s+)?[A-Z]/i },
  { rule: 'confidentiality',         name: 'Confidentiality',     re: /confidential\s+information|confidentiality\s+obligations?/i },
  { rule: 'assignment',              name: 'Assignment restriction', re: /(?:shall\s+not|may\s+not)\s+assign|no(?:t|n)[\s-]assignab/i },
  { rule: 'force_majeure',           name: 'Force majeure',       re: /force\s+majeure|acts?\s+of\s+God/i },
  { rule: 'warranty_disclaimer',     name: 'Warranty disclaimer', re: /disclaims?\s+all\s+warrant|as\s+is[^.]{0,40}without\s+warrant|no\s+warrant(?:ies|y)\s+of\s+any\s+kind/i },
  { rule: 'payment_terms',           name: 'Payment terms',       re: /\bnet\s+\d{1,3}\b|payable\s+within\s+\d{1,3}\s+days|within\s+\d{1,3}\s+days\s+(?:of|after)[^.]{0,30}invoice/i },
  { rule: 'late_interest',           name: 'Late payment interest', re: /(?:interest|late\s+(?:fee|charge))[^.]{0,60}\d{1,2}(?:\.\d+)?\s*%|\d{1,2}(?:\.\d+)?\s*%\s+per\s+(?:month|annum)[^.]{0,40}(?:overdue|unpaid|late)/i },
  { rule: 'non_solicit',             name: 'Non-solicitation',    re: /non-?solicit|shall\s+not[^.]{0,60}solicit\s+(?:any\s+)?(?:employee|customer)/i },
  { rule: 'ip_assignment',           name: 'IP ownership',        re: /intellectual\s+property[^.]{0,80}(?:vest|owned\s+by|assign)|hereby\s+assigns[^.]{0,60}intellectual\s+property/i }
];

function load() {
  const files = readdirSync(corpus).filter(f => f.endsWith('.txt'));
  const seen = new Map();
  for (const f of files) {
    const text = readFileSync(join(corpus, f), 'utf8');
    const hash = createHash('sha1').update(text).digest('hex');
    // The same agreement is filed by several parties; counting it twice would
    // weight one drafting style far above the rest.
    if (!seen.has(hash)) seen.set(hash, { file: f, text });
  }
  return [...seen.values()];
}

const docs = load();
console.log(`${docs.length} unique contracts (from ${readdirSync(corpus).filter(f => f.endsWith('.txt')).length} downloaded)\n`);

const tally = new Map(PROBES.map(p => [p.rule, { name: p.name, present: 0, found: 0 }]));
let totalFindings = 0;
let citationChecked = 0;
let citationWrong = 0;
const perDoc = [];

for (const doc of docs) {
  const result = analyse(doc.text);
  totalFindings += result.findings.length;

  const rulesFound = new Set(result.findings.map(f => f.ruleId));
  const hits = [];
  const misses = [];

  for (const probe of PROBES) {
    const present = probe.re.test(doc.text);
    if (!present) continue;
    const row = tally.get(probe.rule);
    row.present++;
    if (rulesFound.has(probe.rule)) { row.found++; hits.push(probe.name); }
    else misses.push(probe.name);
  }

  // Every quote must exist in the clause it claims to come from. This is the
  // safety property, checked against documents Anchor has never seen.
  for (const f of result.findings) {
    const clause = result.clauses.find(c => c.id === f.clauseId);
    if (!clause) { citationWrong++; continue; }
    citationChecked++;
    const needle = f.matchText.replace(/\s+/g, ' ').slice(0, 40).toLowerCase();
    if (!clause.text.replace(/\s+/g, ' ').toLowerCase().includes(needle)) citationWrong++;
  }

  perDoc.push({
    file: doc.file,
    chars: doc.text.length,
    clauses: result.clauses.length,
    findings: result.findings.length,
    caught: hits.length,
    missed: misses.length,
    missedNames: misses
  });
}

console.log('RECALL BY TERM  (of contracts where the term is present)');
console.log('TERM'.padEnd(30), 'PRESENT', 'FOUND', 'RECALL');
const rows = [...tally.values()].sort((a, b) => (b.found / (b.present || 1)) - (a.found / (a.present || 1)));
let present = 0, found = 0;
for (const r of rows) {
  if (!r.present) { console.log(r.name.padEnd(30), '      0', '    -', '     -'); continue; }
  present += r.present; found += r.found;
  const pct = (r.found / r.present * 100);
  console.log(r.name.padEnd(30), String(r.present).padStart(7), String(r.found).padStart(5), (pct.toFixed(0) + '%').padStart(6));
}

console.log('');
console.log('OVERALL');
console.log('  terms present across corpus :', present);
console.log('  terms Anchor reported       :', found);
console.log('  recall                      :', (found / present * 100).toFixed(1) + '%');
console.log('  total findings produced     :', totalFindings);
console.log('  avg findings per contract   :', (totalFindings / docs.length).toFixed(1));
console.log('');
console.log('CITATION INTEGRITY');
console.log('  quotes checked              :', citationChecked);
console.log('  quotes not in cited clause  :', citationWrong);
console.log('  accuracy                    :', ((1 - citationWrong / (citationChecked || 1)) * 100).toFixed(2) + '%');

writeFileSync(join(root, 'corpus', 'evaluation.json'),
  JSON.stringify({ docs: docs.length, recall: found / present, present, found,
                   citationChecked, citationWrong, byTerm: [...tally.values()], perDoc }, null, 1), 'utf8');
console.log('\nwritten to corpus/evaluation.json');
