# Multi-Agent Orchestrator

A unified multi-agent orchestration system for **OpenCode** (plugin) and **VSCode/Kilo Code** (modes/skills).

Inspired by [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode), this project brings parallel agent execution, specialized agents, and workflow automation to your development environment.

## Features

- **8 Specialized Agents** with human-friendly names
- **Parallel Execution** - Launch multiple agents simultaneously
- **Background Tasks** - Fire-and-forget async execution
- **Todo Enforcement** - Agents don't stop until work is complete
- **Keyword Triggers** - `ultrawork`, `parallel`, `think`
- **Context Optimization** - Smart truncation and deduplication
- **Cross-Platform** - Works with OpenCode, Kilo Code, and more

## Quick Start

### For OpenCode

```bash
# Install the plugin
npm install -g @orchestrator/opencode-plugin

# Add to your opencode config
# ~/.config/opencode/opencode.json
{
  "plugin": ["@orchestrator/opencode-plugin"]
}
```

### For Kilo Code (VSCode)

```bash
# Copy the combined modes file to your project root
cp packages/kilo-mode/kilocodemodes.json /path/to/your/project/.kilocodemodes

# Or install globally
cp packages/kilo-mode/kilocodemodes.json ~/.kilocode/custom_modes.json
```

## Agents

| Agent | Role | Best For |
|-------|------|----------|
| **Orchestrator** | Main coordinator | Complex multi-step tasks |
| **Scanner** | Fast exploration | Finding files, grep patterns |
| **Researcher** | Documentation | Looking up docs, best practices |
| **Advisor** | Technical review | Architecture, debugging (read-only) |
| **Builder** | Deep coding | Complex features, autonomous implementation |
| **Worker** | Parallel execution | Well-defined implementation tasks |
| **Designer** | UI/UX | Frontend, styling, visual polish |
| **Planner** | Strategic planning | Breaking down complex work |

## Model Assignments

| Agent | Primary Model | Fallback |
|-------|---------------|----------|
| Orchestrator | claude-opus-4-5 | kimi-k2.5 |
| Planner | claude-opus-4-5 | kimi-k2.5 |
| Advisor | claude-opus-4-5 | gpt-5.2 |
| Builder | gpt-5.3-codex | - |
| Worker | gpt-5.3-codex | claude-sonnet-4-5 |
| Researcher | gemini-3-flash | claude-sonnet-4-5 |
| Scanner | claude-haiku-4-5 | gpt-5-mini |
| Designer | gemini-3-pro | claude-sonnet-4-5 |

> **Note**: Models use `provider/model` format (e.g., `google/gemini-3-flash`).
> The plugin doesn't manage API keys - your host platform (OpenCode or Kilo) handles credentials.

## Model Configuration

This plugin is **credential-agnostic** — it specifies which models to use, but your host platform (OpenCode or Kilo Code) manages API keys and provider connections.

### Understanding Provider/Model Format

All models are specified as `provider/model` strings:

```
anthropic/claude-opus-4-5      # Anthropic's Claude Opus
openai/gpt-5.3-codex          # OpenAI's Codex model
google/gemini-3-flash          # Google's Gemini Flash
moonshot/kimi-k2.5             # Moonshot's Kimi model
```

### OpenCode: Setting Up Providers

OpenCode handles credentials via the `/connect` command and `opencode.json` configuration.

#### Step 1: Connect Your API Keys

Run OpenCode and use the `/connect` command inside the TUI:

```bash
# Start OpenCode
opencode

# Then inside the TUI, run:
/connect
```

Select your provider (Anthropic, OpenAI, Google, OpenRouter, etc.) and follow the prompts.

Keys are stored securely in `~/.local/share/opencode/auth.json` (not in your project).

#### Step 2: Configure Providers in opencode.json

**Global config:** `~/.config/opencode/opencode.json`  
**Project config:** `./opencode.json` (overrides global)

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  
  // Default model for the orchestrator
  "model": "anthropic/claude-opus-4-5",
  
  // Provider configurations
  "provider": {
    // Direct API (keys from /connect or env vars)
    "anthropic": {
      "name": "Anthropic"
    },
    "openai": {
      "name": "OpenAI"
    },
    "google": {
      "name": "Google AI"
    },
    
    // OpenRouter (access 100+ models with one key)
    "openrouter": {
      "name": "OpenRouter",
      "options": {
        "apiKey": "{env:OPENROUTER_API_KEY}",
        "baseURL": "https://openrouter.ai/api/v1",
        "defaultHeaders": {
          "HTTP-Referer": "https://github.com/your-org/your-project",
          "X-Title": "Agent Orchestrator"
        }
      }
    },
    
    // Google Vertex AI (enterprise)
    "vertex": {
      "npm": "@ai-sdk/google-vertex",
      "options": {
        "project": "your-gcp-project-id",
        "location": "us-central1"
      }
    },
    
    // Custom OpenAI-compatible endpoint
    "my-gateway": {
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "https://api.my-company.com/v1",
        "apiKey": "{env:MY_GATEWAY_KEY}"
      }
    }
  },
  
  // Plugin configuration with agent overrides
  "@orchestrator/opencode-plugin": {
    "agents": {
      "builder": {
        "model": "openai/gpt-5.3-codex"
      },
      "researcher": {
        "model": "google/gemini-3-flash"
      }
    }
  }
}
```

### Kilo Code: Setting Up Providers

Kilo Code uses VS Code settings or project-level configuration.

#### Option 1: VS Code Settings (UI)

1. Open VS Code Settings (`Cmd+,` / `Ctrl+,`)
2. Search for "Kilo Code"
3. Configure:
   - **API Provider**: Select provider (Anthropic, OpenAI, OpenRouter, etc.)
   - **API Key**: Paste your key
   - **Model**: Select model ID

#### Option 2: Provider Profiles

Create saved profiles for different provider configurations, then switch between them.

#### Option 3: Project-Level Config

**File:** `.kilocode/launchConfig.json`

```json
{
  "mode": "orchestrator",
  "providerProfile": "openrouter",
  "prompt": "Start the orchestrator agent"
}
```

### Environment Variables

Both platforms support environment variable references:

```jsonc
{
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "{env:ANTHROPIC_API_KEY}"
      }
    }
  }
}
```

Set in your shell:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_API_KEY="..."
export OPENROUTER_API_KEY="sk-or-..."
```

