# PMM-QA Agent Workflows & Configuration

- This repo has a `.agents` folder which contains workflows and context rules for the LLM to work better with in `pmm-qa` repository.
- The folder contains:
    - `workflows/`: Contains workflows for the agent to use.
    - `mcp.json`: Contains MCP server configurations for the agent.
    - `README.md`: Contains information about the agent workflows, MCP configurations and how to use them.

## Supported Workflows and How to Use Them

- There are 7 workflows in the `workflows/` folder.
- Each workflow gives LLM a specific set of instructions for a specific task.
- You can call them directly into the chat using the following commands:
    - `/` + `workflow name` in antigravity chat (e.g. `/apiIndex`)
    - `#` + `workflow name` in vscode chat (e.g. `#apiIndex`)

### List of available workflows

- `/apiIndex`: A subset of pmmApi.json, has list of common APIs used across PMM
- `/bugReport`: Use this workflow to generate a bug report out of failing tests or unexpected behavior.
- `/mcpRules`: Defines execution rules for the LLM when using Playwright MCP.
- `/pmmLogin`: Use this workflow to login to PMM using basic Auth headers via MCP instead of the UI.
- `/pomRules`: Use this to create a new Page Object Model (POM) or update an existing POM.
- `/report`: Rules for the LLM to generate a handoff report that summarizes actions performed and findings.
- `/workflowIndex`: This is the entry point for LLM. It guides the agent on which workflow to pick based on your current task.

---

## MCP Integration

- Use the following configuration file or pass necessary arguments to the Playwright MCP server:
- This config is used to save tokens.

```json
{
  "mcpServers": {
    "playwright": {
      "args": [
        "-y",
        "@playwright/mcp@latest",
        "--ignore-https-errors",
        "--snapshot-mode",
        "none",
        "--image-responses",
        "omit"
      ],
      "command": "npx"
    }
  }
}
```
## Suggestions
- Use the workflows defined in the `workflows/` folder.
- Either call individual workflows or use `/workflowIndex` to let the agent pick the right workflow.