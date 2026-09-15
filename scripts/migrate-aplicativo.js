require("dotenv").config();
const { encryptSecret } = require("../src/lib/secret");
const { getPool, query } = require("../src/db/pool");

async function main() {
  const appKey = process.env.OMIE_APP_KEY;
  const appSecret = process.env.OMIE_APP_SECRET;
  if (!appKey || !appSecret) {
    throw new Error("Defina OMIE_APP_KEY e OMIE_APP_SECRET no .env");
  }
  if (!process.env.APP_ENCRYPTION_KEY && !process.env.ENCRYPTION_KEY) {
    throw new Error("Defina APP_ENCRYPTION_KEY no .env antes de migrar o secret");
  }

  const emp = await query(
    `SELECT razao_social, nome_fantasia FROM dim.empresa WHERE app_key = $1 ORDER BY id LIMIT 1`,
    [appKey]
  ).catch(() => ({ rows: [] }));
  const row = emp.rows && emp.rows[0];
  const apelido =
    process.env.OMIE_APELIDO ||
    process.env.OMIE_APP_NAME ||
    (row && (row.nome_fantasia || row.razao_social)) ||
    "Empresa principal";
  const razao = (row && row.razao_social) || null;
  const encrypted = encryptSecret(appSecret);

  const inserted = await query(
    `INSERT INTO ops.aplicativo (apelido, razao_social_cache, app_key, app_secret_encrypted)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (app_key) DO UPDATE SET
       apelido = EXCLUDED.apelido,
       razao_social_cache = COALESCE(EXCLUDED.razao_social_cache, ops.aplicativo.razao_social_cache),
       app_secret_encrypted = EXCLUDED.app_secret_encrypted,
       updated_at = NOW()
     RETURNING id, app_key, apelido`,
    [apelido, razao, appKey, encrypted]
  );

  console.log("Aplicativo gravado:", inserted.rows[0]);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => {});
  });
