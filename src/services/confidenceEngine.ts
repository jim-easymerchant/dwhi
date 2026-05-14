/**
 * Compatibility shim. The real engine lives at `@/services/confidence/`.
 * This file re-exports its public surface so older import sites keep working
 * during the refactor; it can be deleted once nothing imports
 * `@/services/confidenceEngine` directly.
 */

export {
  answerQuestion,
  extractQueryTerm,
} from './confidence/confidenceEngine';

export type {
  ConfidenceLevel,
  ConfidenceResult,
  ConfidenceSignal,
  MatchedItem,
  SignalContext,
  SignalGenerator,
  SignalPolarity,
} from './confidence/confidenceTypes';
