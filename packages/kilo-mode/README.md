# Multi-Agent Orchestrator for Kilo Code

Bring multi-agent orchestration to Kilo Code with custom modes.

## Installation

### Option 1: Project-Level (Recommended)

Copy the combined modes file to your project root as `.kilocodemodes`:

```bash
# From the agent-orchestrator repo
cp packages/kilo-mode/kilocodemodes.json /path/to/your/project/.kilocodemodes
```

Kilo Code auto-detects `.kilocodemodes` in the project root.

### Option 2: Global Install

Append mode definitions to the global Kilo Code config:

**JSON format:** Copy `kilocodemodes.json` content to `~/.kilocode/custom_modes.json`

**YAML format:** Add to `~/.kilocode/custom_modes.yaml`:

```yaml
customModes:
  - slug: orchestrator
    name: Orchestrator
    roleDefinition: "..."
    groups: [read, edit, command, mcp]
    customInstructions: "..."
  # ... (see kilocodemodes.json for full definitions)
```

After install, reload VS Code: `Cmd+Shift+P` / `Ctrl+Shift+P` → "Developer: Reload Window"

## Available Modes

| Mode | Slug | Tool Groups | Description |
|------|------|-------------|-------------|
| **Orchestrator** | `orchestrator` | read, edit, command, mcp | Main coordinator for multi-agent workflows |
| **Scanner** | `scanner` | read | Fast codebase exploration (read-only) |
| **Advisor** | `advisor` | read | Architecture review and debugging (read-only) |
| **Builder** | `builder` | read, edit, command | Deep autonomous coding |

## Usage

### Switch Modes

1. Open the Kilo Code panel in VS Code
2. Click the mode selector dropdown
3. Choose a mode (e.g., "Orchestrator")

Or use Command Palette: `Cmd+Shift+P` → "Kilo: Switch Mode"

### Agent Delegation

In Orchestrator mode, mention agents with `@`:

```
@scanner find all test files
@researcher look up jest best practices
@advisor review the test architecture
```

### Keyword Triggers

- `ultrawork` / `ulw` — Maximum intensity mode
- `parallel` / `||` — Force parallel execution
- `think` — Extended reasoning

### Example

```
ulw build a REST API with user authentication
```

The orchestrator will:
1. Analyze the task
2. Launch @scanner, @researcher, @advisor in parallel
3. Delegate implementation to @builder
4. Verify completion

## Files

| File | Purpose |
|------|---------|
| `kilocodemodes.json` | Combined modes file — copy as `.kilocodemodes` to project root |
| `modes/*.json` | Individual mode definitions (reference only) |
| `skills/orchestrator/SKILL.md` | Orchestrator skill definition |

## Customization

Edit `kilocodemodes.json` (or your `.kilocodemodes` file) to customize:
- `roleDefinition` — The agent's system prompt
- `customInstructions` — Detailed behavioral instructions
- `groups` — Tool permission groups (`read`, `edit`, `browser`, `command`, `mcp`, `modes`)
