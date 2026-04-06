import { awsCredentialsProvider } from "@vercel/functions/oidc";
import { attachDatabasePool } from "@vercel/functions";
import { Signer } from "@aws-sdk/rds-signer";
import { Pool } from "pg";

const signer = new Signer({
  hostname: process.env.TRAIL_DB_PGHOST!,
  port: Number(process.env.TRAIL_DB_PGPORT),
  username: process.env.TRAIL_DB_PGUSER!,
  region: process.env.TRAIL_DB_AWS_REGION!,
  // On Vercel: use OIDC federation. Locally: fall back to ~/.aws/credentials
  ...(process.env.VERCEL && {
    credentials: awsCredentialsProvider({
      roleArn: process.env.TRAIL_DB_AWS_ROLE_ARN!,
      clientConfig: { region: process.env.TRAIL_DB_AWS_REGION! },
    }),
  }),
});

const pool = new Pool({
  host: process.env.TRAIL_DB_PGHOST,
  user: process.env.TRAIL_DB_PGUSER,
  database: process.env.TRAIL_DB_PGDATABASE || "postgres",
  password: process.env.TRAIL_DB_PGPASSWORD
    ? process.env.TRAIL_DB_PGPASSWORD
    : () => signer.getAuthToken(),
  port: Number(process.env.TRAIL_DB_PGPORT),
  ssl: process.env.TRAIL_DB_PGPASSWORD ? false : { rejectUnauthorized: false },
  max: 20,
});

attachDatabasePool(pool);

export async function query<T = any>(
  text: string,
  values?: any[]
): Promise<T[]> {
  const result = await pool.query(text, values);
  return result.rows;
}

export async function queryOne<T = any>(
  text: string,
  values?: any[]
): Promise<T | null> {
  const result = await pool.query(text, values);
  return result.rows[0] || null;
}
