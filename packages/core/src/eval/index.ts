// ============================================================================
// Evaluation — public surface
// ============================================================================

export { runArena, recordVote, recordWinner } from './arena.js';
export type { ArenaOptions } from './arena.js';

export {
  computeLeaderboard,
  expectedScore,
  applyElo,
  DEFAULT_RATING,
  DEFAULT_K_FACTOR,
} from './leaderboard.js';
export type { LeaderboardOptions } from './leaderboard.js';

export {
  createEvalStore,
  createInMemoryEvalStore,
  createIndexedDBEvalStore,
  isIndexedDBAvailable,
} from './store.js';
export type { EvalStore, EvalArchive } from './store.js';

export { createSuite, createStarterSuite, runSuite } from './suite.js';
export type { RunSuiteOptions } from './suite.js';

export { toMarkdownReport, toLeaderboardCsv } from './report.js';
export type { ReportOptions } from './report.js';

export type {
  ArenaEntry,
  ArenaEntryStatus,
  ArenaRun,
  Vote,
  PromptCase,
  PromptSuite,
  ModelStanding,
} from './types.js';
