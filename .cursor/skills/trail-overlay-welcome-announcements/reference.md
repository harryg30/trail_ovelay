# Reference: Notion URLs and troubleshooting

## Public summary vs Notion detail

The agent **reads** Notion (including long bodies and checklists) to understand work, then writes **one short sentence per upcoming line** in `latest.json`. **Do not** add `notionUrl` to welcome bullets — users are not sent to Notion from each item; the separate **Open the work board in Notion** link in the modal covers that.

**Bad → Good (examples):**

- Bad: `- [ ] A user can upload a video…` (pasted checklist)  
  Good: `We’re planning a tutorials hub so you can learn the app from short videos inside Trail Overlay.`

- Bad: `Strava API key limit update (infrastructure).`  
  Good: `We’re updating how Trail Overlay talks to Strava as their API rules change.`

## Default What’s New

Unless the product owner asks to change them, keep:

1. `Create and edit trails directly on the map with our new drawing tools.`
2. `Trail details now appear inside Strava route builder via the Chrome extension. (experimental)`
3. `Sandbox mode lets you try editing on the map before you sign in, and save drafts when you’re logged in.`

## Config template

Paste into the skill config section (or here) when sources change:

```
NOTION_KANBAN_DATABASE=https://www.notion.so/<workspace>/<Name>-<id>?v=<view>
```

For this repository, the board URL is commonly:

- `https://www.notion.so/71d8e1836c7347cfaf4205aa3c128abb`

Use `notion-fetch` on the database URL to read each `<data-source url="collection://...">`. Use that **exact** `collection://` string as `data_source_url` in `notion-search` — not the database page URL.

## Kanban status filtering

1. `notion-fetch` the database and read select options for the Status (or equivalent) property.
2. Encode lane names in the **semantic query** for `notion-search`.
3. **Output:** only set JSON `status` to `"In progress"` for *In Progress* rows; omit for other lanes.

## notion-search filters

- `filters` is **required** by the tool schema; use `{}` if no date or creator filter is needed.

## Archive naming

Use UTC and filesystem-safe characters, e.g.:

`2026-04-07T14-30-00Z.json`

## localStorage dismiss key

[app/ClientPage.tsx](../../../app/ClientPage.tsx) uses:

`announcement_dismissed_v${ANNOUNCEMENT_VERSION}`

`ANNOUNCEMENT_VERSION` equals [announcements/latest.json](../../../announcements/latest.json) → `updatedAt`. Changing `updatedAt` prompts a fresh announcement for users who had dismissed an older version.
