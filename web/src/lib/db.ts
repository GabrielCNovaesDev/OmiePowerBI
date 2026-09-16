import { Pool } from "pg";

const globalForPool = globalThis as unknown as { pool?: Pool };

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL nao configurada");
  }
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("channel_binding");
    return parsed.toString();
  } catch {
    return url;
  }
}

export function getPool(): Pool {
  if (!globalForPool.pool) {
    globalForPool.pool = new Pool({
      connectionString: databaseUrl(),
      max: 4,
      connectionTimeoutMillis: 20000,
      idleTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false },
    });
  }
  return globalForPool.pool;
}

function retryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /timeout|ECONN|ENOTFOUND|terminated|cold|closed|Connection|ssl|connect/i.test(msg);
}

export async function query<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  let last: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await getPool().query(text, params);
      return result.rows as T[];
    } catch (err) {
      last = err;
      console.error("SQL_ERROR", attempt, err instanceof Error ? err.message : err);
      if (!retryable(err) || attempt === 3) break;
      await new Promise((r) => setTimeout(r, 700 * attempt));
    }
  }
  throw last;
}
