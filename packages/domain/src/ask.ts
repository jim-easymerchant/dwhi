/**
 * Ask-history + per-term feedback. The Ask flow asks "do we have X?"
 * and the user confirms or contradicts the engine's answer. Those
 * confirmations feed back into confidence scoring.
 */
export {
  countAll as countAskHistory,
  recordAsk,
  summaryForTerm as askHistorySummaryForTerm,
  type AskHistoryRow,
  type AskSummaryForTerm,
} from '@/repositories/askHistoryRepository';
export {
  countAll as countAskFeedback,
  recordFeedback,
  summaryForTerm as askFeedbackSummaryForTerm,
  type AskFeedbackKind,
  type AskFeedbackRow,
  type FeedbackSummaryForTerm,
} from '@/repositories/askFeedbackRepository';
