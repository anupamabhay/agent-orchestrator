# Multi-Agent Orchestrator Project

This project implements a multi-agent orchestration system for AI coding assistants.

## Project Structure

```
packages/
├── core/          # Shared TypeScript library
├── opencode-plugin/  # OpenCode CLI plugin
└── kilo-mode/     # Kilo Code (VSCode) integration
```

## Key Components

### Core Library (`packages/core/`)
- **agents/**: Agent definitions and registry (8 specialized agents)
- **planning/**: Task decomposition and parallel detection
- **execution/**: Parallel execution engine with background support
- **context/**: Token management and truncation utilities

### OpenCode Plugin (`packages/opencode-plugin/`)
- **hooks/**: Lifecycle hooks (keyword detection, todo enforcement, truncation)
- **commands/**: Slash commands (/orchestrate, /parallel, /agents)
- **tools/**: Custom tools (task, background_task, background_output)
- **agents/**: Markdown agent definition files

### Kilo Code (`packages/kilo-mode/`)
- **modes/**: Custom Kilo Code modes (orchestrator, scanner, advisor, builder)
- **skills/**: Orchestrator skill with parallel execution

## Development

```bash
npm install
npm run build
```

## Agent Assignment

| Agent | Model | Role |
|-------|-------|------|
| orchestrator | claude-opus-4-5 | Main coordinator |
| planner | claude-opus-4-5 | Strategic planning |
| advisor | claude-opus-4-5 | Architecture review |
| builder | gpt-5.3-codex | Deep coding |
| worker | gpt-5.3-codex | Parallel execution |
| researcher | claude-sonnet-4-5 | Documentation |
| scanner | claude-haiku-4-5 | Fast exploration |
| designer | gemini-3-pro | UI/UX |

## Conventions

- TypeScript with strict mode
- ESM modules
- JSONC for configs (comments allowed)
- Markdown for agent definitions
