require("dotenv").config();
const { loadFull } = require("../src/etl/sync");
const { getPool } = require("../src/db/pool");

loadFull()
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
