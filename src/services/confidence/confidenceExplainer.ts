import type {
  ConfidenceLevel,
  ConfidenceSignal,
  SignalContext,
} from './confidenceTypes';

/**
 * Stitches a natural-language answer from the strongest signals.
 *
 * The level determines the prefix and which signals lead:
 *   Probably  → top positive
 *   Maybe     → top positive + a nuance-bearing negative (decay / older-out)
 *   Unlikely  → top negative + an acknowledgement of any recent positive
 *   No        → top negative (recent OUT carries the line)
 *   Unknown   → onboarding sentence
 *
 * The signal `.explanation` is treated as a finished clause; the explainer
 * just picks 1–2 and joins them with punctuation. No template strings here
 * apart from the prefix — the clauses come from the generators so the
 * vocabulary stays in one place.
 */
export function explain(
  level: ConfidenceLevel,
  signals: ConfidenceSignal[],
  ctx: SignalContext,
): string {
  if (level === 'Unknown' || signals.length === 0) {
    return `I don't have any history for "${ctx.query}" yet. Scan a receipt or tap + In, and I'll remember next time.`;
  }

  const positives = signals
    .filter(s => s.polarity === 'positive')
    .sort((a, b) => b.weight - a.weight);
  const negatives = signals
    .filter(s => s.polarity === 'negative')
    .sort((a, b) => a.weight - b.weight);

  switch (level) {
    case 'Probably':
      return composeProbably(positives);
    case 'Maybe':
      return composeMaybe(positives, negatives);
    case 'Unlikely':
      return composeUnlikely(positives, negatives);
    case 'No':
      return composeNo(negatives);
  }
}

function prefix(level: ConfidenceLevel): string {
  return `${level}.`;
}

function composeProbably(positives: ConfidenceSignal[]): string {
  const lead = positives[0];
  // Pair with a complementary positive if available (e.g. "no scan-out").
  const support = positives.find(
    s => s !== lead && s.type === 'event.no-out-since-restock',
  );
  const clauses = [lead?.explanation, support?.explanation].filter(Boolean);
  return joinClauses('Probably', clauses);
}

function composeMaybe(
  positives: ConfidenceSignal[],
  negatives: ConfidenceSignal[],
): string {
  const lead = positives[0];
  // For "Maybe" we want to acknowledge the doubt — usually a decay clause.
  const doubt = negatives.find(s => s.type.startsWith('temporal.')) ?? negatives[0];
  const clauses = [lead?.explanation];
  if (doubt) clauses.push(`but ${decapitalize(doubt.explanation)}`);
  return joinClauses('Maybe', clauses);
}

function composeUnlikely(
  positives: ConfidenceSignal[],
  negatives: ConfidenceSignal[],
): string {
  const lead = negatives[0] ?? positives[0];
  const support = negatives.find(s => s !== lead);
  const clauses = [lead?.explanation, support?.explanation].filter(Boolean);
  return joinClauses('Unlikely', clauses);
}

function composeNo(negatives: ConfidenceSignal[]): string {
  const lead =
    negatives.find(s => s.type === 'event.last-out') ?? negatives[0];
  const clauses = [lead?.explanation];
  return joinClauses('No', clauses);
}

function joinClauses(level: ConfidenceLevel, clauses: Array<string | undefined>): string {
  const cleaned = clauses.filter((c): c is string => typeof c === 'string' && c.length > 0);
  if (cleaned.length === 0) return prefix(level);
  return `${prefix(level)} ${cleaned.join(' ')}`.trim();
}

function decapitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}
