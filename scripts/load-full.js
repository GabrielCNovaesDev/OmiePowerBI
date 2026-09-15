require("dotenv").config();
const { loadFull, loadAll } = require("../src/etl/sync");
const { getPool } = require("../src/db/pool");

const arg = process.argv[2];
const runAll = arg === "all" || arg === "--all";

const job = runAll ? loadAll() : loadFull(arg || undefined);

job
  .then((report) => {
    console.log("\n=== LOAD COMPLETE ===");
    console.log(JSON.stringify(report, null, 2));
  })
  .catch((err) => {
    console.error("LOAD FAILED", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => {});
  });
