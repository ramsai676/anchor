# Anchor

Reads a contract, finds the obligations, deadlines and risks, and shows you the
exact clause each one came from.

**[Open the live demo](https://ramsai676.github.io/anchor/#demo)** or download
`index.html` and double-click it. No install, no server, no account, no API key.

## The problem

Lawyers have been sanctioned in real courts for filing briefs containing case law
an AI invented. The citations looked perfect. They did not exist.

That is not a bug in a particular model. It is what happens when a system that
generates text is asked a question about a document. Generation is the mechanism,
so a plausible-sounding fabrication is always available to it.

## What Anchor does instead

Anchor never generates a sentence about your contract. It only locates text that
is already there, labels what kind of term it is, and quotes it back with a clause
citation.

There is no step at which a fabrication could enter, because there is no step that
produces new text. That is the whole design, and it is verified by a test:

    every matched span exists verbatim in the source document

Click any finding and the document scrolls to that clause with the matched words
highlighted. You are never asked to trust the tool. You are shown the evidence and
you check it yourself in about two seconds.

## What it finds

Twenty-four term types across six categories.

| Category | Terms |
|---|---|
| Time | effective date, term length, automatic renewal, notice periods |
| Money | fees, payment terms, late-payment interest, unilateral price increases |
| Exit | termination for convenience, termination for cause |
| Risk | liability caps, uncapped liability, indemnities, warranty disclaimers, force majeure, unilateral amendment |
| Restrictions | confidentiality duration, non-compete, non-solicit, IP assignment, assignment restrictions |
| Law | governing law, forum and arbitration, data protection |

Each is graded **risk**, **watch** or **info**, and each carries a short
explanation of why that term matters written for someone who is not a lawyer.

### Asymmetry detection

The finding most often missed is not a bad clause. It is a clause that is fine for
one side and absent for the other, because each half reads reasonably on its own.

Anchor counts which party holds each one-sided right (termination for convenience,
price increases, unilateral amendment, assignment) and flags rights only one party
appears to hold. On the sample contract it catches that only the Provider may raise
prices.

## Measured on real contracts

Anchor was first tested against a contract written for the purpose, which only
proves that rules match text written to be matched. `tools/fetch-real-contracts.js`
pulls real agreements filed as SEC exhibits, and `tools/evaluate.js` measures
recall against a plain keyword search of the same documents: a term that is
present and goes unreported counts as a miss.

On 20 real agreements from Adobe, Vonage, Jazz Pharmaceuticals, BellRing and
others:

| | |
|---|---|
| Recall | **84.4%** of terms present were reported |
| Citation accuracy | **100%** across 197 quotes |
| Findings | 10.4 per contract |

The first run scored **54.5%**, and the gap was entirely patterns written too
tightly around one drafting style. Confidentiality found 0 of 11 because the
rule demanded a duration clause. Liability caps found 1 of 8 because they
required a figure, where real caps are written as a multiple of fees paid.
Governing law missed 5 of 8 over the exact words "the laws of".

Reproduce it:

    node tools/fetch-real-contracts.js 20
    node tools/evaluate.js

Still weak: assignment restrictions and IP ownership clauses, on small samples.
Those numbers are in `corpus/evaluation.json` alongside the rest.

## Privacy

The contract never leaves your browser. There is no upload, no server, no
telemetry, no storage. Turn off your network connection and it still works, which
is the only demonstration of that claim worth anything.

## Running it

    node test/rules.test.js     # 18 checks
    node build.js               # rebuilds index.html from src/

`index.html` is generated. Source lives in `src/` as ES modules; the build
concatenates them into one self-contained file so it can be opened from disk.
The build refuses to write if two modules declare the same top-level name, which
it does because that exact collision once shipped a silently broken bundle.

## Limits, stated plainly

- Plain text only. PDF and DOCX are not parsed yet.
- Rules are English-language patterns. A clause drafted in unusual language can be
  missed, and a missed clause is shown as nothing rather than as a false comfort.
- It finds and explains terms. It does not tell you whether to sign, and it is not
  legal advice.
- Severity grading is a general heuristic. A liability cap that is low for one
  contract is normal for another.

## Built with

Plain JavaScript, no dependencies, no framework, no build toolchain beyond a
40-line concatenator. Node 18+ to run the tests.

MIT licensed.
