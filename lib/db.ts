import { Pool } from "pg";

let pool: Pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}

export async function query<T = any>(
  text: string,
  values?: any[]
): Promise<T[]> {
  const result = await getPool().query(text, values);
  return result.rows;
}

export async function queryOne<T = any>(
  text: string,
  values?: any[]
): Promise<T | null> {
  const result = await getPool().query(text, values);
  return result.rows[0] || null;
}
