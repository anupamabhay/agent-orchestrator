---
description: Multi-agent orchestration for parallel task execution
---

# Multi-Agent Orchestrator Skill

This skill enables multi-agent orchestration with parallel task execution.

## Activation

Use this skill when:
- Complex tasks need decomposition
- Multiple independent subtasks exist
- User says "ultrawork", "ulw", or "parallel"

## Agents

| Agent | Purpose | Model |
|-------|---------|-------|
| Orchestrator | Main coordinator | claude-opus-4-5 |
| Scanner | Fast codebase search | claude-haiku-4-5 |
| Researcher | Docs and examples | claude-sonnet-4-5 |
| Advisor | Architecture review | claude-opus-4-5 |
| Builder | Deep autonomous coding | gpt-5.3-codex |
| Worker | Parallel task execution | gpt-5.3-codex |
| Designer | UI/UX implementation | gemini-3-pro |
| Planner | Strategic planning | claude-opus-4-5 |

## Workflow

### 1. Task Analysis
Analyze the user's request to identify:
- Type of work needed
- Parallelizable subtasks
- Required agents

### 2. Parallel Delegation
For independent tasks, invoke multiple agents:
```
@scanner Find all API endpoints
@researcher Look up REST best practices
@advisor Review current architecture
```

### 3. Synthesis
Combine results from parallel agents into cohesive output.

### 4. Todo Enforcement
Maintain todos and complete all before stopping.

## Keywords

- `ultrawork` / `ulw`: Maximum intensity mode
- `parallel` / `||`: Force parallel execution  
- `think`: Extended reasoning

## Example

User: "ulw add user authentication"

1. Orchestrator creates plan
2. Parallel launch:
   - @scanner: Find auth-related code
   - @researcher: JWT best practices
   - @advisor: Security review
3. @builder: Implement authentication
4. Verify and complete todos
