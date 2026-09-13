import { segment, quoteAround } from './segment.js';
import { RULES, SEVERITY, detectAsymmetry } from './rules.js';

// The whole analysis is: cut the document into citable pieces, then let each rule
// point at pieces it recognises. No step produces text that was not already in
// the document, which is why a finding can always be proved by scrolling to it.

// After the opening paragraph a contract stops using registered names and refers
// to each side by its defined term. Asymmetry has to be counted on the term that
// actually appears in the operative clauses, so the defined terms come first and
// the registered names are only a fallback.
const DEFINED_TERM = /\(\s*(?:the\s+)?["“']([A-Z][\w\s]{2,30})["”']\s*\)/g;

function partyNamesFrom(findings, text) {
  const terms = [];
  for (const m of text.slice(0, 4000).matchAll(DEFINED_TERM)) {
    const term = m[1].trim();
    if (/agreement|services|effective date|term$/i.test(term)) continue;
    if (!terms.includes(term)) terms.push(term);
  }
  if (terms.length >= 2) return terms.slice(0, 2);

  const hit = findings.find(f => f.ruleId === 'parties');
  if (!hit || !hit.groups) return terms;
  return hit.groups
    .filter(Boolean)
    .map(g => g.replace(/\s*\((?:the\s+)?["“']?[\w\s]+["”']?\)\s*$/i, '').trim())
    .filter(n => n.length > 2 && n.length < 90);
}

export function analyse(text) {
  const clauses = segment(text);
  const findings = [];
  const seen = new Set();

  for (const clause of clauses) {
    for (const rule of RULES) {
      for (const pattern of rule.patterns) {
        // Patterns are authored without /g so that each clause yields its
        // clearest single hit rather than a wall of near-duplicates.
        const m = clause.text.match(pattern);
        if (!m) continue;

        const matchText = m[0].replace(/\s+/g, ' ').trim();
        const key = `${rule.id}::${clause.id}::${matchText.slice(0, 60)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        findings.push({
          ruleId: rule.id,
          label: rule.label,
          category: rule.category,
          severity: rule.severity,
          clauseId: clause.id,
          clauseLabel: clause.label,
          clauseNumber: clause.number,
          clauseIndex: clause.index,
          matchText,
          groups: m.slice(1),
          quote: quoteAround(clause.text, m.index, m[0].length),
          explanation: rule.explain(m, clause)
        });
        break;
      }
    }
  }

  findings.push(...detectAsymmetry(findings, partyNamesFrom(findings, text)));

  findings.sort((a, b) => {
    const s = SEVERITY[b.severity] - SEVERITY[a.severity];
    return s !== 0 ? s : (a.clauseIndex ?? 0) - (b.clauseIndex ?? 0);
  });

  const counts = { risk: 0, watch: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;

  return {
    clauses,
    findings,
    counts,
    coverage: {
      clauses: clauses.length,
      clausesWithFindings: new Set(findings.map(f => f.clauseId)).size,
      words: text.trim().split(/\s+/).length
    }
  };
}
