require("dotenv").config();
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log("Conectado ao Neon");

  const sql = fs.readFileSync(path.join(__dirname, "schema-plataforma.sql"), "utf8");
  await client.query(sql);
  console.log("Schema de plataforma aplicado (auth + ops.aplicativo)");

  const { rows } = await client.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema IN ('auth', 'ops')
    ORDER BY table_schema, table_name
  `);
  for (const r of rows) {
    console.log(`  ${r.table_schema}.${r.table_name}`);
  }

  await client.end();
}

main().catch((err) => {
  console.error("Erro:", err.message);
  process.exit(1);
});
