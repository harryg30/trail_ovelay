---
name: trail-overlay-welcome-announcements
description: Refreshes Trail Overlay welcome/about announcements from Notion into announcements/latest.json with archive snapshots; short public summaries only (no per-item links). Use when updating the welcome modal, refreshing upcoming from the Notion work board, or the user mentions trail-overlay announcements.
---

# Trail Overlay welcome announcements (Notion → repo)

## Audience

The welcome modal is a **lightweight progress update for riders and general users**, not an engineering changelog. Copy should signal that **work is active and shipping**. Dense task lists, acceptance criteria, and internal board jargon stay **in Notion** — the agent uses Notion for research only; **`latest.json` does not link to Notion pages** on each bullet (the roadmap link in the modal body is enough).

## Goal

1. Pull **Upcoming** (in flight / next) from Notion (configurable sources below). Use Notion only to **inform** concise summaries.
2. **Summarize** each upcoming item in **one short sentence** of plain language. Do **not** paste Notion page bodies, checklists, or property dumps into `summary`.
3. **Do not** set `notionUrl` on `whatsNew` or `upcoming` items for the welcome modal. Omit the field (or leave unset). Optional `notionUrl` exists in the type for rare cases but **defaults to unused** for this product.
4. Write `announcements/latest.json` (overwrite).
5. **Before overwriting**, copy the existing `latest.json` to `announcements/archive/` using a filename like `YYYY-MM-DDTHH-mm-ssZ.json` (UTC, filesystem-safe).
6. Set `updatedAt` in the new JSON to the current instant (ISO-8601). The app uses this as `ANNOUNCEMENT_VERSION` so users who dismissed an older announcement may see the modal again.

Do **not** hand-edit `latest.json` for routine updates; regenerate via this workflow.

## What’s New (stable copy)

Keep the **default What’s New** lines unless the product owner explicitly asks to replace them. Default bullets:

1. `Create and edit trails directly on the map with our new drawing tools.`
2. `Trail details now appear inside Strava route builder via the Chrome extension. (experimental)`
3. `Sandbox mode lets you try editing on the map before you sign in, and save drafts when you’re logged in.`

When refreshing from this skill, **preserve these `whatsNew` entries** unless the user instructs otherwise. Notion “Done” work can inform future edits but does not automatically overwrite these lines.

## Summary style rules (upcoming)

| Do | Don’t |
|----|--------|
| Outcomes users feel | Internal ticket titles alone |
| Friendly, confident tone (“We’re …”) | “Spike”, “infra”, blocked states in user copy |
| One line (~12–22 words) | Multi-line or pasted bullets from Notion |
| No links in bullets | `notionUrl` on rows |

**`status` field (`upcoming` only):** Omit for most items. Set **only** `"In progress"` when Notion **Status** is *In Progress* — the UI shows that as a small public badge. Omit for *To Do*, *Blocked*, *Spike*, etc.

## JSON shape (contract)

Must match `AnnouncementLatestPayload` in [lib/announcement.ts](../../../lib/announcement.ts):

- `updatedAt`: string (ISO-8601)
- `headline`: string (modal title)
- `whatsNew`: `{ title?, summary, notionUrl? }[]` — typically **no** `notionUrl`
- `upcoming`: `{ title?, summary, notionUrl?, status? }[]` — typically **no** `notionUrl`; `status` only `"In progress"` when applicable

Deduplicate by `title`+`summary`.

## Config (fill in for this repo)

| Key | Purpose |
|-----|---------|
| `NOTION_WHATS_NEW` | Optional; reserved if you later track shipped work separately. **Do not** replace the default `whatsNew` lines unless asked. |
| `NOTION_KANBAN_DATABASE` | Full Notion **database** URL for the work board (same board linked from the modal roadmap). |

**Defaults for this project (edit if URLs change):**

- Kanban / board: `https://www.notion.so/71d8e1836c7347cfaf4205aa3c128abb`

## Notion MCP workflow

Use the **Notion** MCP (`plugin-notion-workspace-notion`). Always read tool schemas before calling (`notion-fetch`, `notion-search`, etc.).

### 1) Discover kanban schema

- `notion-fetch` with `id` = `NOTION_KANBAN_DATABASE`.
- Read `<data-source url="collection://...">` for the active source.
- Note property names for **title** and **status** (or select) columns.

### 2) Upcoming items

- `notion-search` with `data_source_url` = that `collection://…` value.
- Use a **semantic query** for work **not** in *Done* (e.g. *To Do*, *In progress*, *Blocked*).
- `notion-fetch` rows you include for context — **summarize** into one user-facing sentence each; **no** `notionUrl`.
- `status`: `"In progress"` only when Notion Status is *In Progress*; otherwise omit.

### 3) What’s New items

- **Preserve** the default two `whatsNew` bullets (see above) unless the user explicitly requests changes.

### 4) Compose and write

1. Build the JSON object; validate against the contract and **summary style rules**.
2. If [announcements/latest.json](../../../announcements/latest.json) exists, copy it to `announcements/archive/<timestamp>.json`.
3. Write the new `latest.json`.
4. Run `npx tsc --noEmit` (or project check) to ensure imports still typecheck.

## Verification

- Optional: open the welcome modal — bullets are plain text (no links except the existing roadmap link in the modal).

## Extension: GitHub PRs (out of scope by default)

Future: optionally merge merged PR titles into `whatsNew` **still summarized**, and still **without** per-item links unless product changes policy.

Further detail: [reference.md](reference.md).
