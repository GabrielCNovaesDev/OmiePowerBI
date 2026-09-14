require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { omieCall, paginationMeta, extractRecords } = require("../src/omie/client");
const { CATALOG } = require("../src/omie/catalog");
const { todayBr, monthWindows } = require("../src/lib/util");

const OUT_DIR = path.join(__dirname, "..", "fixtures", "omie");

function sanitize(json) {
  const raw = JSON.stringify(json);
  return JSON.parse(
    raw.replace(/("cnpj_cpf"|"cnpj"|"cpf"|"email"|"cCNPJCPF")\s*:\s*"[^"]*"/gi, '$1:"***"')
  );
}

async function probeOne(name, spec) {
  const started = Date.now();
  let param = { ...(spec.extraParam || {}) };
  if (spec.call === "ObterResumoFinancas") {
    param = { dDia: todayBr(), lApenasResumo: true };
  }
  if (spec.call === "ListarOrcamentos") {
    const now = new Date();
    param = { nAno: now.getFullYear(), nMes: now.getMonth() + 1 };
  }
  if (spec.call === "ListarExtrato") {
    return { name, skipped: "precisa nCodCC — preenchido no load" };
  }

  if (spec.style === "nPagina") {
    param.nPagina = 1;
    param.nRegPorPagina = 10;
  } else if (spec.style === "pagina") {
    param.pagina = 1;
    param.registros_por_pagina = 10;
  }

  const json = await omieCall(spec.url, spec.call, param);
  const meta = paginationMeta(json);
  const records = extractRecords(json, spec.recordsKey);
  const sample = records[0] || json;
  const keys = sample && typeof sample === "object" ? Object.keys(sample) : [];
  fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), JSON.stringify(sanitize(json), null, 2));
  return {
    name,
    call: spec.call,
    ms: Date.now() - started,
    totalPages: meta.totalPages,
    totalRecords: meta.totalRecords,
    sampleCount: records.length,
    keys: keys.slice(0, 25),
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = [];
  for (const [name, spec] of Object.entries(CATALOG)) {
    if (!spec.mvp) continue;
    console.log("probe", name, spec.call);
    try {
      const row = await probeOne(name, spec);
      report.push(row);
      console.log("  ok", row.totalRecords ?? row.sampleCount, "regs", row.ms + "ms");
    } catch (err) {
      report.push({ name, call: spec.call, error: err.message });
      console.error("  FAIL", err.message);
    }
  }

  const cc = report.find((r) => r.name === "contasCorrentes");
  if (cc && !cc.error) {
    try {
      const json = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "contasCorrentes.json"), "utf8"));
      const records = extractRecords(json, CATALOG.contasCorrentes.recordsKey);
      const first = records[0];
      const nCodCC = first && (first.nCodCC || first.codigo);
      if (nCodCC) {
        const w = monthWindows(1)[0];
        const ext = await omieCall(CATALOG.extrato.url, "ListarExtrato", {
          nCodCC,
          dPeriodoInicial: w.de,
          dPeriodoFinal: w.ate,
        });
        fs.writeFileSync(path.join(OUT_DIR, "extrato.json"), JSON.stringify(sanitize(ext), null, 2));
        report.push({
          name: "extrato",
          call: "ListarExtrato",
          nCodCC,
          keys: Object.keys(ext).slice(0, 20),
          movimentos: extractRecords(ext, "listaMovimentos").length,
        });
        console.log("  extrato ok CC", nCodCC);
      }
    } catch (err) {
      report.push({ name: "extrato", error: err.message });
      console.error("  extrato FAIL", err.message);
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, "probe-report.json"), JSON.stringify(report, null, 2));
  console.log("\nRelatorio em fixtures/omie/probe-report.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
