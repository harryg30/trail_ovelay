Run pending database migrations for this project.

1. Ensure `.env.local` (or the shell) defines database access — see README **Environment variables**:
   - **Preferred (Vercel / Neon):** `DATABASE_URL` (mapped to `TRAIL_DB_*` via [`lib/pg-connection-env.mjs`](lib/pg-connection-env.mjs)).
   - **Optional:** `DATABASE_URL_MIGRATE` — direct (non-pooler) URL; overwrites `TRAIL_DB_*` for migrate scripts only when both are set.
   - **Local Docker:** discrete `TRAIL_DB_*` with non-empty `TRAIL_DB_PGPASSWORD`, or a local `DATABASE_URL`.
2. Run from the repo root:

   ```bash
   npm run db:migrate
   ```

   This runs `scripts/migrate-local.mjs`, which applies numbered `.sql` files in `migrations/` in order and records them in `_migrations`. Already-applied files are skipped.

3. Report which migrations ran (`apply` vs `skip`) and whether the run succeeded.

Do **not** use raw `psql` unless you intentionally bypass the migration tracker — the npm script is the source of truth for local dev.
