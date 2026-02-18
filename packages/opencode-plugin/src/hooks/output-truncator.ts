/**
 * Output Truncator Hook
 * 
 * Truncates large tool outputs to prevent context overflow.
 * Preserves the start and end of output for maximum usefulness.
 */

import type { Hook, PostToolUsePayload, ContextConfig } from '@orchestrator/core';
import { truncateOutput, estimateTokens } from '@orchestrator/core';

// Tools that commonly produce large outputs
const TRUNCATE_TOOLS = new Set([
  'grep',
  'Grep',
  'glob',
  'Glob',
  'read',
  'Read',
  'bash',
  'Bash',
  'lsp_find_references',
  'lsp_diagnostics',
  'ast_grep_search',
]);

export function createOutputTruncator(contextConfig: ContextConfig): Hook<'PostToolUse'> {
  return {
    name: 'output-truncator',
    event: 'PostToolUse',
    priority: 90, // Run early in post-tool hooks

    async handle(event: PostToolUsePayload) {
      // Only truncate specific tools
      if (!TRUNCATE_TOOLS.has(event.tool)) {
        return event;
      }

      const outputTokens = estimateTokens(event.output);
      const maxTokens = contextConfig.maxToolOutputTokens;

      // No truncation needed
      if (outputTokens <= maxTokens) {
        return event;
      }

      // Calculate truncation parameters based on mode
      const truncationOptions = contextConfig.aggressiveTruncation
        ? {
            maxTokens,
            preserveStart: 1500, // Fewer tokens at start
            preserveEnd: 500,    // Fewer tokens at end
            aggressive: true,
          }
        : {
            maxTokens,
            preserveStart: 3000, // More context at start
            preserveEnd: 1000,   // Reasonable end context
            aggressive: false,
          };

      const truncatedOutput = truncateOutput(event.output, truncationOptions);
      const truncatedTokens = estimateTokens(truncatedOutput);
      const savedTokens = outputTokens - truncatedTokens;

      // Add truncation notice
      const notice = [
        '',
        `[Truncated: ${outputTokens.toLocaleString()} → ${truncatedTokens.toLocaleString()} tokens (saved ${savedTokens.toLocaleString()})]`,
        '',
      ].join('\n');

      return {
        ...event,
        output: truncatedOutput + notice,
        injectedMessages: [
          ...(event.injectedMessages ?? []),
          `Note: ${event.tool} output was truncated from ${outputTokens} to ${truncatedTokens} tokens to preserve context headroom.`,
        ],
      };
    },
  };
}
