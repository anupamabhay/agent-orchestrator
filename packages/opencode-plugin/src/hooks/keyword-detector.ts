/**
 * Keyword Detector Hook
 * 
 * Detects special keywords in user prompts and injects mode instructions:
 * - ultrawork/ulw: Maximum intensity mode
 * - parallel/||: Force parallel execution
 * - think/ultrathink: Extended thinking mode
 */

import type { Hook, KeywordConfig, UserPromptSubmitPayload } from '@orchestrator/core';

const MODE_INJECTIONS = {
  ultrawork: `
[ULTRAWORK MODE ACTIVATED]

You are now operating at MAXIMUM INTENSITY:

1. **Parallel Exploration**: Fire 3-5 subagents immediately to explore different aspects
   - @scanner: Find all relevant files
   - @researcher: Look up documentation and best practices
   - @advisor: Analyze architecture implications

2. **Aggressive Execution**: Do not wait, do not ask, just DO
   - Launch background tasks for independent work streams
   - Use all available tools without hesitation
   - Make progress on multiple fronts simultaneously

3. **Completion Guarantee**: You MUST NOT stop until the task is 100% complete
   - Maintain a todo list and work through every item
   - Verify your work actually works
   - Clean up and polish before finishing

4. **Extended Thinking**: Use your full reasoning capabilities
   - Think step-by-step before major decisions
   - Consider edge cases and failure modes
   - Document your reasoning

GO. NOW. FULL POWER.
`.trim(),

  parallel: `
[PARALLEL MODE ACTIVATED]

Execute independent tasks SIMULTANEOUSLY. Do NOT sequence tasks that can run in parallel.

When you see multiple things to do:
1. Identify which tasks have NO dependencies on each other
2. Launch those tasks in parallel using @scanner, @researcher, @worker, etc.
3. Wait for results and synthesize

Example:
- Need to find files AND look up docs? Launch BOTH at once.
- Need to implement feature A AND feature B (independent)? Launch workers for BOTH.
`.trim(),

  think: `
[EXTENDED THINKING MODE]

Before taking action, think deeply:
1. What is the user REALLY asking for?
2. What are ALL the steps needed?
3. What could go wrong?
4. What's the best approach?

Take your time. Reason step-by-step. Quality over speed.
`.trim(),
};

export function createKeywordDetector(keywordConfig: KeywordConfig): Hook<'UserPromptSubmit'> {
  const allKeywords: Map<string, keyof typeof MODE_INJECTIONS> = new Map();

  // Build keyword -> mode mapping
  allKeywords.set('ultrawork', 'ultrawork');
  for (const alias of keywordConfig.ultrawork.aliases) {
    allKeywords.set(alias.toLowerCase(), 'ultrawork');
  }

  allKeywords.set('parallel', 'parallel');
  for (const alias of keywordConfig.parallel.aliases) {
    allKeywords.set(alias.toLowerCase(), 'parallel');
  }

  allKeywords.set('think', 'think');
  for (const alias of keywordConfig.think.aliases) {
    allKeywords.set(alias.toLowerCase(), 'think');
  }

  return {
    name: 'keyword-detector',
    event: 'UserPromptSubmit',
    priority: 100, // Run early

    async handle(event: UserPromptSubmitPayload) {
      const promptLower = event.prompt.toLowerCase();
      const detectedModes = new Set<keyof typeof MODE_INJECTIONS>();

      // Check for keywords
      for (const [keyword, mode] of allKeywords) {
        // Use word boundary matching
        const pattern = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i');
        if (pattern.test(promptLower)) {
          detectedModes.add(mode);
        }
      }

      if (detectedModes.size === 0) {
        return event;
      }

      // Build injected messages
      const injections: string[] = [];
      for (const mode of detectedModes) {
        injections.push(MODE_INJECTIONS[mode]);
      }

      return {
        ...event,
        injectedMessages: [
          ...(event.injectedMessages ?? []),
          ...injections,
        ],
      };
    },
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
