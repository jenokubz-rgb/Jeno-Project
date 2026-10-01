#!/bin/bash
# SessionStart hook (Claude Code on the web only): install the SBP AirCare prototype's dev tools so
# `npm run smoke | smoke:mobile | textscan | build` work as soon as the session starts.
# Chromium comes from the environment (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers) — never run `playwright install`.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR/sbp-aircare" 2>/dev/null || exit 0
npm install --no-audit --no-fund
# build.py calls `npx --yes esbuild@0.28.2` — fetch it once so builds don't wait on the registry
npx --yes esbuild@0.28.2 --version > /dev/null

# The internal Pricebook extract is gitignored (special/project rates — never commit it); recon needs it.
if [ ! -f internal/sbp_real.json ]; then
  echo "sbp-aircare: internal/sbp_real.json is missing — 'npm run recon' cannot run until the owner uploads it (see sbp-aircare/CLAUDE.md §7)."
fi