### Model Fallback System

When a primary model is unavailable (no API key configured), the system automatically tries fallbacks:

```typescript
// Example: Builder agent
primary: "openai/gpt-5.3-codex"
fallbacks: [] // No fallback - only works with gpt-5.3-codex

// Example: Worker agent
primary: "openai/gpt-5.3-codex"
fallbacks: ["anthropic/claude-sonnet-4-5"] // Falls back if OpenAI unavailable
```

The `resolveModel` function checks:
1. Is the primary model's provider configured?
2. If not, try each fallback in order
3. Return the first available model

### Overriding Agent Models

Override any agent's model in your config:

```jsonc
{
  "@orchestrator/opencode-plugin": {
    "agents": {
      // Use a different model for the orchestrator
      "orchestrator": {
        "model": "moonshot/kimi-k2.5",
        "thinking": { "budgetTokens": 16000 }
      },
      // Use local model for scanning
      "scanner": {
        "model": "ollama/llama3:70b"
      }
    }
  }
}
```

### Configuration Examples

See the [`docs/examples/`](docs/examples/) directory for complete configuration examples:

| Example | Use Case |
|---------|----------|
| [`openrouter.jsonc`](docs/examples/openrouter.jsonc) | Access 100+ models with one API key |
| [`vertex.jsonc`](docs/examples/vertex.jsonc) | Google Cloud / Vertex AI enterprise |
| [`direct-api.jsonc`](docs/examples/direct-api.jsonc) | Direct provider APIs (Anthropic, OpenAI, Google) |
| [`local-models.jsonc`](docs/examples/local-models.jsonc) | Ollama, LM Studio, llama.cpp |
| [`enterprise-gateway.jsonc`](docs/examples/enterprise-gateway.jsonc) | Azure OpenAI, AWS Bedrock, private gateways |

## Usage

### Basic Delegation

```
@scanner find all authentication files
@researcher look up JWT best practices
@advisor review the auth architecture
```

### Ultrawork Mode

Maximum intensity - all agents, parallel exploration, complete 100%:

```
ulw implement user authentication with JWT
```

### Parallel Mode

Force parallel execution:

```
parallel implement feature A and feature B
```

## Configuration

### OpenCode Plugin

```jsonc
// .opencode/opencode.json or ~/.config/opencode/opencode.json
{
  "plugin": ["@orchestrator/opencode-plugin"],
  "@orchestrator/opencode-plugin": {
    "defaultAgent": "orchestrator",
    "parallelLimit": 5,
    "agents": {
      "builder": {
        "model": "openai/gpt-5.3-codex"
      }
    },
    "hooks": {
      "todoEnforcer": true,
      "keywordDetector": true
    }
  }
}
```

### Kilo Code

Edit `kilocodemodes.json` and copy as `.kilocodemodes` to your project root. See [`packages/kilo-mode/README.md`](packages/kilo-mode/README.md) for details.

## Project Structure

```
packages/
├── core/                 # Shared orchestration logic
│   ├── src/agents/       # Agent definitions and registry
│   ├── src/planning/     # Task decomposition
│   ├── src/execution/    # Parallel execution engine
│   └── src/context/      # Token management
│
├── opencode-plugin/      # OpenCode plugin
│   ├── src/              # Plugin source (event hooks)
│   └── agents/           # Markdown agent definitions
│
└── kilo-mode/            # Kilo Code integration
    ├── modes/            # Custom modes
    └── skills/           # Orchestrator skill
```

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Build specific package
npm run build:core
npm run build:opencode

# Development mode
npm run dev
```

## Key Concepts

### Todo Enforcement

The orchestrator creates todos at the start of complex tasks and cannot stop until all are complete. This ensures work is finished, not abandoned.

### Parallel Execution

Independent tasks are launched simultaneously:
- @scanner finds files
- @researcher looks up docs  
- @advisor reviews architecture

All happen in parallel, then results are synthesized.

### Keyword Triggers

- `ultrawork` / `ulw` - Maximum intensity mode
- `parallel` / `||` - Force parallel execution
- `think` / `ultrathink` - Extended reasoning

### Context Optimization

- Smart output truncation with headroom
- AGENTS.md deduplication
- Preemptive compaction before limits

## Comparison

| Feature | oh-my-opencode | This Project |
|---------|----------------|--------------|
| OpenCode support | ✅ | ✅ |
| VSCode/Kilo support | ❌ | ✅ |
| Agent naming | Mythological | Human-friendly |
| Shared core | ❌ | ✅ |
| Model flexibility | Good | Better |

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
