// Contracts are written as a numbered tree, and every finding has to point back
// to a specific place in that tree. Segmentation happens once, up front, so that
// every extractor can cite a clause instead of a character offset nobody can read.

const HEADING = [
  // 1.  |  1.1  |  1.1.2  |  12.3.4.5
  /^\s*(\d+(?:\.\d+)*)\.?\s+(.{0,120})$/,
  // Section 4 | SECTION 4.2 | Clause 7 | Article IX
  /^\s*(?:section|clause|article)\s+([\dIVXLC]+(?:\.\d+)*)\.?[\s:-]*(.{0,120})$/i,
  // (a) | (iv)
  /^\s*\(([a-z]{1,3}|[ivxlc]{1,6})\)\s+(.{0,120})$/i
];

// Contracts number their clauses and then write the whole paragraph on the same
// line, so length cannot be used to reject a heading. A line that opens with a
// clause number IS a clause start no matter how long it runs; the title is just
// the opening words of it.
const MAX_HEADING_LEN = 140;
const NUMBERED = /^\s*(\d+(?:\.\d+)*)\.?\s+(\S.*)$/;
const TITLE_CHARS = 70;

function headingOf(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const numbered = trimmed.match(NUMBERED);
  if (numbered) {
    const rest = numbered[2];
    const title = rest.length > TITLE_CHARS
      ? rest.slice(0, TITLE_CHARS).replace(/\s+\S*$/, '') + '…'
      : rest;
    return { number: numbered[1], title: title.trim() };
  }

  if (trimmed.length > MAX_HEADING_LEN) return null;
  for (const re of HEADING) {
    const m = trimmed.match(re);
    if (m) return { number: m[1], title: (m[2] || '').trim() };
  }
  // ALL CAPS lines are headings in most contract drafting styles.
  if (/^[A-Z][A-Z\s&,'()-]{4,}$/.test(trimmed) && trimmed.split(/\s+/).length <= 10) {
    return { number: null, title: trimmed };
  }
  return null;
}

export function segment(text) {
  const normalised = text.replace(/\r\n?/g, '\n');
  const lines = normalised.split('\n');

  const clauses = [];
  let current = null;
  let offset = 0;

  const push = () => {
    if (!current) return;
    current.text = current.lines.join('\n').trim();
    current.end = current.start + current.lines.join('\n').length;
    if (current.text) clauses.push(current);
    current = null;
  };

  for (const line of lines) {
    const head = headingOf(line);
    if (head) {
      push();
      current = {
        id: `c${clauses.length + 1}`,
        number: head.number,
        title: head.title,
        start: offset,
        lines: [line]
      };
    } else if (current) {
      current.lines.push(line);
    } else {
      // Preamble before the first heading still needs to be citable.
      current = {
        id: `c${clauses.length + 1}`,
        number: null,
        title: 'Preamble',
        start: offset,
        lines: [line]
      };
    }
    offset += line.length + 1;
  }
  push();

  return clauses.map((c, i) => ({
    ...c,
    index: i,
    label: c.number ? `${c.number}${c.title ? ' ' + c.title : ''}` : (c.title || `Clause ${i + 1}`)
  }));
}

// A quote has to be short enough to read in a card and long enough to prove the
// point, so it is trimmed to a sentence window around the match, never mid-word.
export function quoteAround(clauseText, matchIndex, matchLength, window = 220) {
  const start = Math.max(0, matchIndex - Math.floor((window - matchLength) / 2));
  const end = Math.min(clauseText.length, start + window);

  let slice = clauseText.slice(start, end);
  if (start > 0) {
    const cut = slice.search(/[\s]/);
    slice = (cut > -1 ? slice.slice(cut + 1) : slice);
  }
  if (end < clauseText.length) {
    const cut = slice.lastIndexOf(' ');
    slice = cut > 40 ? slice.slice(0, cut) : slice;
  }

  return (start > 0 ? '…' : '') + slice.replace(/\s+/g, ' ').trim() + (end < clauseText.length ? '…' : '');
}
