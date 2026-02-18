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

### Architecture Overview

This project installs into OpenCode as **two separate components**:

1. **Agents** — Markdown files placed in OpenCode's agents directory. These define specialized subagents (scanner, researcher, advisor, etc.) that can be invoked via `@mentions`.
2. **Plugin** — A JS/TS file placed in OpenCode's plugins directory. This provides event hooks (output truncation, compaction context injection, error logging).

### Prerequisites

1. **Install OpenCode**
   ```bash
   # Using npm
   npm install -g opencode-ai
   
   # Or using the install script
   curl -fsSL https://opencode.ai/install | bash
   
   # Or using Homebrew (macOS/Linux)
   brew install anomalyco/tap/opencode
   
   # Or on Windows (Scoop)
   scoop install opencode
   ```

2. **Configure at least one provider**

   Start OpenCode in any directory:
   ```bash
   opencode
   ```
   
   Inside the TUI, run:
   ```
   /connect
   ```
   
   Select your provider (e.g., Anthropic, OpenAI, OpenRouter) and follow the prompts to enter your API key. Keys are stored in `~/.local/share/opencode/auth.json`.

3. **Verify models are available**
   ```
   /models
   ```

### Install: Agents Only (Simplest)

This installs the 8 specialized agents without the plugin. No build step needed.

```bash
# Clone the repo
git clone https://github.com/anupamabhay/agent-orchestrator.git
cd agent-orchestrator

# Copy agent markdown files to OpenCode agents directory
# (OpenCode auto-discovers .md files here)
mkdir -p ~/.config/opencode/agents
cp packages/opencode-plugin/agents/*.md ~/.config/opencode/agents/
```

**What this gives you:**
- 8 agents available via `@mention` (scanner, researcher, advisor, builder, worker, designer, planner)
- Orchestrator as a primary agent (switch with Tab)
- Each agent has its own model, temperature, tool permissions, and system prompt

### Install: Agents + Plugin (Full)

This also installs the plugin for output truncation and compaction hooks.

```bash
# Clone and build
git clone https://github.com/anupamabhay/agent-orchestrator.git
cd agent-orchestrator
npm install
npm run build

# Copy agents (same as above)
mkdir -p ~/.config/opencode/agents
cp packages/opencode-plugin/agents/*.md ~/.config/opencode/agents/

# Copy the built plugin file
mkdir -p ~/.config/opencode/plugins
cp packages/opencode-plugin/dist/index.js ~/.config/opencode/plugins/orchestrator-plugin.js
```

**Note:** The plugin JS file must export named functions matching the OpenCode plugin API. Our plugin exports `OrchestratorPlugin` which hooks into `tool.execute.after` and `experimental.session.compacting`.

### Install: Project-Level (Per-Project)

Instead of global install, you can install per-project:

```bash
# In your project root
mkdir -p .opencode/agents .opencode/plugins

# Copy agents
cp /path/to/agent-orchestrator/packages/opencode-plugin/agents/*.md .opencode/agents/

# Copy plugin (if built)
cp /path/to/agent-orchestrator/packages/opencode-plugin/dist/index.js .opencode/plugins/orchestrator-plugin.js
```

### Test Cases

#### Test 1: Agent Loading

**Steps:**
1. Start OpenCode in a project: `opencode`
2. Press **Tab** to cycle through primary agents

**Expected:**
- "Orchestrator" appears as a primary agent (alongside built-in Build and Plan)
- Custom system prompt is used when you send a message

#### Test 2: Subagent Invocation with @mention

**Command (inside OpenCode TUI):**
```
@scanner find all TypeScript files in src/
```

**Expected Behavior:**
- Scanner subagent is invoked (not the built-in @explore)
- Uses `anthropic/claude-haiku-4-5` model (fast, cheap)
- Read-only — write/edit/bash tools are disabled
- Returns concise file list

#### Test 3: Multiple Subagents

**Command:**
```
@researcher look up JWT authentication best practices
```

Then in a new message:
```
@advisor review the authentication implementation in this project
```

**Expected Behavior:**
- Researcher uses `google/gemini-3-flash` model
- Advisor uses `anthropic/claude-opus-4-5` model
- Both are read-only (no file modifications)
- Each follows its specialized system prompt

#### Test 4: Builder Agent (Full Access)

**Command:**
```
@builder add input validation to the user registration endpoint
```

**Expected Behavior:**
- Builder has full tool access (read, write, edit, bash)
- Explores codebase before writing code
- Matches existing patterns
- Uses `openai/gpt-5.3-codex` model

#### Test 5: Model Override via Config

**Setup:** Add to `~/.config/opencode/opencode.json` or `./opencode.json`:
```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "scanner": {
      "model": "openai/gpt-5-mini"
    }
  }
}
```

**Test:**
```
@scanner find all test files
```

**Expected:** Scanner now uses `gpt-5-mini` instead of `claude-haiku-4-5`

#### Test 6: Plan Mode (Built-in)

**Steps:**
1. Press **Tab** to switch to Plan mode (built-in OpenCode agent)
2. Enter: `implement user authentication`

**Expected Behavior:**
- Plan mode is read-only (no file changes)
- Provides implementation plan without modifying code
- This is OpenCode's built-in Plan agent, not our plugin

#### Test 7: Subagent Navigation

**Steps:**
1. Send a message that invokes a subagent: `@scanner find all API routes`
2. After scanner responds, use `<Leader>+Right` to navigate to the child session
3. Use `<Leader>+Left` to return to the parent session

