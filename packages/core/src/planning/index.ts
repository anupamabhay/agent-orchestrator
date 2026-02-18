/**
 * Task Planning Module
 * 
 * Analyzes user prompts and decomposes them into parallelizable tasks
 */

import type { 
  AgentId, 
  AgentRegistry, 
  Delegation, 
  Task, 
  TaskPlan 
} from '../types/index.js';

// ============================================================================
// Task ID Generation
// ============================================================================

let taskCounter = 0;

function generateTaskId(): string {
  return `task_${Date.now()}_${++taskCounter}`;
}

function generatePlanId(): string {
  return `plan_${Date.now()}_${++taskCounter}`;
}

// ============================================================================
// Keyword Detection
// ============================================================================

interface KeywordMatch {
  keyword: string;
  mode: 'ultrawork' | 'parallel' | 'think' | 'research' | 'debug';
}

const KEYWORD_PATTERNS: Array<{ patterns: RegExp[]; mode: KeywordMatch['mode'] }> = [
  {
    patterns: [/\bultrawork\b/i, /\bulw\b/i, /\bultramode\b/i],
    mode: 'ultrawork',
  },
  {
    patterns: [/\bparallel\b/i, /\|\|/, /\bconcurrent\b/i],
    mode: 'parallel',
  },
  {
    patterns: [/\bthink\b/i, /\bultrathink\b/i, /\bthink deeply\b/i, /\breason\b/i],
    mode: 'think',
  },
  {
    patterns: [/\bresearch\b/i, /\bfind\b/i, /\bsearch\b/i, /\blook up\b/i],
    mode: 'research',
  },
  {
    patterns: [/\bdebug\b/i, /\bfix\b/i, /\berror\b/i, /\bbug\b/i],
    mode: 'debug',
  },
];

export function detectKeywords(prompt: string): KeywordMatch[] {
  const matches: KeywordMatch[] = [];

  for (const { patterns, mode } of KEYWORD_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(prompt)) {
        matches.push({ keyword: prompt.match(pattern)?.[0] ?? '', mode });
        break;
      }
    }
  }

  return matches;
}

// ============================================================================
// Intent Detection
// ============================================================================

type TaskIntent = 
  | 'explore'      // Need to understand codebase
  | 'research'     // Need external docs/examples
  | 'review'       // Need architecture/code review
  | 'implement'    // Need to write code
  | 'debug'        // Need to fix an issue
  | 'design'       // Need UI/UX work
  | 'plan'         // Need a detailed plan
  | 'compound';    // Multiple intents

interface IntentAnalysis {
  primary: TaskIntent;
  secondary: TaskIntent[];
  suggestedAgents: AgentId[];
  isParallelizable: boolean;
}

const INTENT_PATTERNS: Array<{ patterns: RegExp[]; intent: TaskIntent; agents: AgentId[] }> = [
  {
    patterns: [/find\s+(?:all|where|which)/i, /locate/i, /search\s+(?:for|the)/i, /grep/i],
    intent: 'explore',
    agents: ['scanner'],
  },
  {
    patterns: [/how\s+(?:does|do|to)/i, /documentation/i, /docs\s+for/i, /example\s+of/i, /best\s+practice/i],
    intent: 'research',
    agents: ['researcher'],
  },
  {
    patterns: [/review/i, /architecture/i, /design\s+decision/i, /should\s+(?:I|we)/i, /advice/i],
    intent: 'review',
    agents: ['advisor'],
  },
  {
    patterns: [/implement/i, /create/i, /build/i, /add/i, /write/i, /develop/i],
    intent: 'implement',
    agents: ['builder', 'worker'],
  },
  {
    patterns: [/debug/i, /fix/i, /error/i, /bug/i, /broken/i, /not\s+working/i],
    intent: 'debug',
    agents: ['advisor', 'scanner'],
  },
  {
    patterns: [/style/i, /css/i, /ui/i, /ux/i, /design/i, /layout/i, /responsive/i],
    intent: 'design',
    agents: ['designer'],
  },
  {
    patterns: [/plan/i, /break\s+down/i, /steps/i, /roadmap/i],
    intent: 'plan',
    agents: ['planner'],
  },
];

