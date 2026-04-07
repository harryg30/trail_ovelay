---
name: sync-docs-with-changes
description: Keeps README, docs/, and agent-facing markdown aligned with code changes from chat sessions or feature branches. Use after implementing or refactoring behavior, APIs, env vars, architecture, or UI flows; before opening a PR or when the user asks to update documentation.
---

# Sync docs with code changes

## When to apply

Run this workflow **before** considering a task “done” if the change affects any of:

- Public or CORS API contracts, routes, or response shapes
- Environment variables, deployment, or local setup
- Data model, migrations, or storage
- Major UI/UX flows users or contributors rely on
- Architecture (how pieces connect), caching, or build/runtime constraints
- Conventions the team encodes in markdown (API patterns, component rules, mode system)

Skip only when the change is purely internal with **no** observable or operational impact.

## Workflow

1. **Inventory the diff** (mentally or via `git diff`): list files and *what behavior changed* — not only what was edited.

2. **Map changes → documentation** using [reference.md](reference.md). Prefer updating an existing section over adding parallel docs.

3. **Patch docs in the same branch/session** as the code:
   - Fix outdated paths, names, endpoints, env keys, and diagrams.
   - Add short “why” only when it prevents repeat mistakes; avoid duplicating code line-by-line.

4. **Consistency checks**
   - Cross-links still resolve (relative paths).
   - Examples match real types/helpers (e.g. imports, response helpers).
   - `AGENTS.md` / agent rules reflect new constraints agents must follow.

5. **If uncertain** whether docs need updating, default to a **one-line changelog-style note** in the most relevant doc (e.g. API section or README “Recent changes”) rather than leaving silent drift.

## Scope discipline

- Touch only documentation files that the change actually invalidates or extends.
- Do not rewrite unrelated guides or expand scope beyond explaining the change.

## Optional: end-of-task checklist

Copy into the reply when wrapping up a multi-file change:

```
Docs sync:
- [ ] README (setup, architecture, links)
- [ ] docs/* (topic-specific)
- [ ] AGENTS.md / CLAUDE.md if agent behavior or repo rules changed
```
