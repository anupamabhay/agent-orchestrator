# Multi-Agent Orchestrator for OpenCode

Bring multi-agent orchestration to OpenCode with 8 specialized agents and workflow automation hooks.

## Architecture

This package provides two independent components:

1. **Agent markdown files** (`agents/*.md`) — Custom agents loaded by OpenCode
2. **Plugin file** (`src/index.ts`) — Event hooks for output truncation, compaction context, and error logging

You can use agents without the plugin. They are independent.

## Installation

### Agents Only (No Build Required)

```bash
# Copy agent files to OpenCode agents directory
mkdir -p ~/.config/opencode/agents
cp agents/*.md ~/.config/opencode/agents/

# Or for project-level:
mkdir -p .opencode/agents
cp agents/*.md .opencode/agents/
```

### Agents + Plugin

```bash
# Build the plugin
npm install && npm run build

# Copy agents
mkdir -p ~/.config/opencode/agents
cp agents/*.md ~/.config/opencode/agents/

# Copy built plugin
mkdir -p ~/.config/opencode/plugins
cp dist/index.js ~/.config/opencode/plugins/orchestrator-plugin.js
```

## Usage

### Agent Delegation

Invoke subagents with `@mentions` in OpenCode:

```
@scanner find all TypeScript files
@researcher look up JWT best practices
@advisor review the authentication module
@builder implement user registration
```

Switch to the orchestrator as your primary agent with **Tab**.

### Keyword Triggers

Include these in your prompts for special modes:

- `ultrawork` / `ulw` — Maximum intensity parallel execution
- `parallel` / `||` — Force parallel execution
- `think` / `ultrathink` — Extended reasoning before action

## Configuration

Override agent models in your `opencode.json`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "scanner": {
      "model": "openai/gpt-5-mini"
    },
    "builder": {
      "model": "anthropic/claude-sonnet-4-5"
    }
  }
}
```

## Agents

| Agent | Model | Mode | Role |
|-------|-------|------|------|
| orchestrator | claude-opus-4-5 | primary | Main coordinator |
| scanner | claude-haiku-4-5 | subagent | Fast codebase exploration (read-only) |
| researcher | gemini-3-flash | subagent | Documentation, best practices (read-only) |
| advisor | claude-opus-4-5 | subagent | Architecture review (read-only) |
| builder | gpt-5.3-codex | subagent | Deep autonomous coding |
| worker | gpt-5.3-codex | subagent | Parallel task execution |
| designer | gemini-3-pro | subagent | UI/UX implementation |
| planner | claude-opus-4-5 | subagent | Strategic planning (read-only) |

## Plugin Hooks

| Hook | Description |
|------|-------------|
| `tool.execute.after` | Truncates large tool outputs (>50k tokens) |
| `experimental.session.compacting` | Injects agent context into compaction summaries |
| `event` | Logs session errors for diagnostics |

## License

MIT
