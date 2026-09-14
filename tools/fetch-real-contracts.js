import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Anchor was only ever tested against a contract written for the purpose, which
// proves the rules match text written to be matched. These are real agreements
// filed with the SEC as exhibits, drafted by lawyers who had never heard of it.

const UA = 'ramsaikandagatla@gmail.com Anchor contract evaluation';
const SEARCH = 'https://efts.sec.gov/LATEST/search-index';
const ARCHIVE = 'https://www.sec.gov/Archives/edgar/data';

const QUERIES = [
  '"master services agreement"',
  '"master subscription agreement"',
  '"software license agreement"',
  '"consulting agreement"',
  '"this agreement shall automatically renew"'
];

const wait = ms => new Promise(r => setTimeout(r, ms));

async function search(q) {
  // The forms filter takes root forms (8-K, 10-K), not exhibit types, so
  // forms=EX-10.1 silently returns nothing. Exhibits are filtered afterwards
  // on file_type instead.
  const url = `${SEARCH}?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return [];
  const body = await res.json();
  return (body.hits?.hits || [])
    .map(h => ({
      id: h._id,
      who: (h._source.display_names || [])[0] || 'unknown',
      date: h._source.file_date,
      type: h._source.file_type || ''
    }))
    .filter(h => /^EX-10/i.test(h.type));
}

// An _id looks like "0001683168-25-001184:edgemode_ex1001.htm". The accession
// number without dashes is the folder, the CIK comes from the filing index.
function documentUrl(id, cik) {
  const [accession, file] = id.split(':');
  return `${ARCHIVE}/${cik}/${accession.replace(/-/g, '')}/${file}`;
}

function cikFrom(display) {
  const m = display.match(/CIK\s+(\d+)/i);
  return m ? String(Number(m[1])) : null;
}

// Filed exhibits are HTML. Tags are stripped rather than parsed because the
// only thing needed is the text a reader would see.
function toText(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|tr|h\d|li|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const out = join(dirname(dirname(fileURLToPath(import.meta.url))), 'corpus');
mkdirSync(out, { recursive: true });

const seen = new Set();
const manifest = [];
const TARGET = Number(process.argv[2] || 20);

for (const q of QUERIES) {
  if (manifest.length >= TARGET) break;
  const hits = await search(q);
  await wait(400);

  for (const hit of hits) {
    if (manifest.length >= TARGET) break;
    if (seen.has(hit.id)) continue;
    seen.add(hit.id);

    const cik = cikFrom(hit.who);
    if (!cik) continue;

    const url = documentUrl(hit.id, cik);
    let html;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) { await wait(300); continue; }
      html = await res.text();
    } catch { await wait(300); continue; }

    const text = toText(html);
    // Anything under a few thousand characters is a cover page or an amendment
    // stub, not an agreement with terms in it.
    if (text.length < 6000) { await wait(300); continue; }

    const name = `${manifest.length + 1}`.padStart(2, '0') + '_' +
      hit.who.replace(/[^\w]+/g, '-').slice(0, 40).toLowerCase() + '.txt';
    writeFileSync(join(out, name), text, 'utf8');
    manifest.push({ file: name, company: hit.who, filed: hit.date, chars: text.length, url });
    console.log(`${manifest.length}. ${name}  ${(text.length / 1000).toFixed(0)}k chars`);
    await wait(400);
  }
}

writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 1), 'utf8');
console.log(`\n${manifest.length} real agreements saved to corpus/`);
