require("dotenv").config();
const { Client } = require("pg");

async function omie(url, call, param) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      call,
      param: [param],
      app_key: process.env.OMIE_APP_KEY,
      app_secret: process.env.OMIE_APP_SECRET,
    }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  return { status: res.status, json };
}

async function main() {
  const emp = await omie(
    "https://app.omie.com.br/api/v1/geral/empresas/",
    "ListarEmpresas",
    { pagina: 1, registros_por_pagina: 10 }
  );
  const keys = emp.json && typeof emp.json === "object" ? Object.keys(emp.json) : [];
  const fail = emp.json && (emp.json.faultstring || emp.json.faultcode || emp.json.omie_fail);
  console.log("OMIE_STATUS", emp.status);
  console.log("OMIE_KEYS", keys.join(","));
  console.log("OMIE_FAIL", fail ? String(JSON.stringify(fail)).slice(0, 300) : "none");
  if (emp.json.total_de_registros != null) console.log("OMIE_TOTAL", emp.json.total_de_registros);
  const empresas = emp.json.empresas_cadastro || emp.json.empresa_cadastro || [];
  if (Array.isArray(empresas) && empresas[0]) {
    console.log("OMIE_EMPRESA", empresas[0].razao_social || empresas[0].nome_fantasia || "ok");
  }

  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await db.connect();
    const r = await db.query("SELECT current_database() AS db");
    console.log("DB_OK", r.rows[0].db);
    const t = await db.query(
      "SELECT schemaname, count(*)::int AS n FROM pg_tables WHERE schemaname IN ('dim','fato','stg','ops') GROUP BY 1 ORDER BY 1"
    );
    console.log("DB_SCHEMAS", JSON.stringify(t.rows));
  } catch (e) {
    console.log("DB_ERR", e.message);
  } finally {
    await db.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
