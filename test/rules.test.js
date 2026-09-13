import { analyse } from '../src/analyse.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// These assertions exist because each one caught a real defect during the build.
// Citation accuracy is the product, so a test that only counted findings would
// have passed while every finding pointed at the wrong clause.

const sample = readFileSync(fileURLToPath(new URL('../sample/saas-agreement.txt', import.meta.url)), 'utf8');
const r = analyse(sample);

let failed = 0;
function check(name, condition, detail) {
  if (condition) {
    console.log('  pass  ' + name);
  } else {
    console.log('  FAIL  ' + name + (detail ? '  (' + detail + ')' : ''));
    failed++;
  }
}

const find = id => r.findings.find(f => f.ruleId === id);

console.log('segmentation');
check('splits long numbered clauses', r.clauses.length >= 35, r.clauses.length + ' clauses');
check('7.1 and 7.2 are separate clauses',
  find('liability_cap')?.clauseNumber === '7.1' && find('unlimited_liability')?.clauseNumber === '7.2',
  `cap=${find('liability_cap')?.clauseNumber} uncapped=${find('unlimited_liability')?.clauseNumber}`);

console.log('citation accuracy');
check('auto-renewal cites 2.2 not 2.1', find('auto_renewal')?.clauseNumber === '2.2',
  find('auto_renewal')?.clauseNumber);
check('governing law cites the operative clause, not the heading',
  find('governing_law')?.clauseNumber === '14.1', find('governing_law')?.clauseNumber);
check('every finding carries a source quote', r.findings.every(f => f.quote && f.quote.length > 5));
check('every finding carries an explanation', r.findings.every(f => f.explanation && f.explanation.length > 20));

console.log('detection');
for (const id of ['auto_renewal', 'unlimited_liability', 'unilateral_amendment', 'non_compete',
                  'price_increase', 'late_interest', 'indemnity', 'warranty_disclaimer']) {
  check('detects ' + id, Boolean(find(id)));
}
check('finds the one-sided price increase', r.findings.some(f => f.ruleId === 'asym_price_increase'));
check('asymmetry findings cite a clause number',
  r.findings.filter(f => f.ruleId.startsWith('asym_')).every(f => f.clauseNumber));

console.log('safety property');
const inDoc = f => sample.replace(/\s+/g, ' ').includes(f.matchText.replace(/\s+/g, ' '));
check('every matched span exists verbatim in the source document', r.findings.every(inDoc),
  r.findings.filter(f => !inDoc(f)).map(f => f.ruleId).join(', '));

console.log('');
console.log(failed ? `${failed} failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
