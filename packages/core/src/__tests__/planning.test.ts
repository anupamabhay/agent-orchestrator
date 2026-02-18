/**
 * Tests for Task Planning Module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectKeywords,
  analyzeIntent,
  decomposeTask,
  createTaskPlan,
  createDelegation,
  formatDelegationPrompt,
} from '../planning/index.js';
import { createAgentRegistry } from '../agents/registry.js';
import type { AgentRegistry, Task } from '../types/index.js';

describe('Keyword Detection', () => {
  describe('detectKeywords', () => {
    it('should detect ultrawork keyword', () => {
      const matches = detectKeywords('ultrawork implement the feature');
      expect(matches).toHaveLength(1);
      expect(matches[0].mode).toBe('ultrawork');
    });

    it('should detect ulw alias', () => {
      const matches = detectKeywords('ulw build the auth system');
      expect(matches).toHaveLength(1);
      expect(matches[0].mode).toBe('ultrawork');
    });

    it('should detect parallel keyword', () => {
      const matches = detectKeywords('parallel create both components');
      expect(matches).toHaveLength(1);
      expect(matches[0].mode).toBe('parallel');
    });

    it('should detect || syntax', () => {
      const matches = detectKeywords('|| run these tasks');
      expect(matches).toHaveLength(1);
      expect(matches[0].mode).toBe('parallel');
    });

    it('should detect think keyword', () => {
      const matches = detectKeywords('think about this architecture');
      expect(matches).toHaveLength(1);
      expect(matches[0].mode).toBe('think');
    });

    it('should detect research keyword', () => {
      const matches = detectKeywords('research JWT best practices');
      expect(matches).toHaveLength(1);
      expect(matches[0].mode).toBe('research');
    });

    it('should detect debug keyword', () => {
      const matches = detectKeywords('debug the authentication error');
      expect(matches).toHaveLength(1);
      expect(matches[0].mode).toBe('debug');
    });

    it('should detect multiple keywords', () => {
      const matches = detectKeywords('ultrawork research and debug this');
      expect(matches.length).toBeGreaterThan(1);
      expect(matches.map(m => m.mode)).toContain('ultrawork');
      expect(matches.map(m => m.mode)).toContain('research');
      expect(matches.map(m => m.mode)).toContain('debug');
    });

    it('should return empty array for no keywords', () => {
      const matches = detectKeywords('just a normal prompt');
      expect(matches).toHaveLength(0);
    });

    it('should be case insensitive', () => {
      const matches1 = detectKeywords('ULTRAWORK do this');
      const matches2 = detectKeywords('UltraWork do this');
      expect(matches1[0].mode).toBe('ultrawork');
      expect(matches2[0].mode).toBe('ultrawork');
    });
  });
});

describe('Intent Analysis', () => {
  describe('analyzeIntent', () => {
    it('should detect explore intent', () => {
      const analysis = analyzeIntent('find all authentication files');
      expect(analysis.primary).toBe('explore');
      expect(analysis.suggestedAgents).toContain('scanner');
    });

    it('should detect research intent', () => {
      const analysis = analyzeIntent('how does React useEffect work?');
      expect(analysis.primary).toBe('research');
      expect(analysis.suggestedAgents).toContain('researcher');
    });

    it('should detect review intent', () => {
      const analysis = analyzeIntent('review the architecture of auth module');
      expect(analysis.primary).toBe('review');
      expect(analysis.suggestedAgents).toContain('advisor');
    });

    it('should detect implement intent', () => {
      const analysis = analyzeIntent('implement user authentication');
      expect(analysis.primary).toBe('implement');
      expect(analysis.suggestedAgents).toContain('builder');
    });

    it('should detect debug intent', () => {
      const analysis = analyzeIntent('fix the login error');
      expect(analysis.primary).toBe('debug');
      expect(analysis.suggestedAgents).toContain('advisor');
    });

    it('should detect design intent', () => {
      const analysis = analyzeIntent('style the button component');
      expect(analysis.primary).toBe('design');
      expect(analysis.suggestedAgents).toContain('designer');
    });

    it('should detect plan intent', () => {
      const analysis = analyzeIntent('plan the implementation steps');
      expect(analysis.primary).toBe('plan');
      expect(analysis.suggestedAgents).toContain('planner');
    });

    it('should detect compound intent with multiple matches', () => {
      const analysis = analyzeIntent('research best practices and implement auth');
      expect(analysis.primary).toBe('compound');
      expect(analysis.secondary.length).toBeGreaterThan(1);
      expect(analysis.isParallelizable).toBe(true);
    });

    it('should default to implement for unknown intents', () => {
      const analysis = analyzeIntent('do something');
      expect(analysis.primary).toBe('implement');
      expect(analysis.suggestedAgents).toContain('orchestrator');
    });
  });
});

describe('Task Decomposition', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = createAgentRegistry();
  });

  describe('decomposeTask', () => {
    it('should create ultrawork tasks when keyword present', () => {
      const result = decomposeTask('ultrawork implement auth', registry);
      expect(result.parallelizable).toBe(true);
      expect(result.tasks.length).toBe(3); // scanner, researcher, advisor
      expect(result.tasks.map(t => t.agent)).toContain('scanner');
      expect(result.tasks.map(t => t.agent)).toContain('researcher');
      expect(result.tasks.map(t => t.agent)).toContain('advisor');
    });

    it('should create parallel tasks when keyword present', () => {
      const result = decomposeTask('parallel find files and look up docs', registry);
      expect(result.parallelizable).toBe(true);
    });

    it('should create single task for simple intent', () => {
      const result = decomposeTask('find all tsx files', registry);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].agent).toBe('scanner');
      expect(result.parallelizable).toBe(false);
    });

    it('should generate unique task IDs', () => {
      const result1 = decomposeTask('task one', registry);
      const result2 = decomposeTask('task two', registry);
      expect(result1.tasks[0].id).not.toBe(result2.tasks[0].id);
    });

    it('should set initial task status to pending', () => {
      const result = decomposeTask('implement feature', registry);
      expect(result.tasks.every(t => t.status === 'pending')).toBe(true);
    });

    it('should include prompt in tasks', () => {
      const prompt = 'find all authentication files';
      const result = decomposeTask(prompt, registry);
      expect(result.tasks[0].prompt).toContain('authentication');
    });
  });
});

describe('Task Plan Creation', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = createAgentRegistry();
  });

  describe('createTaskPlan', () => {
    it('should create plan with unique ID', () => {
      const plan1 = createTaskPlan('task one', registry);
      const plan2 = createTaskPlan('task two', registry);
      expect(plan1.id).toBeTruthy();
      expect(plan1.id).not.toBe(plan2.id);
    });

    it('should preserve original prompt', () => {
      const prompt = 'implement user authentication';
      const plan = createTaskPlan(prompt, registry);
      expect(plan.originalPrompt).toBe(prompt);
    });

    it('should put parallel tasks in parallelizable array', () => {
      const plan = createTaskPlan('ultrawork build auth', registry);
      expect(plan.parallelizable.length).toBeGreaterThan(0);
      expect(plan.sequential).toHaveLength(0);
    });

    it('should put sequential tasks in sequential array', () => {
      const plan = createTaskPlan('find tsx files', registry);
      expect(plan.sequential.length).toBeGreaterThan(0);
      expect(plan.parallelizable).toHaveLength(0);
    });

    it('should initialize empty delegations array', () => {
      const plan = createTaskPlan('some task', registry);
      expect(plan.delegations).toEqual([]);
    });
  });
});

describe('Delegation', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = createAgentRegistry();
  });

  describe('createDelegation', () => {
    it('should create delegation with all fields', () => {
      const task: Task = {
        id: 'test_task',
        agent: 'scanner',
        prompt: 'find files',
        status: 'pending',
        dependencies: [],
        createdAt: new Date(),
      };

      const delegation = createDelegation(
        'orchestrator',
        'scanner',
        task,
        'Need to explore codebase'
      );

      expect(delegation.fromAgent).toBe('orchestrator');
      expect(delegation.toAgent).toBe('scanner');
      expect(delegation.task).toBe(task);
      expect(delegation.reason).toBe('Need to explore codebase');
    });
  });

  describe('formatDelegationPrompt', () => {
    it('should format delegation for agent consumption', () => {
      const task: Task = {
        id: 'test_task',
        agent: 'researcher',
        prompt: 'Look up JWT best practices',
        status: 'pending',
        dependencies: [],
        createdAt: new Date(),
      };

      const delegation = createDelegation(
        'orchestrator',
        'researcher',
        task,
        'Need documentation'
      );

      const formatted = formatDelegationPrompt(delegation);

      expect(formatted).toContain('[Delegated from @orchestrator]');
      expect(formatted).toContain('Reason: Need documentation');
      expect(formatted).toContain('Look up JWT best practices');
    });
  });
});
