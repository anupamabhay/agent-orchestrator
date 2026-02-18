# Multi-Agent Orchestrator for Kilo Code

Bring multi-agent orchestration to Kilo Code with custom modes and skills.

## Installation

### Option 1: Copy to Kilo Config

```bash
# Copy modes
cp -r modes/* ~/.kilo/modes/

# Copy skills
cp -r skills/* ~/.kilo/skills/
```

### Option 2: Project-Level

```bash
# In your project root
mkdir -p .kilo/modes .kilo/skills
cp -r modes/* .kilo/modes/
cp -r skills/* .kilo/skills/
```

## Available Modes

| Mode | Description |
|------|-------------|
| `orchestrator` | Main coordinator for multi-agent workflows |
| `scanner` | Fast codebase exploration |
| `advisor` | Architecture review and debugging (read-only) |
| `builder` | Deep autonomous coding |

## Usage

### Switch to Orchestrator Mode

In Kilo Code, switch to Orchestrator mode to enable multi-agent coordination:

1. Open command palette
2. Select "Kilo: Switch Mode"
3. Choose "Orchestrator"

### Use the Skill

The orchestrator skill activates automatically when you use keywords:

- `ultrawork` or `ulw` - Maximum intensity mode
- `parallel` or `||` - Force parallel execution
- `think` - Extended reasoning

### Example

```
ulw build a REST API with user authentication
```

The orchestrator will:
1. Analyze the task
2. Launch @scanner, @researcher, @advisor in parallel
3. Delegate implementation to @builder
4. Verify completion

## Customization

Edit the JSON files in `modes/` to customize:
- Role definitions
- Custom instructions
- Permission groups

## Agent Delegation

In orchestrator mode, mention agents with @:

```
@scanner find all test files
@researcher look up jest best practices
@advisor review the test architecture
```
