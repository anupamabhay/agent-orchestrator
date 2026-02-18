/**
 * Multi-Agent Orchestrator Plugin for OpenCode
 * 
 * Brings parallel agent execution, specialized agents, and workflow automation
 * to OpenCode CLI/TUI.
 */

import {
  createAgentRegistry,
  createParallelExecutor,
  createContextTracker,
  VERSION,
  NAME,
  type Plugin,
  type OrchestratorConfig,
  type AgentDefinition,
} from '@orchestrator/core';

import { createHooks } from './hooks/index.js';
import { createCommands } from './commands/index.js';
import { createTools } from './tools/index.js';
import { loadAgentMarkdownFiles } from './loaders/agents.js';
import { loadConfig, DEFAULT_CONFIG } from './config.js';

// ============================================================================
// Plugin State
// ============================================================================

let config: OrchestratorConfig = DEFAULT_CONFIG;
let agentRegistry: ReturnType<typeof createAgentRegistry> | null = null;
let executor: ReturnType<typeof createParallelExecutor> | null = null;
let contextTracker: ReturnType<typeof createContextTracker> | null = null;

// ============================================================================
// Plugin Definition
// ============================================================================

const plugin: Plugin = {
  name: NAME,
  version: VERSION,

  /**
   * Called when the plugin is loaded
   */
  async onLoad(userConfig) {
    console.log(`[${NAME}] Loading v${VERSION}...`);

    // Merge user config with defaults
    config = loadConfig(userConfig);

    // Initialize agent registry
    agentRegistry = createAgentRegistry(config);
    console.log(`[${NAME}] Registered ${agentRegistry.getAll().length} agents`);

    // Load markdown agent definitions from disk
    const markdownAgents = await loadAgentMarkdownFiles();
    for (const agent of markdownAgents) {
      // Type assertion needed since markdown agents may have different shape
      if (isValidAgentDefinition(agent)) {
        agentRegistry.agents.set(agent.id, agent);
      }
    }

    // Context tracker (will be configured per session)
    contextTracker = createContextTracker(200000, config.context);

    console.log(`[${NAME}] Plugin loaded successfully`);
  },

  /**
   * Called when the plugin is unloaded
   */
  async onUnload() {
    console.log(`[${NAME}] Unloading...`);
    
    // Cancel any background tasks
    if (executor) {
      await executor.cancelAll();
    }

    agentRegistry = null;
    executor = null;
    contextTracker = null;

    console.log(`[${NAME}] Plugin unloaded`);
  },

  /**
   * Agent definitions to register
   */
  get agents() {
    return agentRegistry?.getAll() ?? [];
  },

  /**
   * Hooks for lifecycle events
   */
  get hooks() {
    return createHooks(config);
  },

  /**
   * Slash commands
   */
  get commands() {
    return createCommands(config, () => agentRegistry);
  },

  /**
   * Custom tools
   */
  get tools() {
    return createTools(config, () => executor);
  },
};

// ============================================================================
// Helpers
// ============================================================================

function isValidAgentDefinition(obj: unknown): obj is AgentDefinition {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'prompt' in obj
  );
}

// ============================================================================
// Exports
// ============================================================================

export default plugin;

export {
  config,
  agentRegistry,
  executor,
  contextTracker,
};

// Re-export core types for convenience
export * from '@orchestrator/core';
