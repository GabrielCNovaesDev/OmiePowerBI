"use strict";

const { query } = require("../db/pool");
const { decryptSecret } = require("./secret");

async function tableReady() {
  try {
    await query("SELECT 1 FROM ops.aplicativo LIMIT 1");
    return true;
  } catch {
    return false;
  }
}

async function listAplicativos({ onlySyncable = false, onlyAtivos = true } = {}) {
  if (!(await tableReady())) return [];
  const r = await query(
    `SELECT id, apelido, razao_social_cache, app_key, ativo, sync_habilitado,
            ultima_sync_at, ultima_sync_status
     FROM ops.aplicativo
     WHERE ($1::bool = false OR ativo = true)
       AND ($2::bool = false OR sync_habilitado = true)
     ORDER BY apelido, id`,
    [onlyAtivos, onlySyncable]
  );
  return r.rows;
}

async function resolveOmieCreds(appKey) {
  if (await tableReady()) {
    if (appKey) {
      const r = await query(
        `SELECT app_key, app_secret_encrypted
         FROM ops.aplicativo
         WHERE app_key = $1 AND ativo = true`,
        [appKey]
      );
      const row = r.rows[0];
      if (!row) {
        throw new Error(`Aplicativo Omie nao encontrado ou inativo: ${appKey}`);
      }
      return {
        app_key: row.app_key,
        app_secret: decryptSecret(row.app_secret_encrypted),
      };
    }
    const listed = await listAplicativos({ onlySyncable: true, onlyAtivos: true });
    if (listed.length === 1) {
      return resolveOmieCreds(listed[0].app_key);
    }
    if (listed.length > 1) {
      throw new Error("Varios aplicativos cadastrados. Use: npm run load:all  ou  node scripts/load-full.js <app_key>");
    }
  }

  const envKey = process.env.OMIE_APP_KEY;
  const envSecret = process.env.OMIE_APP_SECRET;
  if (envKey && envSecret) {
    return { app_key: envKey, app_secret: envSecret };
  }

  throw new Error("Nenhuma credencial Omie disponivel (cadastre ops.aplicativo ou OMIE_APP_KEY no .env)");
}

async function markSync(appKey, status) {
  if (!(await tableReady())) return;
  await query(
    `UPDATE ops.aplicativo
     SET ultima_sync_at = NOW(), ultima_sync_status = $2, updated_at = NOW()
     WHERE app_key = $1`,
    [appKey, status]
  );
}

module.exports = { listAplicativos, resolveOmieCreds, markSync, tableReady };
