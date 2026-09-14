require("dotenv").config();
const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`
    SELECT
      (SELECT COUNT(*) FROM fato.titulo) AS titulos,
      (SELECT COUNT(*) FROM fato.baixa) AS baixas,
      (SELECT MAX(synced_at) FROM fato.titulo) AS last_titulo,
      (SELECT status FROM ops.sync_log ORDER BY id DESC LIMIT 1) AS last_status,
      (SELECT metodo FROM ops.sync_log ORDER BY id DESC LIMIT 1) AS last_metodo
  `);
  console.log(JSON.stringify(r.rows[0], null, 2));
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