export function analyzeIntent(prompt: string): IntentAnalysis {
  const matchedIntents: Array<{ intent: TaskIntent; agents: AgentId[] }> = [];

  for (const { patterns, intent, agents } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(prompt)) {
        matchedIntents.push({ intent, agents });
        break;
      }
    }
  }

  if (matchedIntents.length === 0) {
    // Default to implement if no specific intent detected
    return {
      primary: 'implement',
      secondary: [],
      suggestedAgents: ['orchestrator'],
      isParallelizable: false,
    };
  }

  if (matchedIntents.length === 1) {
    return {
      primary: matchedIntents[0].intent,
      secondary: [],
      suggestedAgents: matchedIntents[0].agents,
      isParallelizable: false,
    };
  }

  // Multiple intents detected - compound task
  const allAgents = new Set<AgentId>();
  for (const { agents } of matchedIntents) {
    agents.forEach(a => allAgents.add(a));
  }

  return {
    primary: 'compound',
    secondary: matchedIntents.map(m => m.intent),
    suggestedAgents: Array.from(allAgents),
    isParallelizable: true,
  };
}

// ============================================================================
// Task Decomposition
// ============================================================================

interface DecompositionContext {
  prompt: string;
  keywords: KeywordMatch[];
  intent: IntentAnalysis;
  registry: AgentRegistry;
}

export function decomposeTask(
  prompt: string,
  registry: AgentRegistry
): { tasks: Task[]; parallelizable: boolean } {
  const keywords = detectKeywords(prompt);
  const intent = analyzeIntent(prompt);

  const context: DecompositionContext = {
    prompt,
    keywords,
    intent,
    registry,
  };

  // Check for ultrawork mode - maximum parallelization
  const isUltrawork = keywords.some(k => k.mode === 'ultrawork');
  if (isUltrawork) {
    return createUltraworkTasks(context);
  }

  // Check for explicit parallel mode
  const isParallel = keywords.some(k => k.mode === 'parallel');
  if (isParallel || intent.isParallelizable) {
    return createParallelTasks(context);
  }

  // Default: create tasks based on intent
  return createIntentTasks(context);
}

function createUltraworkTasks(context: DecompositionContext): { tasks: Task[]; parallelizable: boolean } {
  const { prompt } = context;
  const tasks: Task[] = [];

  // In ultrawork mode, we fire multiple exploration agents in parallel
  // before the main work begins

  // 1. Scanner task - find relevant files
  tasks.push(createTask('scanner', `Find all files relevant to: ${prompt}`));

  // 2. Researcher task - look up documentation
  tasks.push(createTask('researcher', `Research best practices and documentation for: ${prompt}`));

  // 3. Advisor task - architectural review
  tasks.push(createTask('advisor', `Analyze architecture implications of: ${prompt}`));

  return { tasks, parallelizable: true };
}

function createParallelTasks(context: DecompositionContext): { tasks: Task[]; parallelizable: boolean } {
  const { prompt, intent } = context;
  const tasks: Task[] = [];

  for (const agentId of intent.suggestedAgents) {
    const agent = context.registry.get(agentId);
    if (agent) {
      tasks.push(createTask(agentId, prompt));
    }
  }

  return { tasks, parallelizable: true };
}

function createIntentTasks(context: DecompositionContext): { tasks: Task[]; parallelizable: boolean } {
  const { prompt, intent } = context;
  const tasks: Task[] = [];

  // For single-intent tasks, delegate to the most appropriate agent
  const primaryAgent = intent.suggestedAgents[0] ?? 'orchestrator';
  tasks.push(createTask(primaryAgent, prompt));

  return { tasks, parallelizable: false };
}

function createTask(agent: AgentId, prompt: string): Task {
  return {
    id: generateTaskId(),
    agent,
    prompt,
    status: 'pending',
    dependencies: [],
    createdAt: new Date(),
  };
}

// ============================================================================
// Plan Creation
// ============================================================================

export function createTaskPlan(
  prompt: string,
  registry: AgentRegistry
): TaskPlan {
  const { tasks, parallelizable } = decomposeTask(prompt, registry);

  const plan: TaskPlan = {
    id: generatePlanId(),
    originalPrompt: prompt,
    parallelizable: parallelizable ? tasks : [],
    sequential: parallelizable ? [] : tasks,
    delegations: [],
  };

  return plan;
}

// ============================================================================
// Delegation Helpers
// ============================================================================

export function createDelegation(
  fromAgent: AgentId,
  toAgent: AgentId,
  task: Task,
  reason: string
): Delegation {
  return {
    fromAgent,
    toAgent,
    task,
    reason,
  };
}

export function formatDelegationPrompt(delegation: Delegation): string {
  return `[Delegated from @${delegation.fromAgent}]
Reason: ${delegation.reason}

${delegation.task.prompt}`;
}
