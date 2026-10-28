require("dotenv").config();
const { loadFull, loadAll } = require("../src/etl/sync");
const { getPool } = require("../src/db/pool");

const arg = process.argv[2];
const runAll = arg === "all" || arg === "--all";

const job = runAll ? loadAll() : loadFull(arg || undefined);
const t0 = Date.now();

// O resumo não imprime valores financeiros: os logs do Actions são públicos.
function printSummary(results) {
  console.log("\n=== RESUMO DA CARGA ===");
  for (const r of results) {
    console.log(`${r.ok ? "OK  " : "ERRO"} ${r.app_key}${r.error ? ` — ${r.error}` : ""}`);
    for (const [step, info] of Object.entries(r.report || {})) {
      if (info && info.ok === false) console.log(`       ${step}: ${info.error}`);
    }
  }
  console.log(`Tempo total: ${Math.round((Date.now() - t0) / 60000)} min`);
}

job
  .then((results) => {
    printSummary(results);
    if (results.some((r) => !r.ok)) process.exitCode = 1;
  })
  .catch((err) => {
    console.error("LOAD FAILED", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => {});
  });
