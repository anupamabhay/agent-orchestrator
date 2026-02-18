/**
 * Parallel Execution Engine
 * 
 * Manages parallel and sequential task execution with background support
 */

import type {
  AgentId,
  BackgroundHandle,
  BackgroundTask,
  ExecutionConfig,
  Task,
  TaskResult,
  TaskStatus,
} from '../types/index.js';

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  parallelLimit: 5,
  timeoutMs: 300000, // 5 minutes
  retryAttempts: 2,
  retryDelayMs: 1000,
};

// ============================================================================
// Task Executor Interface
// ============================================================================

export interface TaskExecutor {
  execute(agent: AgentId, prompt: string): Promise<TaskResult>;
}

// ============================================================================
// Parallel Execution Engine
// ============================================================================

export class ParallelExecutor {
  private config: ExecutionConfig;
  private executor: TaskExecutor;
  private activeTasks: Map<string, { task: Task; abortController: AbortController }>;
  private backgroundTasks: Map<string, BackgroundTask>;

  constructor(executor: TaskExecutor, config: Partial<ExecutionConfig> = {}) {
    this.config = { ...DEFAULT_EXECUTION_CONFIG, ...config };
    this.executor = executor;
    this.activeTasks = new Map();
    this.backgroundTasks = new Map();
  }

  /**
   * Execute multiple tasks in parallel, respecting the parallel limit
   */
  async executeParallel(tasks: Task[]): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    const pending = [...tasks];

    while (pending.length > 0 || this.activeTasks.size > 0) {
      // Start new tasks up to the parallel limit
      while (pending.length > 0 && this.activeTasks.size < this.config.parallelLimit) {
        const task = pending.shift()!;
        this.startTask(task);
      }

      // Wait for at least one task to complete
      if (this.activeTasks.size > 0) {
        const completedResult = await this.waitForAnyTask();
        if (completedResult) {
          results.push(completedResult);
        }
      }
    }

    return results;
  }

  /**
   * Execute tasks sequentially
   */
  async executeSequential(tasks: Task[]): Promise<TaskResult[]> {
    const results: TaskResult[] = [];

    for (const task of tasks) {
      const result = await this.executeSingleTask(task);
      results.push(result);

      // Stop on failure unless configured otherwise
      if (!result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * Launch a task in the background
   */
  launchBackground(task: Task, notifyOnComplete: boolean = true): BackgroundHandle {
    const backgroundId = `bg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const backgroundTask: BackgroundTask = {
      ...task,
      backgroundId,
      notifyOnComplete,
    };

    this.backgroundTasks.set(backgroundId, backgroundTask);

    // Start execution asynchronously
    this.executeBackgroundTask(backgroundTask);

    return {
      taskId: backgroundId,
      status: () => this.getBackgroundStatus(backgroundId),
      cancel: () => this.cancelBackground(backgroundId),
      getResult: (timeoutMs) => this.getBackgroundResult(backgroundId, timeoutMs),
    };
  }

  /**
   * Get all active background tasks
   */
  getBackgroundTasks(): BackgroundTask[] {
    return Array.from(this.backgroundTasks.values());
  }

  /**
   * Cancel a specific background task
   */
  async cancelBackground(taskId: string): Promise<void> {
    const task = this.backgroundTasks.get(taskId);
    if (task) {
      task.status = 'cancelled';
      // Note: actual cancellation depends on the executor implementation
    }
  }

  /**
   * Cancel all running tasks
   */
  async cancelAll(): Promise<void> {
    for (const { abortController } of this.activeTasks.values()) {
      abortController.abort();
    }
    this.activeTasks.clear();

    for (const task of this.backgroundTasks.values()) {
      task.status = 'cancelled';
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private startTask(task: Task): void {
    const abortController = new AbortController();
    this.activeTasks.set(task.id, { task, abortController });
    
    task.status = 'running';
    task.startedAt = new Date();

    // Execute asynchronously
    this.executeSingleTask(task).then(result => {
      task.result = result;
      task.status = result.success ? 'completed' : 'failed';
      task.completedAt = new Date();
      this.activeTasks.delete(task.id);
    }).catch(error => {
      task.result = {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
      task.status = 'failed';
      task.completedAt = new Date();
      this.activeTasks.delete(task.id);
    });
  }

  private async executeSingleTask(task: Task): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      const result = await this.executeWithRetry(task);
      return {
        ...result,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  private async executeWithRetry(task: Task): Promise<TaskResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await Promise.race([
          this.executor.execute(task.agent, task.prompt),
          this.createTimeout(this.config.timeoutMs),
        ]);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelayMs * (attempt + 1));
        }
      }
    }

    throw lastError ?? new Error('Task execution failed');
  }

  private async waitForAnyTask(): Promise<TaskResult | null> {
    // Simple polling approach - in a real implementation,
    // this would use Promise.race or an event-based system
    while (this.activeTasks.size > 0) {
      for (const [taskId, { task }] of this.activeTasks) {
        if (task.result) {
          this.activeTasks.delete(taskId);
          return task.result;
        }
      }
      await this.delay(50);
    }
    return null;
  }

  private async executeBackgroundTask(task: BackgroundTask): Promise<void> {
    task.status = 'running';
    task.startedAt = new Date();

    try {
      const result = await this.executor.execute(task.agent, task.prompt);
      task.result = result;
      task.status = result.success ? 'completed' : 'failed';
    } catch (error) {
      task.result = {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
      task.status = 'failed';
    }

    task.completedAt = new Date();
  }

  private async getBackgroundStatus(taskId: string): Promise<TaskStatus> {
    const task = this.backgroundTasks.get(taskId);
    return task?.status ?? 'pending';
  }

  private async getBackgroundResult(
    taskId: string,
    timeoutMs?: number
  ): Promise<TaskResult | null> {
    const startTime = Date.now();
    const timeout = timeoutMs ?? 0;

    while (true) {
      const task = this.backgroundTasks.get(taskId);
      
      if (!task) {
        return null;
      }

      if (task.result) {
        return task.result;
      }

      if (timeout > 0 && Date.now() - startTime > timeout) {
        return null;
      }

      if (timeout === 0) {
        return null;
      }

      await this.delay(100);
    }
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Task timeout')), ms);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Result Aggregation
// ============================================================================

export interface AggregatedResult {
  success: boolean;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  results: TaskResult[];
  summary: string;
}

export function aggregateResults(results: TaskResult[]): AggregatedResult {
  const completedTasks = results.filter(r => r.success).length;
  const failedTasks = results.length - completedTasks;

  return {
    success: failedTasks === 0,
    totalTasks: results.length,
    completedTasks,
    failedTasks,
    results,
    summary: `${completedTasks}/${results.length} tasks completed successfully`,
  };
}

// ============================================================================
// Factory
// ============================================================================

export function createParallelExecutor(
  executor: TaskExecutor,
  config?: Partial<ExecutionConfig>
): ParallelExecutor {
  return new ParallelExecutor(executor, config);
}
