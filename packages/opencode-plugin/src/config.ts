/**
 * Configuration loading and defaults
 */

import type { OrchestratorConfig } from '@orchestrator/core';

export const DEFAULT_CONFIG: OrchestratorConfig = {
  defaultAgent: 'orchestrator',
  parallelLimit: 5,
  backgroundEnabled: true,

  keywords: {
    ultrawork: { aliases: ['ulw', 'ultramode'], enableAll: true },
    parallel: { aliases: ['||', 'concurrent'], enableParallel: true },
    think: { aliases: ['ultrathink', 'think deeply'], extendedThinking: true },
  },

  agents: {
    // Agent overrides go here
  },

  context: {
    maxToolOutputTokens: 50000,
    headroomPercentage: 50,
    preemptiveCompactionThreshold: 80,
    aggressiveTruncation: false,
    deduplicateAgentsMd: true,
  },

  background: {
    maxConcurrent: 3,
    notifyOnComplete: true,
    useWorktrees: false,
  },

  hooks: {
    todoEnforcer: true,
    keywordDetector: true,
    outputTruncator: true,
    sessionRecovery: true,
    contextInjector: true,
  },

  mcp: {
    websearch: { enabled: true, provider: 'exa' },
    context7: { enabled: true },
    grepApp: { enabled: true },
  },

  disabled: {
    hooks: [],
    agents: [],
    mcps: [],
  },
};

/**
 * Deep merge user config with defaults
 */
export function loadConfig(
  userConfig?: Partial<OrchestratorConfig>
): OrchestratorConfig {
  if (!userConfig) {
    return DEFAULT_CONFIG;
  }

  return {
    defaultAgent: userConfig.defaultAgent ?? DEFAULT_CONFIG.defaultAgent,
    parallelLimit: userConfig.parallelLimit ?? DEFAULT_CONFIG.parallelLimit,
    backgroundEnabled: userConfig.backgroundEnabled ?? DEFAULT_CONFIG.backgroundEnabled,

    keywords: {
      ...DEFAULT_CONFIG.keywords,
      ...userConfig.keywords,
    },

    agents: {
      ...DEFAULT_CONFIG.agents,
      ...userConfig.agents,
    },

    context: {
      ...DEFAULT_CONFIG.context,
      ...userConfig.context,
    },

    background: {
      ...DEFAULT_CONFIG.background,
      ...userConfig.background,
    },

    hooks: {
      ...DEFAULT_CONFIG.hooks,
      ...userConfig.hooks,
    },

    mcp: {
      ...DEFAULT_CONFIG.mcp,
      ...userConfig.mcp,
    },

    disabled: {
      hooks: [
        ...DEFAULT_CONFIG.disabled.hooks,
        ...(userConfig.disabled?.hooks ?? []),
      ],
      agents: [
        ...DEFAULT_CONFIG.disabled.agents,
        ...(userConfig.disabled?.agents ?? []),
      ],
      mcps: [
        ...DEFAULT_CONFIG.disabled.mcps,
        ...(userConfig.disabled?.mcps ?? []),
      ],
    },
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: OrchestratorConfig): string[] {
  const errors: string[] = [];

  if (config.parallelLimit < 1) {
    errors.push('parallelLimit must be at least 1');
  }

  if (config.parallelLimit > 10) {
    errors.push('parallelLimit should not exceed 10 for stability');
  }

  if (config.context.headroomPercentage < 10) {
    errors.push('context.headroomPercentage should be at least 10%');
  }

  if (config.context.headroomPercentage > 80) {
    errors.push('context.headroomPercentage should not exceed 80%');
  }

  return errors;
}
