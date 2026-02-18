/**
 * Hooks for OpenCode lifecycle events
 */

import type { Hook, OrchestratorConfig } from '@orchestrator/core';

import { createKeywordDetector } from './keyword-detector.js';
import { createTodoEnforcer } from './todo-enforcer.js';
import { createOutputTruncator } from './output-truncator.js';
import { createContextInjector } from './context-injector.js';

/**
 * Create all hooks based on configuration
 */
export function createHooks(config: OrchestratorConfig): Hook[] {
  const hooks: Hook[] = [];
  const disabled = new Set(config.disabled.hooks);

  // Keyword detector (ultrawork, parallel, think)
  if (config.hooks.keywordDetector && !disabled.has('keyword-detector')) {
    hooks.push(createKeywordDetector(config.keywords));
  }

  // Todo continuation enforcer
  if (config.hooks.todoEnforcer && !disabled.has('todo-enforcer')) {
    hooks.push(createTodoEnforcer());
  }

  // Output truncation
  if (config.hooks.outputTruncator && !disabled.has('output-truncator')) {
    hooks.push(createOutputTruncator(config.context));
  }

  // Context injection (AGENTS.md)
  if (config.hooks.contextInjector && !disabled.has('context-injector')) {
    hooks.push(createContextInjector());
  }

  return hooks;
}

export { createKeywordDetector } from './keyword-detector.js';
export { createTodoEnforcer } from './todo-enforcer.js';
export { createOutputTruncator } from './output-truncator.js';
export { createContextInjector } from './context-injector.js';
