/**
 * Agent Registry - manages agent definitions and lookups
 */

import type { AgentDefinition, AgentId, AgentRegistry, OrchestratorConfig } from '../types/index.js';
import { DEFAULT_AGENTS, getAllDefaultAgents } from './definitions.js';

export class AgentRegistryImpl implements AgentRegistry {
  agents: Map<AgentId, AgentDefinition>;

  constructor(config?: Partial<OrchestratorConfig>) {
    this.agents = new Map();
    
    // Load default agents
    for (const agent of getAllDefaultAgents()) {
      this.agents.set(agent.id, agent);
    }

    // Apply config overrides
    if (config?.agents) {
      for (const [id, overrides] of Object.entries(config.agents)) {
        const agentId = id as AgentId;
        const existing = this.agents.get(agentId);
        if (existing && overrides) {
          this.agents.set(agentId, this.mergeAgent(existing, overrides));
        }
      }
    }

    // Remove disabled agents
    if (config?.disabled?.agents) {
      for (const disabledId of config.disabled.agents) {
        this.agents.delete(disabledId);
      }
    }
  }

  private mergeAgent(
    base: AgentDefinition,
    overrides: Partial<AgentDefinition>
  ): AgentDefinition {
    return {
      ...base,
      ...overrides,
      model: overrides.model ?? base.model,
      fallbacks: overrides.fallbacks ?? base.fallbacks,
      tools: { ...base.tools, ...overrides.tools },
    };
  }

  get(id: AgentId): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  getAll(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  getPrimary(): AgentDefinition[] {
    return this.getAll().filter(a => a.mode === 'primary');
  }

  getSubagents(): AgentDefinition[] {
    return this.getAll().filter(a => a.mode === 'subagent' && !a.hidden);
  }

  getForDelegation(): AgentDefinition[] {
    return this.getAll().filter(a => 
      a.mode === 'subagent' && 
      !a.hidden && 
      a.id !== 'orchestrator'
    );
  }
}

/**
 * Create an agent registry with optional config overrides
 */
export function createAgentRegistry(config?: Partial<OrchestratorConfig>): AgentRegistry {
  return new AgentRegistryImpl(config);
}

/**
 * Format agent descriptions for injection into prompts
 */
export function formatAgentDescriptions(registry: AgentRegistry): string {
  const subagents = registry.getSubagents();
  
  const lines = subagents.map(agent => 
    `- **@${agent.id}**: ${agent.description}`
  );
  
  return `## Available Subagents\n${lines.join('\n')}`;
}

/**
 * Get the model to use for an agent, respecting fallback chain
 */
export async function resolveModel(
  agent: AgentDefinition,
  isAvailable: (provider: string, model: string) => Promise<boolean>
): Promise<{ provider: string; model: string } | null> {
  // Try primary model
  if (await isAvailable(agent.model.provider, agent.model.model)) {
    return { provider: agent.model.provider, model: agent.model.model };
  }

  // Try fallbacks in order
  for (const fallback of agent.fallbacks) {
    if (await isAvailable(fallback.provider, fallback.model)) {
      return { provider: fallback.provider, model: fallback.model };
    }
  }

  return null;
}
