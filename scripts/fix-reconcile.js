require("dotenv").config();
const { Client } = require("pg");
const { reconcile, syncOrigens } = require("../src/etl/sync");
const { getPool } = require("../src/db/pool");

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query("ALTER TABLE ops.reconciliacao DROP COLUMN IF EXISTS diferenca_percentual");
  await client.query(`
    ALTER TABLE ops.reconciliacao ADD COLUMN diferenca_percentual NUMERIC(12,4)
    GENERATED ALWAYS AS (
      CASE WHEN valor_omie <> 0 THEN ((valor_omie - valor_bi) / valor_omie) * 100 ELSE 0 END
    ) STORED
  `);
  await client.end();
  console.log("coluna percent ajustada");

  try {
    const n = await syncOrigens();
    console.log("origens", n);
  } catch (err) {
    console.log("origens falhou", err.message);
  }

  const rec = await reconcile();
  console.log(JSON.stringify(rec, null, 2));
  await getPool().end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
