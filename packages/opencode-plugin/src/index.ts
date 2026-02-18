/**
 * Multi-Agent Orchestrator Plugin for OpenCode
 *
 * Implements the OpenCode plugin API:
 * https://opencode.ai/docs/plugins
 *
 * Plugin functions receive ({ project, client, $, directory, worktree })
 * and return event hook objects.
 *
 * Agents are NOT registered through the plugin — they are defined as
 * markdown files in ~/.config/opencode/agents/ or .opencode/agents/.
 * See the agents/ directory in this package for the markdown files.
 */

import { estimateTokens, truncateOutput } from '@orchestrator/core';

// ============================================================================
// Types (matching OpenCode plugin API)
// ============================================================================

interface PluginContext {
  project: unknown;
  client: {
    app: {
      log: (opts: { body: { service: string; level: string; message: string; extra?: Record<string, unknown> } }) => Promise<void>;
    };
  };
  $: unknown;
  directory: string;
  worktree: string;
}

type PluginFunction = (ctx: PluginContext) => Promise<Record<string, unknown>>;

// ============================================================================
// Main Plugin — Event Hooks
// ============================================================================

/**
 * OrchestratorPlugin — hooks into OpenCode lifecycle events to provide:
 * - Output truncation for large tool results
 * - Compaction context injection for agent continuity
 * - Session error logging
 */
export const OrchestratorPlugin: PluginFunction = async ({ client }) => {
  await client.app.log({
    body: {
      service: 'orchestrator-plugin',
      level: 'info',
      message: 'Multi-Agent Orchestrator plugin loaded',
    },
  });

  return {
    /**
     * Truncate large tool outputs to prevent context overflow.
     * Fires after every tool execution.
     */
    'tool.execute.after': async (
      input: { tool: string },
      output: { result: unknown }
    ) => {
      const truncateTools = new Set([
        'read', 'grep', 'glob', 'bash',
        'lsp_find_references', 'lsp_diagnostics', 'ast_grep_search',
      ]);

      if (!truncateTools.has(input.tool)) {
        return;
      }

      const result = output.result;
      if (typeof result !== 'string') {
        return;
      }

      const MAX_TOKENS = 50_000;
      const tokens = estimateTokens(result);

      if (tokens <= MAX_TOKENS) {
        return;
      }

      output.result = truncateOutput(result, {
        maxTokens: MAX_TOKENS,
        preserveStart: 3000,
        preserveEnd: 1000,
      });
    },

    /**
     * Inject orchestrator context into compaction summaries.
     * Ensures subagent delegation patterns persist across compaction.
     */
    'experimental.session.compacting': async (
      _input: unknown,
      output: { context: string[] }
    ) => {
      output.context.push(`## Multi-Agent Orchestrator Context

When resuming after compaction, remember:

### Available Subagents
Invoke specialized agents using @mentions:
- @scanner — Fast codebase exploration (grep, glob, quick lookups)
- @researcher — Documentation, OSS examples, best practices
- @advisor — Architecture review, debugging, code review (read-only)
- @designer — UI/UX, styling, responsive design
- @worker — Parallel task execution, fast implementation
- @builder — Deep autonomous coding, end-to-end features
- @planner — Strategic planning, task decomposition

### Parallel Execution
Launch independent tasks simultaneously using @mentions.

### Keyword Triggers
- \`ultrawork\` / \`ulw\` — Maximum intensity parallel execution
- \`parallel\` / \`||\` — Force parallel execution
- \`think\` / \`ultrathink\` — Extended reasoning before action

### Task Completion
Maintain todos. Do not stop until all tasks are marked complete.`);
    },

    /**
     * React to session events for logging/diagnostics.
     */
    event: async ({ event }: { event: { type: string } }) => {
      if (event.type === 'session.error') {
        await client.app.log({
          body: {
            service: 'orchestrator-plugin',
            level: 'error',
            message: `Session error detected`,
            extra: { event },
          },
        });
      }
    },
  };
};
