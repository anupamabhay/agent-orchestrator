/**
 * Custom Tools for OpenCode
 */

import type { Tool, OrchestratorConfig, AgentId } from '@orchestrator/core';
import type { ParallelExecutor } from '@orchestrator/core';

export function createTools(
  config: OrchestratorConfig,
  getExecutor: () => ParallelExecutor | null
): Tool[] {
  return [
    createTaskTool(config),
    createBackgroundTaskTool(config, getExecutor),
    createBackgroundOutputTool(getExecutor),
    createBackgroundCancelTool(getExecutor),
  ];
}

/**
 * task - Delegate task to a specialized subagent
 */
function createTaskTool(config: OrchestratorConfig): Tool {
  return {
    name: 'task',
    description: `Delegate a task to a specialized subagent. Available agents:
- scanner: Fast codebase exploration (grep, glob)
- researcher: Documentation and OSS examples
- advisor: Architecture review and debugging (read-only)
- designer: UI/UX implementation
- worker: Parallel task execution
- builder: Deep autonomous coding
- planner: Strategic planning`,

    parameters: {
      type: 'object',
      properties: {
        agent: {
          type: 'string',
          enum: ['scanner', 'researcher', 'advisor', 'designer', 'worker', 'builder', 'planner'],
          description: 'Which specialized agent to invoke',
        },
        prompt: {
          type: 'string',
          description: 'The task for the agent to perform',
        },
        runInBackground: {
          type: 'boolean',
          description: 'If true, runs async and returns task_id immediately',
          default: false,
        },
      },
      required: ['agent', 'prompt'],
    },

    async execute(params, context) {
      const agent = params.agent as AgentId;
      const prompt = params.prompt as string;
      const runInBackground = params.runInBackground as boolean ?? false;

      if (runInBackground) {
        const taskId = await context.launchBackground(agent, prompt);
        return {
          status: 'launched',
          taskId,
          message: `Background task launched. Use background_output to get results when ready.`,
        };
      }

      // Synchronous execution
      const result = await context.invokeAgent(agent, prompt);
      return result;
    },
  };
}

/**
 * background_task - Launch an agent task in the background
 */
function createBackgroundTaskTool(
  config: OrchestratorConfig,
  getExecutor: () => ParallelExecutor | null
): Tool {
  return {
    name: 'background_task',
    description: 'Launch an agent task in the background. Returns immediately with a task_id.',

    parameters: {
      type: 'object',
      properties: {
        agent: {
          type: 'string',
          enum: ['scanner', 'researcher', 'advisor', 'designer', 'worker', 'builder', 'planner'],
          description: 'Which agent to run in background',
        },
        prompt: {
          type: 'string',
          description: 'The task for the agent',
        },
        description: {
          type: 'string',
          description: 'Brief description of what this task does (for tracking)',
        },
      },
      required: ['agent', 'prompt'],
    },

    async execute(params, context) {
      const agent = params.agent as AgentId;
      const prompt = params.prompt as string;
      const description = params.description as string ?? prompt.slice(0, 50);

      const taskId = await context.launchBackground(agent, prompt);

      return {
        taskId,
        agent,
        description,
        status: 'running',
        message: `Background task started. Check status with background_output(task_id="${taskId}")`,
      };
    },
  };
}

/**
 * background_output - Get results from a background task
 */
function createBackgroundOutputTool(
  getExecutor: () => ParallelExecutor | null
): Tool {
  return {
    name: 'background_output',
    description: 'Get results from a background task. Returns immediately with current status.',

    parameters: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'The task_id from background_task',
        },
        timeout: {
          type: 'number',
          description: 'Optional timeout in ms to wait for completion (0 = immediate)',
          default: 0,
        },
      },
      required: ['task_id'],
    },

    async execute(params) {
      const taskId = params.task_id as string;
      const timeout = params.timeout as number ?? 0;
      const executor = getExecutor();

      if (!executor) {
        return {
          error: 'Background execution not available',
          taskId,
        };
      }

      const tasks = executor.getBackgroundTasks();
      const task = tasks.find(t => t.backgroundId === taskId);

      if (!task) {
        return {
          error: 'Task not found',
          taskId,
        };
      }

      // If task has result, return it
      if (task.result) {
        return {
          taskId,
          status: task.status,
          result: task.result,
          durationMs: task.completedAt && task.startedAt
            ? task.completedAt.getTime() - task.startedAt.getTime()
            : undefined,
        };
      }

      // Task still running
      return {
        taskId,
        status: task.status,
        message: 'Task still running. Check back later or provide a timeout.',
        startedAt: task.startedAt?.toISOString(),
      };
    },
  };
}

/**
 * background_cancel - Cancel a background task
 */
function createBackgroundCancelTool(
  getExecutor: () => ParallelExecutor | null
): Tool {
  return {
    name: 'background_cancel',
    description: 'Cancel a running background task or all tasks.',

    parameters: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'The task_id to cancel (omit to cancel all)',
        },
        all: {
          type: 'boolean',
          description: 'If true, cancel all running background tasks',
          default: false,
        },
      },
    },

    async execute(params) {
      const taskId = params.task_id as string | undefined;
      const cancelAll = params.all as boolean ?? false;
      const executor = getExecutor();

      if (!executor) {
        return {
          error: 'Background execution not available',
        };
      }

      if (cancelAll) {
        await executor.cancelAll();
        return {
          status: 'cancelled',
          message: 'All background tasks cancelled',
        };
      }

      if (!taskId) {
        return {
          error: 'Provide task_id or set all=true',
        };
      }

      await executor.cancelBackground(taskId);
      return {
        status: 'cancelled',
        taskId,
        message: `Task ${taskId} cancelled`,
      };
    },
  };
}
