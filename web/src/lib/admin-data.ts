import { query, getPool } from "@/lib/db";

export type AplicativoRow = {
  id: string;
  apelido: string;
  razao_social_cache: string | null;
  app_key: string;
  ativo: boolean;
  sync_habilitado: boolean;
  ultima_sync_at: string | null;
  ultima_sync_status: string | null;
  modulos_desativados: string[];
};

export type UsuarioRow = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  ativo: boolean;
  last_login_at: string | null;
  empresas: string[];
};

export async function listAplicativos(): Promise<AplicativoRow[]> {
  return query<AplicativoRow>(
    `SELECT id::text, apelido, razao_social_cache, app_key, ativo, sync_habilitado,
            ultima_sync_at::text, ultima_sync_status::text, modulos_desativados
     FROM ops.aplicativo
     ORDER BY apelido, id`
  );
}

export async function getAplicativo(id: string): Promise<AplicativoRow | null> {
  const rows = await query<AplicativoRow>(
    `SELECT id::text, apelido, razao_social_cache, app_key, ativo, sync_habilitado,
            ultima_sync_at::text, ultima_sync_status::text, modulos_desativados
     FROM ops.aplicativo WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getAplicativoSecret(id: string): Promise<string | null> {
  const rows = await query<{ app_secret_encrypted: string }>(
    `SELECT app_secret_encrypted FROM ops.aplicativo WHERE id = $1`,
    [id]
  );
  return rows[0]?.app_secret_encrypted ?? null;
}

export async function listUsuarios(): Promise<UsuarioRow[]> {
  return query<UsuarioRow>(
    `SELECT u.id::text, u.nome, u.email, u.papel::text AS papel, u.ativo,
            u.last_login_at::text,
            COALESCE(array_agg(a.apelido ORDER BY a.apelido) FILTER (WHERE a.id IS NOT NULL), '{}') AS empresas
     FROM auth.usuario u
     LEFT JOIN auth.usuario_aplicativo ua ON ua.usuario_id = u.id
     LEFT JOIN ops.aplicativo a ON a.id = ua.aplicativo_id
     GROUP BY u.id
     ORDER BY u.papel, u.nome`
  );
}

export async function getUsuario(id: string) {
  const rows = await query<{
    id: string;
    nome: string;
    email: string;
    papel: string;
    ativo: boolean;
  }>(
    `SELECT id::text, nome, email, papel::text AS papel, ativo
     FROM auth.usuario WHERE id = $1`,
    [id]
  );
  const user = rows[0];
  if (!user) return null;
  const apps = await query<{ aplicativo_id: string }>(
    `SELECT aplicativo_id::text FROM auth.usuario_aplicativo WHERE usuario_id = $1`,
    [id]
  );
  return { ...user, aplicativoIds: apps.map((a) => a.aplicativo_id) };
}

export async function replaceUsuarioApps(usuarioId: string, aplicativoIds: string[]) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM auth.usuario_aplicativo WHERE usuario_id = $1`, [usuarioId]);
    for (const appId of aplicativoIds) {
      await client.query(
        `INSERT INTO auth.usuario_aplicativo (usuario_id, aplicativo_id) VALUES ($1,$2)`,
        [usuarioId, appId]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listSyncJobs(limit = 30) {
  return query<{
    id: string;
    app_key: string | null;
    origem: string;
    status: string;
    erro: string | null;
    created_at: string;
    finished_at: string | null;
    apelido: string | null;
    email: string | null;
  }>(
    `SELECT j.id::text, j.app_key, j.origem, j.status, j.erro,
            j.created_at::text, j.finished_at::text,
            a.apelido, u.email
     FROM ops.sync_job j
     LEFT JOIN ops.aplicativo a ON a.id = j.aplicativo_id
     LEFT JOIN auth.usuario u ON u.id = j.solicitado_por
     ORDER BY j.created_at DESC
     LIMIT $1`,
    [limit]
  );
}
