/**
 * Tests for Agent Registry and Definitions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  AgentRegistryImpl, 
  createAgentRegistry, 
  formatAgentDescriptions,
  resolveModel 
} from '../agents/registry.js';
import { DEFAULT_AGENTS, getDefaultAgent, getAllDefaultAgents } from '../agents/definitions.js';
import type { AgentDefinition, OrchestratorConfig } from '../types/index.js';

describe('Agent Definitions', () => {
  describe('DEFAULT_AGENTS', () => {
    it('should have 8 agents defined', () => {
      const agents = Object.keys(DEFAULT_AGENTS);
      expect(agents).toHaveLength(8);
      expect(agents).toContain('orchestrator');
      expect(agents).toContain('planner');
      expect(agents).toContain('advisor');
      expect(agents).toContain('builder');
      expect(agents).toContain('worker');
      expect(agents).toContain('researcher');
      expect(agents).toContain('scanner');
      expect(agents).toContain('designer');
    });

    it('should have orchestrator as primary mode', () => {
      expect(DEFAULT_AGENTS.orchestrator.mode).toBe('primary');
    });

    it('should have all other agents as subagent mode', () => {
      const subagents = ['planner', 'advisor', 'builder', 'worker', 'researcher', 'scanner', 'designer'];
      for (const id of subagents) {
        expect(DEFAULT_AGENTS[id as keyof typeof DEFAULT_AGENTS].mode).toBe('subagent');
      }
    });

    it('should have researcher using gemini-3-flash', () => {
      expect(DEFAULT_AGENTS.researcher.model.provider).toBe('google');
      expect(DEFAULT_AGENTS.researcher.model.model).toBe('gemini-3-flash');
    });

    it('should have builder using gpt-5.3-codex', () => {
      expect(DEFAULT_AGENTS.builder.model.provider).toBe('openai');
      expect(DEFAULT_AGENTS.builder.model.model).toBe('gpt-5.3-codex');
    });

    it('should have orchestrator with todoEnforcer enabled', () => {
      expect(DEFAULT_AGENTS.orchestrator.todoEnforcer).toBe(true);
    });

    it('should have valid model specs for all agents', () => {
      for (const agent of Object.values(DEFAULT_AGENTS)) {
        expect(agent.model).toBeDefined();
        expect(agent.model.provider).toBeTruthy();
        expect(agent.model.model).toBeTruthy();
        expect(agent.fallbacks).toBeDefined();
        expect(Array.isArray(agent.fallbacks)).toBe(true);
      }
    });
  });

  describe('getDefaultAgent', () => {
    it('should return orchestrator agent', () => {
      const agent = getDefaultAgent('orchestrator');
      expect(agent.id).toBe('orchestrator');
      expect(agent.name).toBe('Orchestrator');
    });

    it('should return scanner agent', () => {
      const agent = getDefaultAgent('scanner');
      expect(agent.id).toBe('scanner');
      expect(agent.name).toBe('Scanner');
    });
  });

  describe('getAllDefaultAgents', () => {
    it('should return array of all agents', () => {
      const agents = getAllDefaultAgents();
      expect(agents).toHaveLength(8);
      expect(agents.every(a => a.id && a.name && a.description)).toBe(true);
    });
  });
});

describe('Agent Registry', () => {
  let registry: AgentRegistryImpl;

  beforeEach(() => {
    registry = new AgentRegistryImpl();
  });

  describe('constructor', () => {
    it('should load all default agents', () => {
      expect(registry.agents.size).toBe(8);
    });

    it('should apply config overrides', () => {
      const config: Partial<OrchestratorConfig> = {
        agents: {
          scanner: {
            temperature: 0.5,
          },
        },
      };
      const customRegistry = new AgentRegistryImpl(config);
      const scanner = customRegistry.get('scanner');
      expect(scanner?.temperature).toBe(0.5);
    });

    it('should remove disabled agents', () => {
      const config: Partial<OrchestratorConfig> = {
        disabled: {
          agents: ['designer'],
          hooks: [],
          mcps: [],
        },
      };
      const customRegistry = new AgentRegistryImpl(config);
      expect(customRegistry.get('designer')).toBeUndefined();
      expect(customRegistry.agents.size).toBe(7);
    });
  });

  describe('get', () => {
    it('should return existing agent', () => {
      const agent = registry.get('orchestrator');
      expect(agent).toBeDefined();
      expect(agent?.id).toBe('orchestrator');
    });

    it('should return undefined for non-existent agent', () => {
      const agent = registry.get('nonexistent' as any);
      expect(agent).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all agents', () => {
      const agents = registry.getAll();
      expect(agents).toHaveLength(8);
    });
  });

  describe('getPrimary', () => {
    it('should return only primary agents', () => {
      const primary = registry.getPrimary();
      expect(primary).toHaveLength(1);
      expect(primary[0].id).toBe('orchestrator');
    });
  });

  describe('getSubagents', () => {
    it('should return only subagents', () => {
      const subagents = registry.getSubagents();
      expect(subagents).toHaveLength(7);
      expect(subagents.every(a => a.mode === 'subagent')).toBe(true);
    });

    it('should exclude hidden agents', () => {
      const config: Partial<OrchestratorConfig> = {
        agents: {
          worker: {
            hidden: true,
          },
        },
      };
      const customRegistry = new AgentRegistryImpl(config);
      const subagents = customRegistry.getSubagents();
      expect(subagents.find(a => a.id === 'worker')).toBeUndefined();
    });
  });

  describe('getForDelegation', () => {
    it('should return subagents suitable for delegation', () => {
      const delegatable = registry.getForDelegation();
      expect(delegatable.every(a => a.mode === 'subagent')).toBe(true);
      expect(delegatable.find(a => a.id === 'orchestrator')).toBeUndefined();
    });
  });
});

describe('createAgentRegistry', () => {
  it('should create registry without config', () => {
    const registry = createAgentRegistry();
    expect(registry.agents.size).toBe(8);
  });

  it('should create registry with config', () => {
    const registry = createAgentRegistry({
      agents: {
        builder: { temperature: 0.1 },
      },
    });
    expect(registry.get('builder')?.temperature).toBe(0.1);
  });
});

describe('formatAgentDescriptions', () => {
  it('should format agent descriptions for prompt injection', () => {
    const registry = createAgentRegistry();
    const formatted = formatAgentDescriptions(registry);
    
    expect(formatted).toContain('## Available Subagents');
    expect(formatted).toContain('@scanner');
    expect(formatted).toContain('@researcher');
    expect(formatted).toContain('@advisor');
  });
});

describe('resolveModel', () => {
  it('should return primary model when available', async () => {
    const agent = getDefaultAgent('scanner');
    const isAvailable = async (provider: string, model: string) => {
      return provider === 'anthropic' && model === 'claude-haiku-4-5';
    };

    const result = await resolveModel(agent, isAvailable);
    expect(result).toEqual({
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
    });
  });

  it('should return fallback when primary unavailable', async () => {
    const agent = getDefaultAgent('scanner');
    const isAvailable = async (provider: string, model: string) => {
      // Primary unavailable, first fallback available
      return provider === 'openai' && model === 'gpt-5-mini';
    };

    const result = await resolveModel(agent, isAvailable);
    expect(result).toEqual({
      provider: 'openai',
      model: 'gpt-5-mini',
    });
  });

  it('should return null when no models available', async () => {
    const agent = getDefaultAgent('builder');
    const isAvailable = async () => false;

    const result = await resolveModel(agent, isAvailable);
    expect(result).toBeNull();
  });

  it('should try fallbacks in order', async () => {
    const agent = getDefaultAgent('orchestrator');
    const checkedModels: string[] = [];
    
    const isAvailable = async (provider: string, model: string) => {
      checkedModels.push(`${provider}/${model}`);
      // Only the third fallback is available
      return provider === 'google' && model === 'gemini-3-pro';
    };

    const result = await resolveModel(agent, isAvailable);
    
    // Should check primary first, then fallbacks in order
    expect(checkedModels[0]).toBe('anthropic/claude-opus-4-5');
    expect(checkedModels[1]).toBe('moonshot/kimi-k2.5');
    expect(checkedModels[2]).toBe('openai/gpt-5.3-codex');
    expect(checkedModels[3]).toBe('google/gemini-3-pro');
    
    expect(result).toEqual({
      provider: 'google',
      model: 'gemini-3-pro',
    });
  });
});
