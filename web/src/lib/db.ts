import { Pool } from "pg";

const globalForPool = globalThis as unknown as { pool?: Pool };

export function getPool(): Pool {
  if (!globalForPool.pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL nao configurada");
    }
    globalForPool.pool = new Pool({
      connectionString: url,
      max: 6,
      ssl: { rejectUnauthorized: false },
    });
  }
  return globalForPool.pool;
}

export async function query<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}
