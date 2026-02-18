/**
 * Multi-Agent Orchestrator Core
 * 
 * Shared logic for agent orchestration across OpenCode and VSCode/Kilo
 */

// Types
export * from './types/index.js';

// Agents
export {
  DEFAULT_AGENTS,
  getDefaultAgent,
  getAllDefaultAgents,
  AgentRegistryImpl,
  createAgentRegistry,
  formatAgentDescriptions,
  resolveModel,
} from './agents/index.js';

// Planning
export {
  detectKeywords,
  analyzeIntent,
  decomposeTask,
  createTaskPlan,
  createDelegation,
  formatDelegationPrompt,
} from './planning/index.js';

// Execution
export {
  DEFAULT_EXECUTION_CONFIG,
  ParallelExecutor,
  aggregateResults,
  createParallelExecutor,
} from './execution/index.js';
export type { TaskExecutor, AggregatedResult } from './execution/index.js';

// Context
export {
  DEFAULT_CONTEXT_CONFIG,
  estimateTokens,
  truncateToTokens,
  truncateOutput,
  ContextTracker,
  AgentsMdInjector,
  buildInjectedContext,
  createContextTracker,
  createAgentsMdInjector,
} from './context/index.js';
export type { TruncationOptions, ContextBuilderOptions } from './context/index.js';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';
export const NAME = 'multi-agent-orchestrator';
