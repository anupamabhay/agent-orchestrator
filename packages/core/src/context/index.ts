/**
 * Context Management Module
 * 
 * Handles token optimization, truncation, and context injection
 */

import type { ContextConfig, ContextUsage, InjectedContext } from '../types/index.js';

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  maxToolOutputTokens: 50000,
  headroomPercentage: 50,
  preemptiveCompactionThreshold: 80,
  aggressiveTruncation: false,
  deduplicateAgentsMd: true,
};

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Rough token estimation (4 chars per token average)
 * More accurate estimation would use tiktoken or similar
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within token limit
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const currentTokens = estimateTokens(text);
  
  if (currentTokens <= maxTokens) {
    return text;
  }

  // Rough character limit based on token target
  const targetChars = maxTokens * 4;
  
  if (text.length <= targetChars) {
    return text;
  }

  // Truncate with indicator
  const truncatedLength = targetChars - 100; // Leave room for truncation message
  const truncated = text.slice(0, truncatedLength);
  
  const remainingTokens = currentTokens - estimateTokens(truncated);
  return `${truncated}\n\n[... truncated ${remainingTokens} tokens ...]`;
}

// ============================================================================
// Output Truncation
// ============================================================================

export interface TruncationOptions {
  maxTokens: number;
  preserveStart: number;
  preserveEnd: number;
  aggressive: boolean;
}

const DEFAULT_TRUNCATION_OPTIONS: TruncationOptions = {
  maxTokens: 50000,
  preserveStart: 2000,
  preserveEnd: 1000,
  aggressive: false,
};

/**
 * Smart truncation that preserves start and end of output
 */
export function truncateOutput(
  output: string,
  options: Partial<TruncationOptions> = {}
): string {
  const opts = { ...DEFAULT_TRUNCATION_OPTIONS, ...options };
  const tokens = estimateTokens(output);

  if (tokens <= opts.maxTokens) {
    return output;
  }

  const lines = output.split('\n');
  
  // Calculate how many lines to keep
  const startChars = opts.preserveStart * 4;
  const endChars = opts.preserveEnd * 4;

  let startPart = '';
  let charCount = 0;
  let startLineIndex = 0;
  
  for (let i = 0; i < lines.length && charCount < startChars; i++) {
    startPart += lines[i] + '\n';
    charCount += lines[i].length + 1;
    startLineIndex = i + 1;
  }

  let endPart = '';
  charCount = 0;
  let endLineIndex = lines.length;
  
  for (let i = lines.length - 1; i >= startLineIndex && charCount < endChars; i--) {
    endPart = lines[i] + '\n' + endPart;
    charCount += lines[i].length + 1;
    endLineIndex = i;
  }

  const omittedLines = endLineIndex - startLineIndex;
  const omittedTokens = estimateTokens(
    lines.slice(startLineIndex, endLineIndex).join('\n')
  );

  return `${startPart.trimEnd()}

[... ${omittedLines} lines (~${omittedTokens} tokens) omitted ...]

${endPart.trimStart()}`;
}

// ============================================================================
// Context Usage Tracking
// ============================================================================

export class ContextTracker {
  private config: ContextConfig;
  private contextLimit: number;
  private usedTokens: number;

  constructor(contextLimit: number, config: Partial<ContextConfig> = {}) {
    this.config = { ...DEFAULT_CONTEXT_CONFIG, ...config };
    this.contextLimit = contextLimit;
    this.usedTokens = 0;
  }

  /**
   * Add tokens to the usage count
   */
  addUsage(tokens: number): void {
    this.usedTokens += tokens;
  }

  /**
   * Set the current usage
   */
  setUsage(tokens: number): void {
    this.usedTokens = tokens;
  }

  /**
   * Get current context usage
   */
  getUsage(): ContextUsage {
    const headroomTokens = Math.floor(
      this.contextLimit * (this.config.headroomPercentage / 100)
    );
    
    return {
      used: this.usedTokens,
      limit: this.contextLimit,
      headroom: headroomTokens,
      percentage: (this.usedTokens / this.contextLimit) * 100,
    };
  }

  /**
   * Check if preemptive compaction is needed
   */
  needsCompaction(): boolean {
    const usage = this.getUsage();
    return usage.percentage >= this.config.preemptiveCompactionThreshold;
  }

  /**
   * Calculate maximum tokens for tool output given current usage
   */
  getMaxToolOutputTokens(): number {
    const usage = this.getUsage();
    const available = this.contextLimit - usage.used - usage.headroom;
    
    return Math.min(
      this.config.maxToolOutputTokens,
      Math.max(0, available)
    );
  }

  /**
   * Reset usage counter
   */
  reset(): void {
    this.usedTokens = 0;
  }
}

// ============================================================================
// AGENTS.md Injection
// ============================================================================

export class AgentsMdInjector {
  private injectedPaths: Set<string>;
  private config: ContextConfig;

  constructor(config: Partial<ContextConfig> = {}) {
    this.config = { ...DEFAULT_CONTEXT_CONFIG, ...config };
    this.injectedPaths = new Set();
  }

  /**
   * Get AGENTS.md content for injection, with deduplication
   */
  getAgentsContext(
    _filePath: string,
    agentsMdContents: Map<string, string>
  ): string[] {
    if (!this.config.deduplicateAgentsMd) {
      return Array.from(agentsMdContents.values());
    }

    const toInject: string[] = [];

    for (const [mdPath, content] of agentsMdContents) {
      if (!this.injectedPaths.has(mdPath)) {
        toInject.push(content);
        this.injectedPaths.add(mdPath);
      }
    }

    return toInject;
  }

  /**
   * Clear injection history (e.g., on session reset)
   */
  reset(): void {
    this.injectedPaths.clear();
  }
}

// ============================================================================
// Context Builder
// ============================================================================

export interface ContextBuilderOptions {
  includeAgentsMd: boolean;
  includeRules: boolean;
  includeMemory: boolean;
}

export function buildInjectedContext(
  options: Partial<ContextBuilderOptions> = {}
): InjectedContext {
  const opts: ContextBuilderOptions = {
    includeAgentsMd: true,
    includeRules: true,
    includeMemory: true,
    ...options,
  };

  return {
    agentsMd: opts.includeAgentsMd ? [] : [],
    rules: opts.includeRules ? [] : [],
    memory: opts.includeMemory ? [] : [],
  };
}

// ============================================================================
// Factory
// ============================================================================

export function createContextTracker(
  contextLimit: number,
  config?: Partial<ContextConfig>
): ContextTracker {
  return new ContextTracker(contextLimit, config);
}

export function createAgentsMdInjector(
  config?: Partial<ContextConfig>
): AgentsMdInjector {
  return new AgentsMdInjector(config);
}
