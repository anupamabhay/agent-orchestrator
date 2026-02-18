/**
 * Tests for Parallel Execution Engine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ParallelExecutor,
  createParallelExecutor,
  aggregateResults,
  DEFAULT_EXECUTION_CONFIG,
  type TaskExecutor,
} from '../execution/index.js';
import type { Task, TaskResult } from '../types/index.js';

// Mock executor for testing
function createMockExecutor(
  results: Map<string, TaskResult> = new Map(),
  delay: number = 10
): TaskExecutor {
  return {
    async execute(agent, prompt) {
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const key = `${agent}:${prompt}`;
      const result = results.get(key);
      
      if (result) {
        return result;
      }

      return {
        success: true,
        output: `Executed ${agent}: ${prompt}`,
      };
    },
  };
}

function createTask(agent: string, prompt: string): Task {
  return {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    agent: agent as any,
    prompt,
    status: 'pending',
    dependencies: [],
    createdAt: new Date(),
  };
}

describe('ParallelExecutor', () => {
  let executor: ParallelExecutor;
  let mockTaskExecutor: TaskExecutor;

  beforeEach(() => {
    mockTaskExecutor = createMockExecutor();
    executor = new ParallelExecutor(mockTaskExecutor);
  });

  describe('constructor', () => {
    it('should use default config when none provided', () => {
      const exec = new ParallelExecutor(mockTaskExecutor);
      expect(exec).toBeDefined();
    });

    it('should merge custom config with defaults', () => {
      const exec = new ParallelExecutor(mockTaskExecutor, {
        parallelLimit: 10,
      });
      expect(exec).toBeDefined();
    });
  });

  describe('executeParallel', () => {
    it('should execute multiple tasks', async () => {
      const tasks = [
        createTask('scanner', 'find files'),
        createTask('researcher', 'look up docs'),
      ];

      const results = await executor.executeParallel(tasks);
      
      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should respect parallel limit', async () => {
      const limitedExecutor = new ParallelExecutor(mockTaskExecutor, {
        parallelLimit: 2,
      });

      const tasks = [
        createTask('scanner', 'task 1'),
        createTask('scanner', 'task 2'),
        createTask('scanner', 'task 3'),
        createTask('scanner', 'task 4'),
      ];

      const results = await limitedExecutor.executeParallel(tasks);
      expect(results).toHaveLength(4);
    });

    it('should handle empty task array', async () => {
      const results = await executor.executeParallel([]);
      expect(results).toHaveLength(0);
    });

    it('should update task status during execution', async () => {
      const task = createTask('scanner', 'find files');
      expect(task.status).toBe('pending');

      const results = await executor.executeParallel([task]);
      
      expect(task.status).toBe('completed');
      expect(task.startedAt).toBeDefined();
      expect(task.completedAt).toBeDefined();
    });
  });

  describe('executeSequential', () => {
    it('should execute tasks one at a time', async () => {
      const tasks = [
        createTask('scanner', 'first'),
        createTask('researcher', 'second'),
      ];

      const results = await executor.executeSequential(tasks);
      
      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should stop on failure', async () => {
      const failResults = new Map<string, TaskResult>([
        ['scanner:will fail', { success: false, output: '', error: 'Test error' }],
      ]);
      const failExecutor = new ParallelExecutor(createMockExecutor(failResults));

      const tasks = [
        createTask('scanner', 'will fail'),
        createTask('researcher', 'wont run'),
      ];

      const results = await failExecutor.executeSequential(tasks);
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
    });

    it('should include duration in results', async () => {
      const tasks = [createTask('scanner', 'find files')];
      
      const results = await executor.executeSequential(tasks);
      
      expect(results[0].durationMs).toBeDefined();
      expect(results[0].durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('launchBackground', () => {
    it('should return a handle with taskId', () => {
      const task = createTask('scanner', 'background task');
      const handle = executor.launchBackground(task);
      
      expect(handle.taskId).toBeTruthy();
      expect(handle.taskId).toMatch(/^bg_/);
    });

    it('should provide status function', async () => {
      const task = createTask('scanner', 'background task');
      const handle = executor.launchBackground(task);
      
      const status = await handle.status();
      expect(['pending', 'running', 'completed']).toContain(status);
    });

    it('should provide cancel function', async () => {
      const task = createTask('scanner', 'background task');
      const handle = executor.launchBackground(task);
      
      await handle.cancel();
      const status = await handle.status();
      expect(status).toBe('cancelled');
    });

    it('should provide getResult function', async () => {
      const task = createTask('scanner', 'background task');
      const handle = executor.launchBackground(task);
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = await handle.getResult(1000);
      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
    });
  });

  describe('getBackgroundTasks', () => {
    it('should return all background tasks', () => {
      const task1 = createTask('scanner', 'bg task 1');
      const task2 = createTask('researcher', 'bg task 2');
      
      executor.launchBackground(task1);
      executor.launchBackground(task2);
      
      const tasks = executor.getBackgroundTasks();
      expect(tasks).toHaveLength(2);
    });
  });

  describe('cancelAll', () => {
    it('should cancel all active and background tasks', async () => {
      const task1 = createTask('scanner', 'bg task 1');
      const task2 = createTask('researcher', 'bg task 2');
      
      executor.launchBackground(task1);
      executor.launchBackground(task2);
      
      await executor.cancelAll();
      
      const tasks = executor.getBackgroundTasks();
      expect(tasks.every(t => t.status === 'cancelled')).toBe(true);
    });
  });
});

describe('aggregateResults', () => {
  it('should aggregate successful results', () => {
    const results: TaskResult[] = [
      { success: true, output: 'result 1' },
      { success: true, output: 'result 2' },
      { success: true, output: 'result 3' },
    ];

    const aggregated = aggregateResults(results);
    
    expect(aggregated.success).toBe(true);
    expect(aggregated.totalTasks).toBe(3);
    expect(aggregated.completedTasks).toBe(3);
    expect(aggregated.failedTasks).toBe(0);
    expect(aggregated.summary).toBe('3/3 tasks completed successfully');
  });

  it('should aggregate mixed results', () => {
    const results: TaskResult[] = [
      { success: true, output: 'result 1' },
      { success: false, output: '', error: 'error 1' },
      { success: true, output: 'result 3' },
    ];

    const aggregated = aggregateResults(results);
    
    expect(aggregated.success).toBe(false);
    expect(aggregated.totalTasks).toBe(3);
    expect(aggregated.completedTasks).toBe(2);
    expect(aggregated.failedTasks).toBe(1);
    expect(aggregated.summary).toBe('2/3 tasks completed successfully');
  });

  it('should handle empty results', () => {
    const aggregated = aggregateResults([]);
    
    expect(aggregated.success).toBe(true);
    expect(aggregated.totalTasks).toBe(0);
    expect(aggregated.completedTasks).toBe(0);
    expect(aggregated.failedTasks).toBe(0);
  });

  it('should include all original results', () => {
    const results: TaskResult[] = [
      { success: true, output: 'result 1', tokensUsed: 100 },
      { success: true, output: 'result 2', tokensUsed: 200 },
    ];

    const aggregated = aggregateResults(results);
    
    expect(aggregated.results).toHaveLength(2);
    expect(aggregated.results[0].tokensUsed).toBe(100);
  });
});

describe('createParallelExecutor', () => {
  it('should create executor with default config', () => {
    const mockExecutor = createMockExecutor();
    const executor = createParallelExecutor(mockExecutor);
    expect(executor).toBeInstanceOf(ParallelExecutor);
  });

  it('should create executor with custom config', () => {
    const mockExecutor = createMockExecutor();
    const executor = createParallelExecutor(mockExecutor, {
      parallelLimit: 10,
      timeoutMs: 60000,
    });
    expect(executor).toBeInstanceOf(ParallelExecutor);
  });
});

describe('DEFAULT_EXECUTION_CONFIG', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_EXECUTION_CONFIG.parallelLimit).toBe(5);
    expect(DEFAULT_EXECUTION_CONFIG.timeoutMs).toBe(300000);
    expect(DEFAULT_EXECUTION_CONFIG.retryAttempts).toBe(2);
    expect(DEFAULT_EXECUTION_CONFIG.retryDelayMs).toBe(1000);
  });
});
