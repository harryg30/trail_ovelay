# Documentation map (this repository)

Use this table to decide **where** to document a change. Read the named file before editing.

| Change area | Primary doc(s) | Also check |
|-------------|------------------|------------|
| Repo overview, stack, high-level layout, deployment summary | `README.md` | `AGENTS.md` if it affects agent guidance |
| API response shape, route helpers, CORS rules | `docs/API_CONVENTIONS.md` | `README.md` if public API surface changes |
| UI components, patterns | `docs/COMPONENT_GUIDE.md` | `README.md` architecture block if structure shifts |
| Modes / feature flags / UI state machine | `docs/MODE_SYSTEM.md` | Component guide and README if user-visible |
| AI/agent working agreements, Next.js notes | `AGENTS.md`, `CLAUDE.md` | `.llm` only if project instructs updates there |
| Cursor-specific automation | `.cursor/rules`, skills under `.cursor/skills/` | — |

## README architecture block

The ASCII tree in `README.md` should stay in sync when `app/`, `lib/`, or major folders move or gain prominent routes.

## API changes

If a route’s URL, method, JSON keys, or error contract changes, update `docs/API_CONVENTIONS.md` and any examples in `README.md` that cite that route.