**Expected:** Seamless navigation between parent and child sessions

### Verifying Plugin Hooks

If you installed the plugin (not just agents), test these:

| Hook | How to Test | Expected |
|------|-------------|----------|
| `tool.execute.after` | Run a grep that returns 1000+ lines | Output is truncated with `[... N lines omitted ...]` |
| `experimental.session.compacting` | Fill context until auto-compaction triggers | Compaction summary includes "Multi-Agent Orchestrator Context" with subagent list |
| `event` (session.error) | Trigger a session error | Error is logged via `client.app.log` |

---

## Manual Testing: Kilo Code Modes

### Prerequisites

1. **Install Kilo Code Extension** in VS Code
   - Open VS Code
   - Go to Extensions (`Cmd+Shift+X` / `Ctrl+Shift+X`)
   - Search for "Kilo Code"
   - Install the extension

2. **Install custom modes** (choose one method)

   **Option A: Project-level (recommended for testing)**
   ```bash
   # From the agent-orchestrator repo root:
   # Copy the combined modes file as .kilocodemodes in your target project
   cp packages/kilo-mode/kilocodemodes.json /path/to/your/project/.kilocodemodes
   ```
   The `.kilocodemodes` file in a project root is auto-detected by Kilo Code.

   **Option B: Global (applies to all projects)**
   
   Append the mode definitions to `~/.kilocode/custom_modes.yaml`:
   ```yaml
   customModes:
     - slug: orchestrator
       name: Orchestrator
       roleDefinition: "You are the Orchestrator, a multi-agent coordinator..."
       groups: [read, edit, command, mcp]
       customInstructions: "..."
     - slug: scanner
       name: Scanner
       roleDefinition: "You are the Scanner..."
       groups: [read]
       customInstructions: "..."
     - slug: advisor
       name: Advisor
       roleDefinition: "You are the Advisor..."
       groups: [read]
       customInstructions: "..."
     - slug: builder
       name: Builder
       roleDefinition: "You are the Builder..."
       groups: [read, edit, command]
       customInstructions: "..."
   ```

   Or use the JSON format — copy `kilocodemodes.json` content into `~/.kilocode/custom_modes.json`.

3. **Restart VS Code** (or reload window: `Cmd+Shift+P` → "Developer: Reload Window")

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
1. Open a project in VS Code (if using project-level install, open the project with `.kilocodemodes`)
2. Open the Kilo Code panel
3. Click the mode selector dropdown (or use Command Palette → "Kilo: Switch Mode")
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
- Has access to read, edit, command, and mcp tool groups

#### Test 3: Scanner Mode

**Steps:**
1. Select "Scanner" mode
2. Send message: `Find all TypeScript files`

**Expected Behavior:**
- Fast response (uses lightweight model like claude-haiku)
- Uses read-only tools (glob, grep, read)
- Returns file list without modifications
- No edit/command tools available (only `read` group)

#### Test 4: Advisor Mode

**Steps:**
1. Select "Advisor" mode
2. Send message: `Review the authentication implementation`

**Expected Behavior:**
- Read-only analysis (no file modifications)
- Architecture recommendations
- Security considerations mentioned
- Only `read` group tools available

#### Test 5: Builder Mode

**Steps:**
1. Select "Builder" mode
2. Send message: `Implement a new API endpoint for user profiles`

**Expected Behavior:**
- Full tool access (read, edit, command groups)
- Thorough codebase exploration first
- Pattern matching with existing code
- Complete implementation
- May run tests to verify

### Mode Configuration Verification

The combined modes file (`kilocodemodes.json` / `.kilocodemodes`) must follow this schema:

```json
{
  "customModes": [
    {
      "slug": "orchestrator",
      "name": "Orchestrator",
      "roleDefinition": "You are the Orchestrator agent...",
      "groups": ["read", "edit", "command", "mcp"],
      "customInstructions": "..."
    }
  ]
}
```

**Valid `groups` values:** `read`, `edit`, `browser`, `command`, `mcp`, `modes`

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
- [ ] **Project-level:** `.kilocodemodes` file exists in the project root (the directory you opened in VS Code)
- [ ] **Global:** `~/.kilocode/custom_modes.yaml` (or `.json`) exists and contains mode definitions
- [ ] JSON/YAML syntax valid:
  ```bash
  # Validate JSON (.kilocodemodes or custom_modes.json)
  python -m json.tool < .kilocodemodes

  # Or use Node.js
  node -e "console.log(JSON.parse(require('fs').readFileSync('.kilocodemodes','utf8')))"
  ```
- [ ] File follows the `{ "customModes": [...] }` schema (modes must be inside the `customModes` array)
- [ ] VS Code reloaded after adding/changing modes
- [ ] Kilo Code extension is up to date
- [ ] `groups` values are valid: `read`, `edit`, `browser`, `command`, `mcp`, `modes`

**Correct mode structure (inside `customModes` array):**
```json
{
  "slug": "orchestrator",
  "name": "Orchestrator",
  "roleDefinition": "...",
  "groups": ["read", "edit", "command", "mcp"],
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
- [ ] `.kilocodemodes` file placed in project root (or global `~/.kilocode/custom_modes.yaml`)
- [ ] All 4 custom modes appear in mode selector (Orchestrator, Scanner, Advisor, Builder)
- [ ] Mode switching works correctly
- [ ] Each mode uses correct tool groups (e.g., Scanner is read-only)
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
