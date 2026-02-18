/**
 * Tests for Context Management Module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  estimateTokens,
  truncateToTokens,
  truncateOutput,
  ContextTracker,
  AgentsMdInjector,
  buildInjectedContext,
  createContextTracker,
  createAgentsMdInjector,
  DEFAULT_CONTEXT_CONFIG,
} from '../context/index.js';

describe('Token Estimation', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      // 4 chars per token average
      expect(estimateTokens('test')).toBe(1);
      expect(estimateTokens('testtest')).toBe(2);
      expect(estimateTokens('a'.repeat(100))).toBe(25);
    });

    it('should round up for partial tokens', () => {
      expect(estimateTokens('abc')).toBe(1); // 3 chars = 0.75 tokens, rounds to 1
      expect(estimateTokens('abcde')).toBe(2); // 5 chars = 1.25 tokens, rounds to 2
    });

    it('should handle empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });
  });

  describe('truncateToTokens', () => {
    it('should not truncate if within limit', () => {
      const text = 'short text';
      const result = truncateToTokens(text, 100);
      expect(result).toBe(text);
    });

    it('should truncate if over limit', () => {
      const text = 'a'.repeat(1000); // ~250 tokens
      const result = truncateToTokens(text, 50);
      expect(result.length).toBeLessThan(text.length);
      expect(result).toContain('[... truncated');
    });

    it('should indicate truncated token count', () => {
      const text = 'a'.repeat(1000);
      const result = truncateToTokens(text, 50);
      expect(result).toMatch(/\[... truncated \d+ tokens .../);
    });
  });
});

describe('Output Truncation', () => {
  describe('truncateOutput', () => {
    it('should not truncate output within limit', () => {
      const output = 'line 1\nline 2\nline 3';
      const result = truncateOutput(output, { maxTokens: 100 });
      expect(result).toBe(output);
    });

    it('should preserve start and end of long output', () => {
      const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
      const output = lines.join('\n');
      
      const result = truncateOutput(output, {
        maxTokens: 50,
        preserveStart: 500,
        preserveEnd: 200,
      });

      expect(result).toContain('line 1');
      expect(result).toContain('line 100');
      expect(result).toContain('[...');
      expect(result).toContain('omitted');
    });

    it('should show omitted line and token count', () => {
      const lines = Array.from({ length: 200 }, (_, i) => 'x'.repeat(100));
      const output = lines.join('\n');
      
      const result = truncateOutput(output, {
        maxTokens: 100,
        preserveStart: 500,
        preserveEnd: 200,
      });

      expect(result).toMatch(/\[\.\.\. \d+ lines \(~\d+ tokens\) omitted \.\.\.\]/);
    });

    it('should use default options when not specified', () => {
      const output = 'a'.repeat(1000000); // Very long
      const result = truncateOutput(output);
      expect(result.length).toBeLessThan(output.length);
    });
  });
});

describe('Context Tracker', () => {
  let tracker: ContextTracker;

  beforeEach(() => {
    tracker = new ContextTracker(100000); // 100k token limit
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const usage = tracker.getUsage();
      expect(usage.limit).toBe(100000);
      expect(usage.used).toBe(0);
    });

    it('should accept custom config', () => {
      const customTracker = new ContextTracker(50000, {
        headroomPercentage: 30,
      });
      const usage = customTracker.getUsage();
      expect(usage.limit).toBe(50000);
      expect(usage.headroom).toBe(15000); // 30% of 50k
    });
  });

  describe('addUsage', () => {
    it('should add to usage count', () => {
      tracker.addUsage(1000);
      expect(tracker.getUsage().used).toBe(1000);
      
      tracker.addUsage(500);
      expect(tracker.getUsage().used).toBe(1500);
    });
  });

  describe('setUsage', () => {
    it('should set usage to specific value', () => {
      tracker.addUsage(5000);
      tracker.setUsage(2000);
      expect(tracker.getUsage().used).toBe(2000);
    });
  });

  describe('getUsage', () => {
    it('should calculate percentage correctly', () => {
      tracker.setUsage(50000);
      const usage = tracker.getUsage();
      expect(usage.percentage).toBe(50);
    });

    it('should calculate headroom based on config', () => {
      // Default is 50% headroom
      const usage = tracker.getUsage();
      expect(usage.headroom).toBe(50000);
    });
  });

  describe('needsCompaction', () => {
    it('should return false when below threshold', () => {
      tracker.setUsage(50000); // 50% of 100k
      expect(tracker.needsCompaction()).toBe(false);
    });

    it('should return true when at or above threshold', () => {
      tracker.setUsage(80000); // 80% (default threshold)
      expect(tracker.needsCompaction()).toBe(true);
    });

    it('should respect custom threshold', () => {
      const customTracker = new ContextTracker(100000, {
        preemptiveCompactionThreshold: 60,
      });
      customTracker.setUsage(60000);
      expect(customTracker.needsCompaction()).toBe(true);
    });
  });

  describe('getMaxToolOutputTokens', () => {
    it('should calculate available space for tool output', () => {
      // 100k limit, 50% headroom = 50k headroom
      // Used: 0
      // Available: 100k - 0 - 50k = 50k
      // But capped at maxToolOutputTokens (default 50k)
      const maxTokens = tracker.getMaxToolOutputTokens();
      expect(maxTokens).toBe(50000);
    });

    it('should return less when context is partially used', () => {
      tracker.setUsage(30000);
      // Available: 100k - 30k - 50k = 20k
      const maxTokens = tracker.getMaxToolOutputTokens();
      expect(maxTokens).toBe(20000);
    });

    it('should return 0 when context is full', () => {
      tracker.setUsage(90000);
      // Available: 100k - 90k - 50k = -40k (clamped to 0)
      const maxTokens = tracker.getMaxToolOutputTokens();
      expect(maxTokens).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset usage to 0', () => {
      tracker.setUsage(50000);
      tracker.reset();
      expect(tracker.getUsage().used).toBe(0);
    });
  });
});

describe('AgentsMd Injector', () => {
  let injector: AgentsMdInjector;

  beforeEach(() => {
    injector = new AgentsMdInjector();
  });

  describe('getAgentsContext', () => {
    it('should return all content on first call', () => {
      const contents = new Map([
        ['/project/AGENTS.md', 'Project rules'],
        ['/project/src/AGENTS.md', 'Src rules'],
      ]);

      const result = injector.getAgentsContext('/project/src/file.ts', contents);
      expect(result).toHaveLength(2);
      expect(result).toContain('Project rules');
      expect(result).toContain('Src rules');
    });

    it('should deduplicate on subsequent calls', () => {
      const contents = new Map([
        ['/project/AGENTS.md', 'Project rules'],
      ]);

      // First call
      injector.getAgentsContext('/project/src/file.ts', contents);
      
      // Second call with same content
      const result = injector.getAgentsContext('/project/src/other.ts', contents);
      expect(result).toHaveLength(0); // Already injected
    });

    it('should inject new content not yet seen', () => {
      const contents1 = new Map([
        ['/project/AGENTS.md', 'Project rules'],
      ]);
      const contents2 = new Map([
        ['/project/AGENTS.md', 'Project rules'],
        ['/project/src/AGENTS.md', 'Src rules'],
      ]);

      injector.getAgentsContext('/project/file.ts', contents1);
      const result = injector.getAgentsContext('/project/src/file.ts', contents2);
      
      expect(result).toHaveLength(1);
      expect(result).toContain('Src rules');
    });

    it('should respect deduplication config', () => {
      const noDedupInjector = new AgentsMdInjector({
        deduplicateAgentsMd: false,
      });

      const contents = new Map([
        ['/project/AGENTS.md', 'Project rules'],
      ]);

      noDedupInjector.getAgentsContext('/project/src/file.ts', contents);
      const result = noDedupInjector.getAgentsContext('/project/src/other.ts', contents);
      
      expect(result).toHaveLength(1); // Returns all, no dedup
    });
  });

  describe('reset', () => {
    it('should clear injection history', () => {
      const contents = new Map([
        ['/project/AGENTS.md', 'Project rules'],
      ]);

      injector.getAgentsContext('/project/file.ts', contents);
      injector.reset();
      
      const result = injector.getAgentsContext('/project/file.ts', contents);
      expect(result).toHaveLength(1); // Returns again after reset
    });
  });
});

describe('Context Builder', () => {
  describe('buildInjectedContext', () => {
    it('should create empty context by default', () => {
      const context = buildInjectedContext();
      expect(context.agentsMd).toEqual([]);
      expect(context.rules).toEqual([]);
      expect(context.memory).toEqual([]);
    });

    it('should respect options', () => {
      const context = buildInjectedContext({
        includeAgentsMd: false,
      });
      expect(context.agentsMd).toEqual([]);
    });
  });
});

describe('Factory Functions', () => {
  describe('createContextTracker', () => {
    it('should create tracker with limit', () => {
      const tracker = createContextTracker(50000);
      expect(tracker.getUsage().limit).toBe(50000);
    });

    it('should accept config', () => {
      const tracker = createContextTracker(50000, {
        headroomPercentage: 25,
      });
      expect(tracker.getUsage().headroom).toBe(12500);
    });
  });

  describe('createAgentsMdInjector', () => {
    it('should create injector', () => {
      const injector = createAgentsMdInjector();
      expect(injector).toBeInstanceOf(AgentsMdInjector);
    });
  });
});

describe('DEFAULT_CONTEXT_CONFIG', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_CONTEXT_CONFIG.maxToolOutputTokens).toBe(50000);
    expect(DEFAULT_CONTEXT_CONFIG.headroomPercentage).toBe(50);
    expect(DEFAULT_CONTEXT_CONFIG.preemptiveCompactionThreshold).toBe(80);
    expect(DEFAULT_CONTEXT_CONFIG.aggressiveTruncation).toBe(false);
    expect(DEFAULT_CONTEXT_CONFIG.deduplicateAgentsMd).toBe(true);
  });
});
