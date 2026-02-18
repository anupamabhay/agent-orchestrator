/**
 * Agent Markdown File Loader
 * 
 * Loads agent definitions from markdown files in standard locations:
 * - .opencode/agents/*.md (project)
 * - ~/.config/opencode/agents/*.md (user)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { AgentDefinition, AgentId, ModelSpec, ToolPermissions } from '@orchestrator/core';

interface ParsedAgentFrontmatter {
  id?: string;
  name?: string;
  description?: string;
  mode?: 'primary' | 'subagent';
  model?: string;
  fallbacks?: string[];
  temperature?: number;
  maxSteps?: number;
  hidden?: boolean;
  todoEnforcer?: boolean;
  tools?: Record<string, boolean>;
}

/**
 * Load agent definitions from markdown files
 */
export async function loadAgentMarkdownFiles(): Promise<Partial<AgentDefinition>[]> {
  const agents: Partial<AgentDefinition>[] = [];
  const locations = getAgentLocations();

  for (const location of locations) {
    try {
      const files = await fs.promises.readdir(location);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      for (const file of mdFiles) {
        const filePath = path.join(location, file);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const agent = parseAgentMarkdown(content, file);
        
        if (agent) {
          agents.push(agent);
        }
      }
    } catch {
      // Location doesn't exist, skip
    }
  }

  return agents;
}

/**
 * Get locations to search for agent files
 */
function getAgentLocations(): string[] {
  const locations: string[] = [];
  const cwd = process.cwd();
  const home = os.homedir();

  // Project locations
  locations.push(path.join(cwd, '.opencode', 'agents'));
  locations.push(path.join(cwd, '.claude', 'agents')); // Claude Code compat

  // User locations
  locations.push(path.join(home, '.config', 'opencode', 'agents'));
  locations.push(path.join(home, '.claude', 'agents')); // Claude Code compat

  return locations;
}

/**
 * Parse agent markdown file
 */
function parseAgentMarkdown(content: string, filename: string): Partial<AgentDefinition> | null {
  const { frontmatter, body } = parseFrontmatter(content);
  
  if (!frontmatter) {
    return null;
  }

  const parsed = frontmatter as ParsedAgentFrontmatter;
  const id = parsed.id ?? filename.replace(/\.md$/, '') as AgentId;

  return {
    id: id as AgentId,
    name: parsed.name ?? id,
    description: parsed.description ?? '',
    mode: parsed.mode ?? 'subagent',
    model: parseModelSpec(parsed.model),
    fallbacks: (parsed.fallbacks ?? []).map(parseModelSpec).filter(Boolean) as ModelSpec[],
    temperature: parsed.temperature ?? 0.3,
    maxSteps: parsed.maxSteps,
    hidden: parsed.hidden,
    todoEnforcer: parsed.todoEnforcer,
    tools: parsed.tools as ToolPermissions,
    prompt: body.trim(),
  };
}

/**
 * Parse YAML frontmatter from markdown
 */
function parseFrontmatter(content: string): { frontmatter: unknown; body: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: null, body: content };
  }

  const frontmatterStr = match[1];
  const body = content.slice(match[0].length);

  try {
    // Simple YAML parsing (key: value format)
    const frontmatter: Record<string, unknown> = {};
    const lines = frontmatterStr.split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      let value: unknown = line.slice(colonIndex + 1).trim();

      // Parse arrays
      if (value === '') {
        // Check for array on next lines
        continue;
      }

      // Parse booleans
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      // Parse numbers
      else if (!isNaN(Number(value))) value = Number(value);
      // Remove quotes
      else if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      frontmatter[key] = value;
    }

    return { frontmatter, body };
  } catch {
    return { frontmatter: null, body: content };
  }
}

/**
 * Parse model string to ModelSpec
 */
function parseModelSpec(modelStr: string | undefined): ModelSpec {
  if (!modelStr) {
    return { provider: 'anthropic', model: 'claude-sonnet-4-5' };
  }

  const parts = modelStr.split('/');
  if (parts.length === 2) {
    return { provider: parts[0], model: parts[1] };
  }

  // Assume anthropic if no provider specified
  return { provider: 'anthropic', model: modelStr };
}
