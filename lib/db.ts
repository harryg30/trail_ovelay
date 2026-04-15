import { attachDatabasePool } from "@vercel/functions";
import { Pool, PoolClient } from "pg";
import {
  applyDatabaseUrlFallback,
  poolSsl,
} from "./pg-connection-env.mjs";

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  applyDatabaseUrlFallback();
  const host = process.env.TRAIL_DB_PGHOST;
  const user = process.env.TRAIL_DB_PGUSER;
  const password = process.env.TRAIL_DB_PGPASSWORD;
  if (!host || !user || !password?.length) {
    throw new Error(
      "Database not configured: set DATABASE_URL or TRAIL_DB_* with a non-empty password (see README)."
    );
  }
  pool = new Pool({
    host,
    user,
    database: process.env.TRAIL_DB_PGDATABASE || "postgres",
    password,
    port: Number(process.env.TRAIL_DB_PGPORT) || 5432,
    ssl: poolSsl(),
    max: 20,
  });
  attachDatabasePool(pool);
  return pool;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- row shape is defined by each SQL caller */
export async function query<T = any>(text: string, values?: any[]): Promise<T[]> {
  const result = await getPool().query(text, values);
  return result.rows;
}

export async function queryOne<T = any>(text: string, values?: any[]): Promise<T | null> {
  const result = await getPool().query(text, values);
  return result.rows[0] || null;
}

/** DB client helpers — pass to transactional callbacks */
export interface TxClient {
  query<T = any>(text: string, values?: any[]): Promise<T[]>;
  queryOne<T = any>(text: string, values?: any[]): Promise<T | null>;
}

function wrapClient(client: PoolClient): TxClient {
  return {
    async query<T = any>(text: string, values?: any[]): Promise<T[]> {
      const result = await client.query(text, values);
      return result.rows;
    },
    async queryOne<T = any>(text: string, values?: any[]): Promise<T | null> {
      const result = await client.query(text, values);
      return result.rows[0] || null;
    },
  };
}

/**
 * Run `fn` inside a single serialisable DB transaction.
 * Commits on success, rolls back on throw.
 */
export async function withTransaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(wrapClient(client));
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
