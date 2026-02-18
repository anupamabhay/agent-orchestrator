/**
 * Core types for the Multi-Agent Orchestrator
 */

// ============================================================================
// Model & Provider Types
// ============================================================================

export interface ModelSpec {
  provider: string;
  model: string;
  thinking?: {
    budgetTokens: number;
  };
}

export interface ModelFallback {
  primary: ModelSpec;
  fallbacks: ModelSpec[];
}

// ============================================================================
// Agent Types
// ============================================================================

export type AgentMode = 'primary' | 'subagent';

export type AgentId =
  | 'orchestrator'
  | 'planner'
  | 'advisor'
  | 'builder'
  | 'worker'
  | 'researcher'
  | 'scanner'
  | 'designer';

export interface ToolPermissions {
  read?: boolean;
  write?: boolean;
  edit?: boolean;
  bash?: boolean;
  task?: boolean;
  backgroundTask?: boolean;
  glob?: boolean;
  grep?: boolean;
  lsp?: boolean;
  webSearch?: boolean;
  [key: string]: boolean | undefined;
}

export interface AgentDefinition {
  id: AgentId;
  name: string;
  description: string;
  mode: AgentMode;
  model: ModelSpec;
  fallbacks: ModelSpec[];
  tools: ToolPermissions;
  temperature: number;
  maxSteps?: number;
  prompt: string;
  hidden?: boolean;
  todoEnforcer?: boolean;
}

export interface AgentRegistry {
  agents: Map<AgentId, AgentDefinition>;
  get(id: AgentId): AgentDefinition | undefined;
  getAll(): AgentDefinition[];
  getPrimary(): AgentDefinition[];
  getSubagents(): AgentDefinition[];
}

// ============================================================================
// Task & Planning Types
// ============================================================================

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Task {
  id: string;
  agent: AgentId;
  prompt: string;
  status: TaskStatus;
  dependencies: string[];
  result?: TaskResult;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TaskResult {
  success: boolean;
  output: string;
  error?: string;
  tokensUsed?: number;
  durationMs?: number;
}

export interface TaskPlan {
  id: string;
  originalPrompt: string;
  parallelizable: Task[];
  sequential: Task[];
  delegations: Delegation[];
}

export interface Delegation {
  fromAgent: AgentId;
  toAgent: AgentId;
  task: Task;
  reason: string;
}

// ============================================================================
// Execution Types
// ============================================================================

export interface ExecutionConfig {
  parallelLimit: number;
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface BackgroundTask extends Task {
  backgroundId: string;
  notifyOnComplete: boolean;
}

export interface BackgroundHandle {
  taskId: string;
  status: () => Promise<TaskStatus>;
  cancel: () => Promise<void>;
  getResult: (timeoutMs?: number) => Promise<TaskResult | null>;
}

// ============================================================================
// Context Types
// ============================================================================

export interface ContextConfig {
  maxToolOutputTokens: number;
  headroomPercentage: number;
  preemptiveCompactionThreshold: number;
  aggressiveTruncation: boolean;
  deduplicateAgentsMd: boolean;
}

export interface ContextUsage {
  used: number;
  limit: number;
  headroom: number;
  percentage: number;
}

export interface InjectedContext {
  agentsMd: string[];
  rules: string[];
  memory: string[];
}

// ============================================================================
// Hook Types
// ============================================================================

export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'UserPromptSubmit'
  | 'Stop';

export interface HookContext {
  session: Session;
  agent: AgentDefinition;
  config: OrchestratorConfig;
}

export interface Hook<T extends HookEvent = HookEvent> {
  name: string;
  event: T;
  priority?: number;
  handle: (event: HookEventPayload<T>, context: HookContext) => Promise<HookEventPayload<T> | void>;
}

export type HookEventPayload<T extends HookEvent> =
  T extends 'UserPromptSubmit' ? UserPromptSubmitPayload :
  T extends 'PreToolUse' ? PreToolUsePayload :
  T extends 'PostToolUse' ? PostToolUsePayload :
  T extends 'Stop' ? StopPayload :
  never;

export interface UserPromptSubmitPayload {
  prompt: string;
  injectedMessages?: string[];
}

export interface PreToolUsePayload {
  tool: string;
  input: Record<string, unknown>;
  shouldBlock?: boolean;
}

export interface PostToolUsePayload {
  tool: string;
  input: Record<string, unknown>;
  output: string;
  injectedMessages?: string[];
}

export interface StopPayload {
  reason: string;
  injectPrompt?: string;
}

// ============================================================================
// Session Types
// ============================================================================

export interface Session {
  id: string;
  agent: AgentId;
  todos: TodoItem[];
  messages: Message[];
  context: InjectedContext;
  startedAt: Date;
  lastActivityAt: Date;
}

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
  completedAt?: Date;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface OrchestratorConfig {
  defaultAgent: AgentId;
  parallelLimit: number;
  backgroundEnabled: boolean;
  keywords: KeywordConfig;
  agents: Partial<Record<AgentId, Partial<AgentDefinition>>>;
  context: ContextConfig;
  background: BackgroundConfig;
  hooks: HooksConfig;
  mcp: McpConfig;
  disabled: DisabledConfig;
}

export interface KeywordConfig {
  ultrawork: { aliases: string[]; enableAll: boolean };
  parallel: { aliases: string[]; enableParallel: boolean };
  think: { aliases: string[]; extendedThinking: boolean };
}

export interface BackgroundConfig {
  maxConcurrent: number;
  notifyOnComplete: boolean;
  useWorktrees: boolean;
}

export interface HooksConfig {
  todoEnforcer: boolean;
  keywordDetector: boolean;
  outputTruncator: boolean;
  sessionRecovery: boolean;
  contextInjector: boolean;
}

export interface McpConfig {
  websearch: { enabled: boolean; provider: string };
  context7: { enabled: boolean };
  grepApp: { enabled: boolean };
}

export interface DisabledConfig {
  hooks: string[];
  agents: AgentId[];
  mcps: string[];
}

// ============================================================================
// Plugin Types (for OpenCode integration)
// ============================================================================

export interface Plugin {
  name: string;
  version: string;
  agents?: AgentDefinition[];
  hooks?: Hook[];
  commands?: Command[];
  tools?: Tool[];
  onLoad?: (config: OrchestratorConfig) => Promise<void>;
  onUnload?: () => Promise<void>;
}

export interface Command {
  name: string;
  description: string;
  execute: (args: string[], context: CommandContext) => Promise<string>;
}

export interface CommandContext {
  session: Session;
  config: OrchestratorConfig;
  invokeAgent: (agent: AgentId, prompt: string) => Promise<TaskResult>;
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameters;
  execute: (params: Record<string, unknown>, context: ToolContext) => Promise<unknown>;
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
}

export interface ToolContext {
  session: Session;
  config: OrchestratorConfig;
  invokeAgent: (agent: AgentId, prompt: string) => Promise<TaskResult>;
  launchBackground: (agent: AgentId, prompt: string) => Promise<string>;
}
