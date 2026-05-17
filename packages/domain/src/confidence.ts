/**
 * Confidence engine: turns "do we have X?" into a Probably / Maybe /
 * Unlikely / No answer with weighted signal explanations. Heavily
 * pantry-specific — the signal generators reference inventory events,
 * receipts, and ask-history. Lives in the pantry domain package.
 */
export {
  answerQuestion,
  extractQueryTerm,
} from '@/services/confidence/confidenceEngine';
export { explain } from '@/services/confidence/confidenceExplainer';
export {
  scoreSignals,
  type ScoringResult,
} from '@/services/confidence/weightedScorer';
export type {
  ConfidenceLevel,
  ConfidenceResult,
  ConfidenceSignal,
  MatchedItem,
  SignalContext,
  SignalGenerator,
  SignalPolarity,
} from '@/services/confidence/confidenceTypes';
