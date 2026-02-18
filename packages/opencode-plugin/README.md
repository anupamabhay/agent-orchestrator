# Multi-Agent Orchestrator Plugin for OpenCode

Bring multi-agent orchestration to OpenCode with parallel execution, specialized agents, and workflow automation.

## Installation

```bash
npm install -g @orchestrator/opencode-plugin
```

Add to your OpenCode config:

```jsonc
// ~/.config/opencode/opencode.json
{
  "plugin": ["@orchestrator/opencode-plugin"]
}
```

## Features

- **8 Specialized Agents** - Orchestrator, Scanner, Researcher, Advisor, Builder, Worker, Designer, Planner
- **Parallel Execution** - Launch multiple agents simultaneously
- **Background Tasks** - Fire-and-forget async execution
- **Todo Enforcement** - Don't stop until work is complete
- **Keyword Triggers** - `ultrawork`, `parallel`, `think`
- **Smart Context** - Truncation, deduplication, AGENTS.md injection

## Usage

### Agent Delegation

```
@scanner find all test files
@researcher look up testing best practices
@advisor review test architecture
```

### Ultrawork Mode

```
ulw implement complete user authentication
```

### Slash Commands

- `/orchestrate <task>` - Analyze and plan task delegation
- `/parallel <task>` - Force parallel execution
- `/agents` - List available agents
- `/ultrawork <task>` - Activate ultrawork mode

### Background Tasks

```javascript
// Launch background task
task({ agent: "scanner", prompt: "Find all API files", runInBackground: true })

// Check results later
background_output({ task_id: "bg_123" })
```

## Configuration

```jsonc
{
  "plugin": ["@orchestrator/opencode-plugin"],
  "@orchestrator/opencode-plugin": {
    "defaultAgent": "orchestrator",
    "parallelLimit": 5,
    "backgroundEnabled": true,
    
    "agents": {
      "builder": {
        "model": "openai/gpt-5.3-codex"
      },
      "advisor": {
        "model": "anthropic/claude-opus-4-5"
      }
    },
    
    "hooks": {
      "todoEnforcer": true,
      "keywordDetector": true,
      "outputTruncator": true,
      "contextInjector": true
    },
    
    "context": {
      "maxToolOutputTokens": 50000,
      "headroomPercentage": 50,
      "aggressiveTruncation": false
    }
  }
}
```

## Hooks

| Hook | Description |
|------|-------------|
| `keyword-detector` | Detects ultrawork/parallel/think keywords |
| `todo-enforcer` | Prevents stopping with incomplete todos |
| `output-truncator` | Smart truncation of large outputs |
| `context-injector` | Auto-injects AGENTS.md files |

## Agents

| Agent | Model | Role |
|-------|-------|------|
| orchestrator | claude-opus-4-5 | Main coordinator |
| scanner | claude-haiku-4-5 | Fast codebase exploration |
| researcher | claude-sonnet-4-5 | Documentation lookup |
| advisor | claude-opus-4-5 | Architecture review |
| builder | gpt-5.3-codex | Deep autonomous coding |
| worker | gpt-5.3-codex | Parallel task execution |
| designer | gemini-3-pro | UI/UX implementation |
| planner | claude-opus-4-5 | Strategic planning |

## License

MIT
