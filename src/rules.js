// Every rule is a locator, never a generator. A rule may only point at text that
// already exists in the document and say what kind of term it is. Nothing here
// can invent a clause, a number, or an obligation, which is the entire safety
// argument: there is no step at which a fabrication could enter.

export const SEVERITY = { info: 0, watch: 1, risk: 2 };

const money = String.raw`(?:[$£€₹]\s?[\d,]+(?:\.\d{2})?|(?:USD|EUR|GBP|INR|NOK)\s?[\d,]+(?:\.\d{2})?|[\d,]+\s?(?:lakh|crore|million|billion))`;
const days = String.raw`(\d{1,4}|thirty|sixty|ninety|fifteen|forty-five|one hundred and eighty)\s*[-\s]?\s*(day|business day|week|month|year)s?`;

export const RULES = [
  {
    id: 'parties',
    label: 'Parties',
    category: 'Identity',
    severity: 'info',
    patterns: [
      /\bbetween\s+(.{3,90}?)\s+(?:and|&)\s+(.{3,90}?)(?:[,.]|\s+\()/i,
      /\bby and between\s+(.{3,90}?)\s+and\s+(.{3,90}?)[,.]/i
    ],
    explain: () => 'Names the entities bound by this agreement. Everything else in the document allocates rights between exactly these two.'
  },
  {
    id: 'effective_date',
    label: 'Effective date',
    category: 'Time',
    severity: 'info',
    patterns: [
      /\beffective\s+(?:as\s+of\s+|date[:\s]+|on\s+)([A-Z][a-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
      /\bcommenc(?:es|ing|ement date)\s+(?:on\s+)?([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i
    ],
    explain: () => 'The date obligations start running. Every notice period and deadline in the contract is counted from a date like this one.'
  },
  {
    id: 'term_length',
    label: 'Term length',
    category: 'Time',
    severity: 'info',
    patterns: [
      new RegExp(String.raw`\bterm\s+of\s+(?:this\s+agreement\s+)?(?:shall\s+be\s+|is\s+)?${days}`, 'i'),
      new RegExp(String.raw`\bfor\s+an?\s+initial\s+(?:term|period)\s+of\s+${days}`, 'i')
    ],
    explain: () => 'How long the agreement runs before it ends or renews.'
  },
  {
    id: 'auto_renewal',
    label: 'Automatic renewal',
    category: 'Time',
    severity: 'risk',
    patterns: [
      /\b(?:automatically\s+renew|auto-?renew|shall\s+renew\s+automatically|evergreen)\w*/i,
      /\brenew(?:s|ed)?\s+for\s+successive\s+(?:periods|terms)/i
    ],
    explain: () => 'This contract renews itself unless someone actively stops it. Miss the notice window and you are bound for another full term. This is the single most common way organisations end up paying for things they meant to cancel.'
  },
  {
    id: 'notice_period',
    label: 'Notice period',
    category: 'Time',
    severity: 'watch',
    patterns: [
      new RegExp(String.raw`\b(?:written\s+)?notice\s+(?:of\s+)?(?:at\s+least\s+|not\s+less\s+than\s+)?${days}`, 'i'),
      new RegExp(String.raw`\b${days}\s*(?:prior\s+)?(?:written\s+)?notice`, 'i')
    ],
    explain: () => 'The window you must act inside. Read this together with any automatic renewal: the notice period is what makes the renewal escapable or not.'
  },
  {
    id: 'payment_terms',
    label: 'Payment terms',
    category: 'Money',
    severity: 'info',
    patterns: [
      /\bnet\s+(\d{1,3})\b/i,
      new RegExp(String.raw`\bpayable\s+within\s+${days}`, 'i'),
      new RegExp(String.raw`\bwithin\s+${days}\s+of\s+(?:the\s+)?invoice`, 'i')
    ],
    explain: () => 'How long you have to pay after invoicing. Late-payment penalties key off this number.'
  },
  {
    id: 'fees',
    label: 'Fees and amounts',
    category: 'Money',
    severity: 'info',
    patterns: [
      new RegExp(String.raw`\b(?:fee|price|amount|sum|consideration|charge)s?\s+of\s+${money}`, 'i'),
      new RegExp(String.raw`${money}\s+per\s+(?:month|year|annum|user|seat)`, 'i')
    ],
    explain: () => 'A stated monetary amount. Check it against what was actually agreed commercially.'
  },
  {
    id: 'late_interest',
    label: 'Late payment interest',
    category: 'Money',
    severity: 'watch',
    patterns: [
      /\b(?:interest|late\s+(?:fee|charge|payment))\w*\s+(?:of\s+|at\s+(?:the\s+rate\s+of\s+)?)?(\d{1,2}(?:\.\d+)?)\s*%\s*(?:per\s+(?:month|annum|year))?/i,
      /\b(\d{1,2}(?:\.\d+)?)\s*%\s+per\s+month\s+on\s+(?:any\s+)?(?:overdue|unpaid)/i
    ],
    explain: () => 'A penalty rate on overdue amounts. A monthly percentage compounds to a much larger annual rate than it appears.'
  },
  {
    id: 'price_increase',
    label: 'Unilateral price increase',
    category: 'Money',
    severity: 'risk',
    patterns: [
      /\b(?:may|reserves?\s+the\s+right\s+to)\s+(?:increase|adjust|modify)\s+(?:the\s+)?(?:fees|prices|charges|rates)/i,
      /\bfees?\s+(?:may\s+be|are\s+subject\s+to)\s+(?:increased?|adjustment)/i
    ],
    explain: () => 'One side can raise the price without the other agreeing. Check whether a cap or a notice requirement limits it, because without one this term is open-ended.'
  },
  {
    id: 'termination_convenience',
    label: 'Termination for convenience',
    category: 'Exit',
    severity: 'watch',
    patterns: [
      /\bterminate\s+(?:this\s+agreement\s+)?(?:at\s+any\s+time\s+)?(?:for\s+convenience|without\s+cause|for\s+any\s+reason)/i,
      /\bmay\s+terminate\s+.{0,40}\bwithout\s+(?:cause|reason)/i
    ],
    explain: () => 'Someone can walk away without needing a reason. Who holds this right, and whether both sides hold it, matters more than the clause itself.'
  },
  {
    id: 'termination_cause',
    label: 'Termination for cause',
    category: 'Exit',
    severity: 'info',
    patterns: [
      /\bterminate\s+(?:this\s+agreement\s+)?(?:immediately\s+)?(?:for|upon|in\s+the\s+event\s+of)\s+(?:cause|material\s+breach|default)/i,
      /\bmaterial\s+breach\s+.{0,60}\bterminat/i
    ],
    explain: () => 'The exit route when the other side fails to perform. Look for whether a cure period applies before termination bites.'
  },
  {
    id: 'liability_cap',
    label: 'Liability cap',
    category: 'Risk',
    severity: 'watch',
    patterns: [
      new RegExp(String.raw`\b(?:liability|damages)\s+.{0,80}?(?:shall\s+not\s+exceed|limited\s+to|capped\s+at)\s+.{0,40}?(${money}|(?:twelve|12|six|6)\s+months?)`, 'i'),
      /\b(?:aggregate|total)\s+liability\s+.{0,60}?(?:shall\s+not\s+exceed|limited\s+to)/i
    ],
    explain: () => 'The ceiling on what one side can be made to pay. Compare it to the contract value: a cap far below the potential harm shifts that risk onto you.'
  },
  {
    id: 'unlimited_liability',
    label: 'Uncapped liability',
    category: 'Risk',
    severity: 'risk',
    patterns: [
      /\b(?:unlimited|without\s+limit|no\s+limitation\s+on)\s+liability/i,
      /\bliability\s+(?:shall\s+be\s+)?unlimited/i,
      /\bnothing\s+in\s+this\s+(?:agreement|clause)\s+(?:shall\s+)?limits?\s+(?:the\s+)?liability/i
    ],
    explain: () => 'Liability here has no ceiling. Exposure is whatever the loss turns out to be, which is the term most likely to matter and least likely to be read.'
  },
  {
    id: 'indemnity',
    label: 'Indemnity',
    category: 'Risk',
    severity: 'watch',
    patterns: [
      /\b(?:shall\s+)?indemnif(?:y|ies|ication)\s+(?:and\s+hold\s+harmless\s+)?/i,
      /\bhold\s+harmless\b/i
    ],
    explain: () => 'A promise to cover the other side’s losses, including third-party claims. Indemnities often sit outside the liability cap, so check whether this one does.'
  },
  {
    id: 'governing_law',
    label: 'Governing law',
    category: 'Law',
    severity: 'info',
    patterns: [
      /\bgoverned\s+by\s+(?:and\s+construed\s+in\s+accordance\s+with\s+)?the\s+laws?\s+of\s+([A-Z][\w\s,]{2,40})/i,
      // Requires a stated jurisdiction, so the section heading
      // "GOVERNING LAW AND DISPUTES" cannot satisfy it. A heading names the
      // topic; it does not state which law applies.
      /\bgoverning\s+law\s*(?:is|shall\s+be|:)\s*(?:the\s+laws?\s+of\s+)?([A-Z][\w\s,]{2,40})/i
    ],
    explain: () => 'Which jurisdiction’s law decides the meaning of these words. It changes how many of the other clauses are actually interpreted.'
  },
  {
    id: 'jurisdiction',
    label: 'Forum and dispute resolution',
    category: 'Law',
    severity: 'watch',
    patterns: [
      /\b(?:exclusive\s+)?jurisdiction\s+of\s+the\s+courts?\s+of\s+([A-Z][\w\s,]{2,40})/i,
      /\b(?:settled|resolved)\s+by\s+(?:binding\s+)?arbitration\s+(?:in|administered|under)\s+([\w\s,]{2,50})/i
    ],
    explain: () => 'Where a dispute has to be brought. A distant forum or mandatory arbitration can cost more than the dispute is worth, which is often the point.'
  },
  {
    id: 'confidentiality',
    label: 'Confidentiality duration',
    category: 'Restrictions',
    severity: 'info',
    patterns: [
      new RegExp(String.raw`\bconfidential\w*\s+.{0,80}?(?:for\s+a\s+period\s+of\s+|survive\w*\s+for\s+)${days}`, 'i'),
      /\bconfidentiality\s+obligations?\s+.{0,50}(?:survive|continue)\s+(?:indefinitely|in\s+perpetuity)/i
    ],
    explain: () => 'How long secrecy obligations last. Perpetual confidentiality is an obligation nobody ever stops carrying.'
  },
  {
    id: 'non_compete',
    label: 'Non-compete',
    category: 'Restrictions',
    severity: 'risk',
    patterns: [
      /\bnon-?compet\w+/i,
      /\bshall\s+not\s+.{0,60}\b(?:compete|engage\s+in\s+any\s+business\s+that\s+competes)/i
    ],
    explain: () => 'Restricts what work can be taken on afterwards. Scope, geography and duration decide whether it is enforceable, and those three are worth reading closely.'
  },
  {
    id: 'non_solicit',
    label: 'Non-solicitation',
    category: 'Restrictions',
    severity: 'watch',
    patterns: [
      /\bnon-?solicit\w*/i,
      /\bshall\s+not\s+.{0,50}\bsolicit\s+(?:any\s+)?(?:employee|customer|client)/i
    ],
    explain: () => 'Restricts approaching the other side’s people or customers. Check whether it covers those who approach you first.'
  },
  {
    id: 'ip_assignment',
    label: 'IP ownership',
    category: 'Restrictions',
    severity: 'watch',
    patterns: [
      /\b(?:all\s+)?(?:intellectual\s+property|IP)\s+(?:rights\s+)?(?:shall\s+)?(?:vest\s+in|be\s+owned\s+by|assigned?\s+to)\s+([\w\s]{2,40})/i,
      /\bhereby\s+assigns?\s+.{0,50}\b(?:intellectual\s+property|copyright|inventions)/i
    ],
    explain: () => 'Who owns what gets made. Assignment clauses can reach further than the work actually paid for, so check the scope.'
  },
  {
    id: 'unilateral_amendment',
    label: 'Unilateral amendment',
    category: 'Risk',
    severity: 'risk',
    patterns: [
      /\b(?:may|reserves?\s+the\s+right\s+to)\s+(?:modify|amend|change)\s+(?:these\s+)?(?:terms|this\s+agreement)\s+(?:at\s+any\s+time|from\s+time\s+to\s+time)/i,
      /\bcontinued\s+use\s+.{0,40}\bconstitutes?\s+acceptance/i
    ],
    explain: () => 'One side can rewrite the deal after you have signed it. Whatever you agreed to is only what it says today.'
  },
  {
    id: 'assignment',
    label: 'Assignment restriction',
    category: 'Restrictions',
    severity: 'info',
    patterns: [
      /\bshall\s+not\s+assign\s+.{0,60}\bwithout\s+(?:the\s+)?(?:prior\s+)?written\s+consent/i,
      /\bmay\s+assign\s+this\s+agreement\s+.{0,40}\bwithout\s+consent/i
    ],
    explain: () => 'Whether the contract can be handed to someone else. A one-sided right here means you could end up contracting with a party you never chose.'
  },
  {
    id: 'force_majeure',
    label: 'Force majeure',
    category: 'Risk',
    severity: 'info',
    patterns: [/\bforce\s+majeure\b/i, /\bacts?\s+of\s+God\b/i],
    explain: () => 'Excuses performance during events outside anyone’s control. Whether payment obligations are excused too is the part that usually matters.'
  },
  {
    id: 'warranty_disclaimer',
    label: 'Warranty disclaimer',
    category: 'Risk',
    severity: 'watch',
    patterns: [
      /\bas\s+is\b.{0,40}\bwithout\s+warrant/i,
      /\bdisclaims?\s+all\s+warrant(?:ies|y)/i,
      /\bno\s+warrant(?:ies|y)\s+of\s+any\s+kind/i
    ],
    explain: () => 'The supplier promises nothing about whether it works. If something fails, this clause is what blocks the claim.'
  },
  {
    id: 'data_protection',
    label: 'Data protection',
    category: 'Law',
    severity: 'info',
    patterns: [
      /\b(?:GDPR|General\s+Data\s+Protection\s+Regulation|Digital\s+Personal\s+Data\s+Protection|DPDP)\b/i,
      /\bdata\s+process(?:or|ing)\s+agreement\b/i
    ],
    explain: () => 'Personal-data obligations. These carry regulatory penalties that sit entirely outside the contract’s own liability cap.'
  }
];

// Asymmetry is the finding a reader most often misses, because each half looks
// reasonable alone. It only shows up when the same right is counted per party.
const PARTY_NEAR = 60;

export function detectAsymmetry(findings, partyNames) {
  if (!partyNames || partyNames.length < 2) return [];
  const out = [];
  const oneSided = ['termination_convenience', 'price_increase', 'unilateral_amendment', 'assignment'];

  for (const ruleId of oneSided) {
    const hits = findings.filter(f => f.ruleId === ruleId);
    if (!hits.length) continue;

    const mentions = partyNames.map(name => {
      const first = name.split(/\s+/)[0];
      if (!first || first.length < 3) return 0;
      const re = new RegExp(first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      return hits.filter(h => re.test(h.quote)).length;
    });

    const held = mentions.filter(n => n > 0).length;
    if (held === 1) {
      const holder = partyNames[mentions.findIndex(n => n > 0)];
      out.push({
        ruleId: `asym_${ruleId}`,
        label: `One-sided: ${hits[0].label}`,
        category: 'Risk',
        severity: 'risk',
        clauseId: hits[0].clauseId,
        clauseLabel: hits[0].clauseLabel,
        clauseNumber: hits[0].clauseNumber,
        clauseIndex: hits[0].clauseIndex,
        quote: hits[0].quote,
        matchText: hits[0].matchText,
        explanation: `Only ${holder} appears to hold this right in the clauses where it is granted. A right one party has and the other does not is worth confirming was intended.`
      });
    }
  }
  return out;
}
