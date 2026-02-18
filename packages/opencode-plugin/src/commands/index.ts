/**
 * Slash Commands for OpenCode
 */

import type { Command, OrchestratorConfig, AgentRegistry, AgentId } from '@orchestrator/core';
import { createTaskPlan, formatAgentDescriptions } from '@orchestrator/core';

export function createCommands(
  config: OrchestratorConfig,
  getRegistry: () => AgentRegistry | null
): Command[] {
  return [
    createOrchestrate(config, getRegistry),
    createParallel(config, getRegistry),
    createAgents(getRegistry),
    createUltrawork(config),
  ];
}

/**
 * /orchestrate - Analyze and delegate tasks to specialized agents
 */
function createOrchestrate(
  config: OrchestratorConfig,
  getRegistry: () => AgentRegistry | null
): Command {
  return {
    name: 'orchestrate',
    description: 'Analyze a task and delegate to specialized agents',
    
    async execute(args, context) {
      const prompt = args.join(' ');
      
      if (!prompt) {
        return 'Usage: /orchestrate <task description>';
      }

      const registry = getRegistry();
      if (!registry) {
        return 'Error: Agent registry not initialized';
      }

      // Create a task plan
      const plan = createTaskPlan(prompt, registry);

      // Format the plan for output
      const lines: string[] = [
        '# Task Analysis',
        '',
        `**Original Request:** ${prompt}`,
        '',
        '## Execution Plan',
        '',
      ];

      if (plan.parallelizable.length > 0) {
        lines.push('### Parallel Tasks (can run simultaneously):');
        for (const task of plan.parallelizable) {
          lines.push(`- **@${task.agent}**: ${task.prompt.slice(0, 100)}...`);
        }
        lines.push('');
      }

      if (plan.sequential.length > 0) {
        lines.push('### Sequential Tasks (must run in order):');
        for (const task of plan.sequential) {
          lines.push(`- **@${task.agent}**: ${task.prompt.slice(0, 100)}...`);
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
      lines.push('To execute this plan, invoke the suggested agents with @mentions.');

      return lines.join('\n');
    },
  };
}

/**
 * /parallel - Execute multiple agent tasks in parallel
 */
function createParallel(
  config: OrchestratorConfig,
  getRegistry: () => AgentRegistry | null
): Command {
  return {
    name: 'parallel',
    description: 'Execute tasks across multiple agents in parallel',

    async execute(args, context) {
      const prompt = args.join(' ');

      if (!prompt) {
        return `Usage: /parallel <task description>

This will analyze your task and automatically launch multiple specialized agents to work on different aspects simultaneously.

Example: /parallel implement user authentication with JWT tokens
- @scanner will find existing auth code
- @researcher will look up JWT best practices  
- @advisor will review security implications
`;
      }

      const registry = getRegistry();
      if (!registry) {
        return 'Error: Agent registry not initialized';
      }

      // Create plan and format for execution
      const plan = createTaskPlan(prompt, registry);

      if (plan.parallelizable.length === 0) {
        return `This task doesn't appear to have parallelizable subtasks. 
The main task will be handled by @${plan.sequential[0]?.agent ?? 'orchestrator'}.

To force parallel execution, be more specific about different aspects to explore.`;
      }

      // Return instructions for parallel execution
      const mentions = plan.parallelizable
        .map(t => `@${t.agent} ${t.prompt}`)
        .join('\n\n');

      return `# Launching Parallel Agents

The following agents will work simultaneously:

${mentions}

---
*${plan.parallelizable.length} agents launched in parallel*`;
    },
  };
}

/**
 * /agents - List available agents and their capabilities
 */
function createAgents(getRegistry: () => AgentRegistry | null): Command {
  return {
    name: 'agents',
    description: 'List available specialized agents',

    async execute(args) {
      const registry = getRegistry();
      if (!registry) {
        return 'Error: Agent registry not initialized';
      }

      const filter = args[0]?.toLowerCase();
      let agents = registry.getAll();

      if (filter === 'primary') {
        agents = registry.getPrimary();
      } else if (filter === 'subagent' || filter === 'subagents') {
        agents = registry.getSubagents();
      }

      const lines: string[] = [
        '# Available Agents',
        '',
      ];

      // Group by mode
      const primary = agents.filter(a => a.mode === 'primary');
      const subagents = agents.filter(a => a.mode === 'subagent' && !a.hidden);

      if (primary.length > 0) {
        lines.push('## Primary Agents');
        lines.push('*Main agents you interact with directly*');
        lines.push('');
        for (const agent of primary) {
          lines.push(`### @${agent.id} - ${agent.name}`);
          lines.push(`${agent.description}`);
          lines.push(`- **Model**: ${agent.model.provider}/${agent.model.model}`);
          lines.push('');
        }
      }

      if (subagents.length > 0) {
        lines.push('## Subagents');
        lines.push('*Specialized agents invoked by @mention*');
        lines.push('');
        for (const agent of subagents) {
          lines.push(`### @${agent.id} - ${agent.name}`);
          lines.push(`${agent.description}`);
          lines.push(`- **Model**: ${agent.model.provider}/${agent.model.model}`);
          if (agent.fallbacks.length > 0) {
            const fallbackStr = agent.fallbacks
              .map(f => `${f.provider}/${f.model}`)
              .join(', ');
            lines.push(`- **Fallbacks**: ${fallbackStr}`);
          }
          lines.push('');
        }
      }

      lines.push('---');
      lines.push('Usage: `@agent-id your request`');

      return lines.join('\n');
    },
  };
}

/**
 * /ultrawork - Activate ultrawork mode
 */
function createUltrawork(config: OrchestratorConfig): Command {
  return {
    name: 'ultrawork',
    description: 'Activate ultrawork mode for maximum intensity parallel execution',

    async execute(args, context) {
      const prompt = args.join(' ');

      if (!prompt) {
        return `# Ultrawork Mode

Ultrawork mode activates maximum intensity parallel execution:

1. **Parallel Exploration**: Multiple agents explore simultaneously
2. **Aggressive Execution**: Act without asking, verify after
3. **Completion Guarantee**: Don't stop until 100% done
4. **Extended Thinking**: Full reasoning capabilities

## Usage

\`/ultrawork <your task>\`

or simply include \`ultrawork\` or \`ulw\` in your prompt:

\`ulw build a REST API with authentication\`
`;
      }

      // The keyword will be detected by the keyword-detector hook
      return `ultrawork ${prompt}`;
    },
  };
}
