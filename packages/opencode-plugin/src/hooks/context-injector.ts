/**
 * Context Injector Hook
 * 
 * Injects AGENTS.md content when files are read.
 * Walks from file directory up to project root, collecting all AGENTS.md files.
 */

import type { Hook, PostToolUsePayload } from '@orchestrator/core';
import { createAgentsMdInjector } from '@orchestrator/core';
import * as path from 'path';
import * as fs from 'fs';

// Track injected paths per session to avoid duplicates
const injector = createAgentsMdInjector();

const FILE_READ_TOOLS = new Set(['read', 'Read']);

export function createContextInjector(): Hook<'PostToolUse'> {
  return {
    name: 'context-injector',
    event: 'PostToolUse',
    priority: 80,

    async handle(event: PostToolUsePayload) {
      // Only process file read operations
      if (!FILE_READ_TOOLS.has(event.tool)) {
        return event;
      }

      // Extract file path from input
      const filePath = event.input.filePath as string | undefined;
      if (!filePath) {
        return event;
      }

      // Find and read AGENTS.md files
      const agentsMdContents = await findAgentsMdFiles(filePath);
      
      if (agentsMdContents.size === 0) {
        return event;
      }

      // Get content to inject (with deduplication)
      const toInject = injector.getAgentsContext(filePath, agentsMdContents);

      if (toInject.length === 0) {
        return event;
      }

      // Build injection message
      const injectionMessage = [
        '',
        '═══════════════════════════════════════════════════════════════',
        '  AGENTS.md CONTEXT (auto-injected)',
        '═══════════════════════════════════════════════════════════════',
        '',
        ...toInject,
        '',
        '═══════════════════════════════════════════════════════════════',
        '',
      ].join('\n');

      return {
        ...event,
        injectedMessages: [
          ...(event.injectedMessages ?? []),
          injectionMessage,
        ],
      };
    },
  };
}

/**
 * Find all AGENTS.md files from the given path up to the project root
 */
async function findAgentsMdFiles(filePath: string): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  try {
    // Start from the directory containing the file
    let currentDir = path.dirname(path.resolve(filePath));
    const projectRoot = findProjectRoot(currentDir);
    
    // Walk up to project root
    while (currentDir.length >= projectRoot.length) {
      const agentsMdPath = path.join(currentDir, 'AGENTS.md');
      
      try {
        const content = await fs.promises.readFile(agentsMdPath, 'utf-8');
        results.set(agentsMdPath, formatAgentsMdContent(agentsMdPath, content));
      } catch {
        // File doesn't exist, continue
      }

      // Move up one directory
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break; // Reached root
      }
      currentDir = parentDir;
    }
  } catch {
    // Ignore errors in path traversal
  }

  return results;
}

/**
 * Find the project root (looks for common markers)
 */
function findProjectRoot(startDir: string): string {
  const markers = ['.git', 'package.json', '.opencode', 'pyproject.toml', 'Cargo.toml'];
  
  let currentDir = startDir;
  
  while (true) {
    for (const marker of markers) {
      const markerPath = path.join(currentDir, marker);
      try {
        fs.statSync(markerPath);
        return currentDir;
      } catch {
        // Marker not found
      }
    }
    
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return startDir; // Fallback to start
    }
    currentDir = parentDir;
  }
}

/**
 * Format AGENTS.md content for injection
 */
function formatAgentsMdContent(filePath: string, content: string): string {
  const relativePath = path.relative(process.cwd(), filePath);
  return `### From: ${relativePath}\n\n${content}`;
}

/**
 * Reset injection state (call on session reset)
 */
export function resetContextInjector(): void {
  injector.reset();
}
