# Omega Engineers Service Station — Offline Desktop App

This package is the implementation handoff for Antigravity / an AI coding agent.

## Final target
- Windows desktop application
- Fully offline after installation
- Electron desktop shell
- React + HTML5 + CSS3 + JavaScript UI
- Node.js application/business-logic layer
- SQLite local database
- Final release as `Omega Engineers Service Station Setup.exe`

## Start here
1. Read `START_HERE_ANTIGRAVITY.md`.
2. Read `MASTER_IMPLEMENTATION_GUIDE.md` completely before changing code.
3. Read the original project proposal in `source/`.
4. Treat `designs/` as the visual source of truth.
5. Implement in stages and run the regression checklist after every stage.

## Important architectural decision
The academic proposal originally describes a centralized web-based system and lists Node.js among backend choices, React/HTML/CSS/JavaScript among frontend choices, and MySQL/PostgreSQL among database choices. This implementation adapts that scope to a **fully offline desktop application** by using Electron and SQLite while preserving the functional business requirements.

See `docs/PROJECT_SCOPE_SOURCE_NOTES.md` for the exact implementation adaptation.
