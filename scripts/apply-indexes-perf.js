require("dotenv").config();
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ausente");
  const sql = fs.readFileSync(path.join(__dirname, "..", "db", "indexes-perf.sql"), "utf8");
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE indexname IN ('idx_saldo_cc_lookup', 'idx_titulo_aberto_venc', 'idx_titulo_atrasado')
    ORDER BY indexname
  `);
  console.log("indexes:", rows.map((r) => r.indexname).join(", "));
  await client.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
