# UI UX Pro Max MCP server

An MCP server that gives any MCP client (Claude Code, Claude Desktop, other agents) the UI UX Pro Max design database as tools: design-system generation, focused searches across 12 domains, and implementation guidelines for 22 stacks.

It has no data of its own. It imports the search engine and data from the installed skill at `.claude/skills/ui-ux-pro-max`, so updating the skill updates the server.

## Tools

| Tool | What it does | Writes files |
|---|---|---|
| `uiux_generate_design_system` | Full recommendation for a product or page: pattern, style, colors, fonts, effects, anti-patterns, checklist. Optional `variance`, `motion` and `density` dials (1-10). | No |
| `uiux_save_design_system` | Same, saved as `design-system/<project>/MASTER.md` plus optional `pages/<page>.md` under an absolute `output_dir`. Never overwrites unless `overwrite=true`. | Yes |
| `uiux_search` | Ranked search in one domain: `product`, `style`, `color`, `typography`, `google-fonts`, `landing`, `chart`, `ux`, `icons`, `gsap`, `react`, `web`. | No |
| `uiux_search_stack` | Guidelines with do/don't and code for a stack such as `react`, `nextjs`, `flutter`, `swiftui` or `html-tailwind`. | No |
| `uiux_get_catalog` | Lists the domains, stacks and record counts. | No |

Search tools accept `response_format: "markdown" | "json"`. A result with 0 matches means the database has no verified answer, and the response lists the closest known terms.

## Use it in Claude Code

The repo's `.mcp.json` registers the server as `uiux-pro-max`, and `.claude/settings.json` approves it. Claude Code applies that approval once you trust the folder: the first time you run `claude` here, accept the workspace trust prompt (or approve the server when asked). Then check it with `/mcp` or `claude mcp get uiux-pro-max`.

Requirements: [uv](https://docs.astral.sh/uv/) and Python 3.10+. The first launch downloads the `mcp` package, which needs network access. The launcher uses `sh`, so on Windows run Claude Code from Git Bash or WSL.

## Use it elsewhere

Claude Desktop or any stdio client (use absolute paths):

```json
{
  "mcpServers": {
    "uiux-pro-max": {
      "command": "uv",
      "args": ["run", "--quiet", "--script", "/path/to/Jeno-Project/mcp/uiux_pro_max_mcp/server.py"]
    }
  }
}
```

Over HTTP (streamable HTTP, stateless, JSON responses):

```bash
uv run mcp/uiux_pro_max_mcp/server.py --http --port 8000   # serves http://127.0.0.1:8000/mcp
```

It binds to `127.0.0.1` by default. Put it behind authentication before exposing it beyond your machine.

To point the server at a skill installed somewhere else, set `UIUX_PRO_MAX_SKILL_DIR` to the folder containing that skill's `SKILL.md`.

## Test

```bash
uv run --no-project --with mcp==2.2.0 --with pytest pytest mcp/uiux_pro_max_mcp/tests
```

The suite covers every tool and stack, input validation, the no-overwrite rule for saving, path safety, and a real stdio launch of the server.

`evaluation.xml` holds 10 questions for checking how well an LLM answers with these tools. To run it with the mcp-builder harness (needs `ANTHROPIC_API_KEY`):

```bash
python evaluation.py mcp/uiux_pro_max_mcp/evaluation.xml -t stdio -m claude-sonnet-5-5 \
  -c uv -a run mcp/uiux_pro_max_mcp/server.py
```

## Updating

Update the skill with `npm install -g ui-ux-pro-max-cli`, then `uipro init --ai claude --force`. If a release adds a domain or stack, the server refuses to start and names the difference; add it to the `Domain` or `Stack` list in `server.py`.
