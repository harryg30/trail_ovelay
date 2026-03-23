Run all pending database migrations for this project.

1. Read the `DATABASE_URL` from `.env.local` to find the connection string.
2. List all `.sql` files in the `migrations/` directory, sorted by filename (they are numbered like `001_...`, `002_...`).
3. For each migration file in order, run it against the database using psql:
   ```
   psql "$DATABASE_URL" -f migrations/<filename>.sql
   ```
4. Report which migrations were run and whether they succeeded or failed.

Note: All migrations use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so they are safe to re-run — already-applied migrations will be skipped automatically.
