# Jeno-Project
Doing every work which I'm thinking of

## Design skills for Claude Code

This repo ships Claude Code skills in `.claude/skills/`. They load automatically in any Claude Code session opened on this repo.

| Skill | What it does |
|---|---|
| `ui-ux-pro-max` | UI/UX rules plus a searchable database of styles, palettes, font pairings, UX guidelines and stack best practices |
| `frontend-design` | Direction for distinctive, non-templated visual design |
| `design`, `design-system`, `ui-styling`, `brand`, `banner-design`, `slides` | Companion skills from UI UX Pro Max (tokens, shadcn/Tailwind, brand, banners, HTML slides) |

Ask for a UI ("design a landing page for my HVAC service") or call a skill directly with `/ui-ux-pro-max`.

Generate a design system from the terminal (needs Python 3):

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "hvac service booking" --design-system -p "Project Name"
```

Logo, icon and banner image generation in `design` and `banner-design` also needs a `GEMINI_API_KEY`.

To update UI UX Pro Max to a newer release:

```bash
npm install -g ui-ux-pro-max-cli
uipro init --ai claude --force
```

`frontend-design` comes from [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design); to update it, copy the newer `SKILL.md` over `.claude/skills/frontend-design/SKILL.md`.

## UI UX Pro Max MCP server

`mcp/uiux_pro_max_mcp/` serves the same design database as MCP tools: generate or save a design system, search a domain, and search stack guidelines. Claude Code picks it up from `.mcp.json` as `uiux-pro-max` once you trust this folder. It needs [uv](https://docs.astral.sh/uv/). See [its README](mcp/uiux_pro_max_mcp/README.md) for Claude Desktop, HTTP mode and tests.
