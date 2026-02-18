/**
 * Todo Continuation Enforcer Hook
 * 
 * Prevents the agent from stopping while there are incomplete todos.
 * This is what keeps the agent "rolling the boulder" until the task is done.
 */

import type { Hook, StopPayload, TodoItem } from '@orchestrator/core';

export function createTodoEnforcer(): Hook<'Stop'> {
  return {
    name: 'todo-enforcer',
    event: 'Stop',
    priority: 50,

    async handle(event: StopPayload, context) {
      // Get todos from session
      const todos: TodoItem[] = context.session.todos ?? [];

      // Find incomplete todos
      const incomplete = todos.filter(
        (t) => t.status === 'pending' || t.status === 'in_progress'
      );

      if (incomplete.length === 0) {
        // All done, allow stop
        return event;
      }

      // Group by priority
      const highPriority = incomplete.filter((t) => t.priority === 'high');
      const mediumPriority = incomplete.filter((t) => t.priority === 'medium');
      const lowPriority = incomplete.filter((t) => t.priority === 'low');

      // Build continuation prompt
      const lines: string[] = [
        '',
        '═══════════════════════════════════════════════════════════════',
        '  TODO ENFORCER: INCOMPLETE TASKS DETECTED',
        '═══════════════════════════════════════════════════════════════',
        '',
        `You attempted to stop with ${incomplete.length} incomplete task(s).`,
        'You MUST continue until all tasks are complete.',
        '',
      ];

      if (highPriority.length > 0) {
        lines.push('🔴 HIGH PRIORITY:');
        for (const todo of highPriority) {
          const status = todo.status === 'in_progress' ? '🔄' : '⬜';
          lines.push(`   ${status} ${todo.content}`);
        }
        lines.push('');
      }

      if (mediumPriority.length > 0) {
        lines.push('🟡 MEDIUM PRIORITY:');
        for (const todo of mediumPriority) {
          const status = todo.status === 'in_progress' ? '🔄' : '⬜';
          lines.push(`   ${status} ${todo.content}`);
        }
        lines.push('');
      }

      if (lowPriority.length > 0) {
        lines.push('🟢 LOW PRIORITY:');
        for (const todo of lowPriority) {
          const status = todo.status === 'in_progress' ? '🔄' : '⬜';
          lines.push(`   ${status} ${todo.content}`);
        }
        lines.push('');
      }

      lines.push('═══════════════════════════════════════════════════════════════');
      lines.push('');
      lines.push('Continue working on these tasks. Start with the highest priority.');
      lines.push('Mark tasks as complete using the todo tool when finished.');
      lines.push('');

      return {
        ...event,
        injectPrompt: lines.join('\n'),
      };
    },
  };
}

/**
 * Utility to check if todos allow stopping
 */
export function canStop(todos: TodoItem[]): boolean {
  const incomplete = todos.filter(
    (t) => t.status === 'pending' || t.status === 'in_progress'
  );
  return incomplete.length === 0;
}
