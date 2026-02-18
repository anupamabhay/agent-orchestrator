# Testing Guide

This guide covers both automated testing and manual verification for the Multi-Agent Orchestrator.

## Table of Contents

1. [Automated Tests](#automated-tests)
2. [Manual Testing: OpenCode Plugin](#manual-testing-opencode-plugin)
3. [Manual Testing: Kilo Code Modes](#manual-testing-kilo-code-modes)
4. [Provider Configuration Testing](#provider-configuration-testing)
5. [Troubleshooting](#troubleshooting)

---

## Automated Tests

### Running Tests

```bash
# Install dependencies (from project root)
npm install

# Run all tests
npm test

# Run tests for specific package
cd packages/core
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Coverage

The core package includes tests for:

| Module | Test File | Coverage |
|--------|-----------|----------|
| Agent Definitions | `agents.test.ts` | Agent loading, registry, model resolution |
| Planning | `planning.test.ts` | Keyword detection, intent analysis, task decomposition |
| Context | `context.test.ts` | Token estimation, truncation, context tracking |
| Execution | `execution.test.ts` | Parallel execution, background tasks, aggregation |

### Expected Test Output

```
 ✓ packages/core/src/__tests__/agents.test.ts
 ✓ packages/core/src/__tests__/planning.test.ts
 ✓ packages/core/src/__tests__/context.test.ts
 ✓ packages/core/src/__tests__/execution.test.ts

 Test Files  4 passed (4)
      Tests  XX passed (XX)
```

---

## Manual Testing: OpenCode Plugin

### Prerequisites

1. **Install OpenCode**
   ```bash
   # Using npm
   npm install -g opencode-ai
   
   # Or using the install script
   curl -fsSL https://opencode.ai/install | bash
   
   # Or using Homebrew (macOS/Linux)
   brew install anomalyco/tap/opencode
   ```

2. **Build the plugin**
   ```bash
   cd agent-orchestrator
   npm install
   npm run build
   ```

3. **Copy agents to OpenCode config**
   ```bash
   # Create agents directory
   mkdir -p ~/.config/opencode/agents
   
   # Copy agent markdown files
   cp packages/opencode-plugin/agents/*.md ~/.config/opencode/agents/
   ```

4. **Copy plugin to OpenCode plugins directory**
   ```bash
   # Create plugins directory
   mkdir -p ~/.config/opencode/plugins
   
   # Copy built plugin
   cp -r packages/opencode-plugin/dist/* ~/.config/opencode/plugins/
   ```

### Setup

1. **Add plugin to OpenCode config**

   Edit `~/.config/opencode/opencode.json`:
   ```jsonc
   {
     "$schema": "https://opencode.ai/config.json",
     
     // Add the plugin
     "plugin": ["@orchestrator/opencode-plugin"],
     
     // Set default agent to our orchestrator
     "default_agent": "orchestrator",
     
     // Agent configurations
     "agent": {
       "orchestrator": {
         "description": "Main coordinator - analyzes tasks, delegates to specialists",
         "mode": "primary",
         "model": "anthropic/claude-opus-4-5"
       }
     }
   }
   ```

2. **Configure at least one provider**

   Start OpenCode and use `/connect`:
   ```bash
   # Start OpenCode in your project directory
   cd your-project
   opencode
   ```
   
   Inside the TUI, run:
   ```
   /connect
   ```
   
   Select your provider (e.g., Anthropic, OpenAI, OpenRouter) and follow the prompts to enter your API key.

3. **Verify models are available**
   ```
   /models
   ```
   
   You should see your configured models listed.

### Test Cases

#### Test 1: Agent Loading

**Steps:**
1. Start OpenCode: `opencode`
2. Press **Tab** to cycle through agents

**Expected:**
- Custom agents appear in the agent list
- Orchestrator agent is available as primary
- Scanner, Researcher, Advisor appear as subagents

#### Test 2: Agent Invocation with @mention

**Command (inside OpenCode TUI):**
```
@explore find all TypeScript files in src/
```

**Expected Behavior:**
- Explore subagent is invoked
- Fast response with file list
- Read-only - no file modifications

#### Test 3: Custom Agent Prompt

**Steps:**
1. Switch to orchestrator agent (Tab key)
2. Enter: `analyze this codebase structure`

**Expected Behavior:**
- Orchestrator uses its custom system prompt
- May delegate to @explore for codebase scanning
- Provides structured analysis

#### Test 4: Model Override

**Setup:** Edit `~/.config/opencode/opencode.json`:
```jsonc
{
  "agent": {
    "scanner": {
      "model": "anthropic/claude-haiku-4-5"
    }
  }
}
```

**Test:**
```
@scanner find all test files
```

**Expected:** Scanner uses claude-haiku-4-5 instead of default model

#### Test 5: Subagent Task Tool

**Command:**
```
Research JWT authentication best practices and find relevant files in this project
```

**Expected Behavior:**
- Primary agent may invoke subagents via Task tool
- Multiple parallel investigations possible
- Results synthesized in response

#### Test 6: Plan Mode

**Steps:**
1. Press **Tab** to switch to Plan mode
2. Enter: `implement user authentication`

**Expected Behavior:**
- Plan mode is read-only (no file changes)
- Provides implementation plan without modifying code
- Can analyze and suggest but not execute

### Verifying Plugin Events

The plugin can hook into OpenCode events. Test these:

| Event | How to Test | Expected |
|-------|-------------|----------|
| `session.created` | Start new session | Plugin hook fires |
| `tool.execute.before` | Use any tool | Hook can modify/block |
| `tool.execute.after` | Tool completes | Hook receives output |
| `session.idle` | Agent finishes | Hook can trigger notification |

---

## Manual Testing: Kilo Code Modes

### Prerequisites

1. **Install Kilo Code Extension** in VS Code
   - Open VS Code
   - Go to Extensions (`Cmd+Shift+X` / `Ctrl+Shift+X`)
   - Search for "Kilo Code"
   - Install the extension

2. **Copy modes to Kilo config**
   ```bash
   # Create Kilo config directories
   mkdir -p ~/.kilo/modes
   
   # Copy custom modes
   cp packages/kilo-mode/modes/*.json ~/.kilo/modes/
   ```

3. **Restart VS Code**

### Setup

1. **Configure provider in VS Code settings**
   - Open VS Code Settings (`Cmd+,` / `Ctrl+,`)
   - Search "Kilo Code"
   - Configure:
     - **API Provider**: Select your provider (Anthropic, OpenAI, OpenRouter, etc.)
     - **API Key**: Enter your API key
     - **Model**: Select your preferred model

2. **Or use `.kilocode/launchConfig.json`** for project-specific config:
   ```json
   {
     "mode": "orchestrator",
     "providerProfile": "anthropic"
   }
   ```

### Test Cases

#### Test 1: Mode Loading

**Steps:**
1. Open a project in VS Code
2. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. Type "Kilo: Select Mode" or use the mode selector in Kilo UI
4. Check for custom modes

**Expected:**
- "Orchestrator" mode appears in the list
- "Scanner" mode appears in the list
- "Advisor" mode appears in the list
- "Builder" mode appears in the list

#### Test 2: Orchestrator Mode

**Steps:**
1. Select "Orchestrator" mode from the mode selector
2. In Kilo chat, send: `Analyze this project structure`

**Expected Behavior:**
- Uses configured model (e.g., claude-opus-4-5)
- Explores codebase systematically
- Provides structured analysis
- May delegate to specialized modes internally

#### Test 3: Scanner Mode

**Steps:**
1. Select "Scanner" mode
2. Send message: `Find all React components`

**Expected Behavior:**
- Fast response (uses lightweight model like claude-haiku)
- Uses read-only tools (glob, grep, read)
- Returns file list without modifications
- No write/edit tools available

#### Test 4: Advisor Mode

**Steps:**
1. Select "Advisor" mode
2. Send message: `Review the authentication implementation`

**Expected Behavior:**
- Read-only analysis (no file modifications)
- Architecture recommendations
- Security considerations mentioned
- Best practices suggestions

#### Test 5: Builder Mode

**Steps:**
1. Select "Builder" mode
2. Send message: `Implement a new API endpoint for user profiles`

**Expected Behavior:**
- Full tool access (read, write, edit, bash)
- Thorough codebase exploration first
- Pattern matching with existing code
- Complete implementation
- May run tests to verify

### Mode Configuration Verification

Each mode JSON file in `~/.kilo/modes/` should have:

```json
{
  "slug": "orchestrator",
  "name": "Orchestrator",
  "roleDefinition": "You are the Orchestrator agent...",
  "groups": ["read", "edit", "browser", "command", "mcp"],
  "customInstructions": "..."
}
```

Verify modes load correctly by checking Kilo's mode selector dropdown.

---

## Provider Configuration Testing

### Test Different Providers

For each provider type, verify the plugin works correctly:

#### Direct API (Anthropic)

1. **Connect via TUI:**
   ```
   /connect
   ```
   Select "Anthropic" and enter your API key.

2. **Or use environment variable:**
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   opencode
   ```

3. **Or configure in opencode.json:**
   ```jsonc
   {
     "$schema": "https://opencode.ai/config.json",
     "provider": {
       "anthropic": {
         "options": {
           "apiKey": "{env:ANTHROPIC_API_KEY}"
         }
       }
     }
   }
   ```

**Test:** 
```
/models
```
Should show Anthropic models available.

#### OpenRouter

1. **Connect via TUI:**
   ```
   /connect
   ```
   Select "OpenRouter" and enter your API key.

2. **Or configure in opencode.json:**
   ```jsonc
   {
     "$schema": "https://opencode.ai/config.json",
     "provider": {
       "openrouter": {
         "name": "OpenRouter",
         "options": {
           "apiKey": "{env:OPENROUTER_API_KEY}",
           "baseURL": "https://openrouter.ai/api/v1",
           "defaultHeaders": {
             "HTTP-Referer": "https://github.com/your-org/your-project"
           }
         }
       }
     }
   }
   ```

**Test:** 
```
/models
```
Should show OpenRouter models (100+ available).

#### Local Models (Ollama)

1. **Install and start Ollama:**
   ```bash
   # Install Ollama (see https://ollama.ai)
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Start Ollama server
   ollama serve
   
   # Pull a model
   ollama pull llama3:8b
   ```

2. **Configure in opencode.json:**
   ```jsonc
   {
     "$schema": "https://opencode.ai/config.json",
     "provider": {
       "ollama": {
         "npm": "@ai-sdk/openai-compatible",
         "name": "Ollama (local)",
         "options": {
           "baseURL": "http://localhost:11434/v1"
         },
         "models": {
           "llama3:8b": {
             "name": "Llama 3 8B (local)"
           }
         }
       }
     },
     "agent": {
       "scanner": {
         "model": "ollama/llama3:8b"
       }
     }
   }
   ```

**Test:**
Switch to scanner agent and verify it uses the local model.

### Model Selection Testing

1. Run `/models` to see available models
2. Select a specific model
3. Verify the agent uses that model in responses

### Provider Fallback Testing

1. Configure only one provider (e.g., Google)
2. Set an agent to use Anthropic with Google fallback:
   ```jsonc
   {
     "agent": {
       "advisor": {
         "model": "anthropic/claude-opus-4-5"
       }
     }
   }
   ```
3. **Expected:** Agent should gracefully handle unavailable primary model

---

## Troubleshooting

### Plugin Not Loading

**Symptoms:** Custom agents not appearing

**Checklist:**
- [ ] Plugin files exist in `~/.config/opencode/plugins/`
- [ ] Agent markdown files exist in `~/.config/opencode/agents/`
- [ ] Config syntax valid (use JSON validator)
- [ ] Plugin specified in `opencode.json` `plugin` array

**Debug:**
```bash
# Check if agents directory has files
ls -la ~/.config/opencode/agents/

# Check OpenCode config
cat ~/.config/opencode/opencode.json

# Run with debug logging (if supported)
OPENCODE_DEBUG=1 opencode
```

### Model Not Available

**Symptoms:** "No model available" or model errors

**Checklist:**
- [ ] Provider connected: Run `/connect` in TUI
- [ ] API key valid: Check `~/.local/share/opencode/auth.json`
- [ ] Model ID correct: Use `provider/model` format

**Debug:**
```
# Inside OpenCode TUI
/models
```

This shows all available models from connected providers.

### Agent Not Responding Correctly

**Symptoms:** Agent ignores custom prompt or uses wrong model

**Checklist:**
- [ ] Agent markdown file has correct frontmatter
- [ ] Model specified exists and is available
- [ ] No syntax errors in YAML frontmatter

**Example correct format:**
```markdown
---
description: Your agent description
mode: subagent
model: anthropic/claude-sonnet-4-5
temperature: 0.3
tools:
  write: false
  edit: false
---

Your system prompt here...
```

### Subagent Invocation Issues

**Symptoms:** `@agentname` not working

**Checklist:**
- [ ] Agent `mode` is set to `subagent` (not `primary`)
- [ ] Agent is not `hidden: true`
- [ ] Agent name matches filename (e.g., `scanner.md` → `@scanner`)

### Kilo Mode Not Appearing

**Symptoms:** Custom modes not in Kilo's mode selector

**Checklist:**
- [ ] Modes copied to `~/.kilo/modes/` directory
- [ ] JSON syntax valid:
  ```bash
  # Validate JSON
  cat ~/.kilo/modes/orchestrator.json | python -m json.tool
  ```
- [ ] VS Code restarted after adding modes
- [ ] Kilo extension is up to date

**Mode JSON structure:**
```json
{
  "slug": "orchestrator",
  "name": "Orchestrator",
  "roleDefinition": "...",
  "groups": ["read", "edit", "command"],
  "customInstructions": "..."
}
```

### API Rate Limiting

**Symptoms:** Requests failing with rate limit errors

**Solutions:**
1. Reduce parallel operations
2. Add delays between requests
3. Use a different provider tier
4. Check provider dashboard for quota

### Connection Issues

**Symptoms:** Cannot connect to provider

**Checklist:**
- [ ] Internet connectivity
- [ ] No firewall blocking API endpoints
- [ ] Correct base URL (for custom providers)
- [ ] Valid API key format

---

## Verification Checklist

Use this checklist for final verification:

### OpenCode Plugin
- [ ] Custom agents appear when pressing Tab to cycle
- [ ] Agent markdown files load from `~/.config/opencode/agents/`
- [ ] `@mention` invokes subagents correctly
- [ ] Agent model overrides apply
- [ ] Agent tool restrictions work (e.g., read-only modes)
- [ ] Custom system prompts are used

### Kilo Code Modes
- [ ] All custom modes appear in mode selector
- [ ] Mode switching works correctly
- [ ] Each mode uses correct tool groups
- [ ] Custom instructions are applied
- [ ] Model selection per mode works

### Configuration
- [ ] Global config (`~/.config/opencode/opencode.json`) applies
- [ ] Project config (`./opencode.json`) overrides global
- [ ] Agent model overrides work
- [ ] Environment variable substitution works (`{env:VAR}`)
- [ ] File variable substitution works (`{file:path}`)
- [ ] Multiple providers can be configured simultaneously

### Provider Integration
- [ ] `/connect` successfully adds API keys
- [ ] `/models` shows available models
- [ ] Model selection changes the active model
- [ ] Provider-specific options work (e.g., baseURL)

---

## Reporting Issues

When reporting issues, include:

1. **Environment:**
   - OS version
   - Node.js version (`node -v`)
   - OpenCode version (`opencode --version`)
   - Kilo Code extension version (VS Code Extensions panel)

2. **Configuration (redact API keys!):**
   ```bash
   # Show config (edit to remove secrets)
   cat ~/.config/opencode/opencode.json
   cat ./opencode.json
   ```

3. **Steps to Reproduce:**
   - Exact commands/actions taken
   - Expected vs actual behavior
   - Screenshots if applicable

4. **Files:**
   - Relevant agent markdown files
   - Relevant mode JSON files

5. **Project Links:**
   - OpenCode: https://github.com/anomalyco/opencode/issues
   - This project: Create issue in project repository
