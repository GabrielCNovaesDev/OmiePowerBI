"use strict";

const { omieCall, paginate, extractRecords, paginationMeta, withOmieCreds, currentCreds } = require("../omie/client");
const { CATALOG } = require("../omie/catalog");
const { query, withTransaction } = require("../db/pool");
const { todayBr, monthWindows, num, str, parseOmieDate, mapLimit, maskKey } = require("../lib/util");
const { listAplicativos, resolveOmieCreds, markSync } = require("../lib/aplicativos");
const m = require("./mappers");
const { bulkUpsert, UPSERT_RESUMO } = require("./sql");

// Empresas carregadas ao mesmo tempo. O limite da Omie é por App Key + método,
// então empresas diferentes não disputam cota entre si.
const APP_CONCURRENCY = Number(process.env.SYNC_APP_CONCURRENCY) || 4;
// ListarExtrato só aceita uma requisição por vez por App Key ("Já existe uma
// requisição desse método sendo executada"), então as contas vão em sequência.
const EXTRATO_CONCURRENCY = Number(process.env.SYNC_EXTRATO_CONCURRENCY) || 1;
// JSON bruto das respostas em stg.api_response: só quando pedido (debug).
const SAVE_STAGING = process.env.SYNC_SAVE_STAGING === "1";
// Meses de extrato recarregados a cada execução. Meses mais antigos ficam como
// estão; para carregar o histórico uma vez, rode com SYNC_EXTRATO_MONTHS=36.
const EXTRATO_MONTHS = Number(process.env.SYNC_EXTRATO_MONTHS) || 12;
// Não apaga títulos sumidos se a varredura trouxe menos que esta fração do que já existe.
const PURGE_MIN_RATIO = 0.5;

async function ensureContaVisivelColumns() {
  try {
    await query(`ALTER TABLE dim.conta_corrente ADD COLUMN IF NOT EXISTS visivel_fluxo_caixa VARCHAR(1) DEFAULT 'S'`);
    await query(`ALTER TABLE dim.conta_corrente ADD COLUMN IF NOT EXISTS visivel_resumo VARCHAR(1) DEFAULT 'S'`);
  } catch (err) {
    console.warn("ensure visivel columns:", err instanceof Error ? err.message : err);
  }
}

function appKey() {
  return currentCreds().app_key;
}

function log(...args) {
  console.log(`[${currentCreds().label || maskKey(appKey())}]`, ...args);
}

async function startLog(endpoint, metodo, tipo) {
  const r = await query(
    `INSERT INTO ops.sync_log (app_key, endpoint, metodo, tipo_sync, status)
     VALUES ($1,$2,$3,$4,'running') RETURNING id`,
    [appKey(), endpoint, metodo, tipo]
  );
  return r.rows[0].id;
}

async function finishLog(id, status, counts, erro) {
  await query(
    `UPDATE ops.sync_log SET status=$2, registros_total=$3, registros_novos=$4,
      registros_atualizados=$5, paginas_total=$6, erro_mensagem=$7, finished_at=NOW()
     WHERE id=$1`,
    [
      id,
      status,
      counts.total || 0,
      counts.novos || 0,
      counts.atualizados || 0,
      counts.paginas || 0,
      erro || null,
    ]
  );
}

async function saveStaging(endpoint, metodo, json, pagina) {
  if (!SAVE_STAGING) return;
  const meta = paginationMeta(json);
  await query(
    `INSERT INTO stg.api_response (app_key, endpoint, metodo, pagina, total_paginas, total_registros, payload, processado)
     VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
    [
      appKey(),
      endpoint,
      metodo,
      pagina || meta.page || 1,
      meta.totalPages,
      meta.totalRecords,
      json,
    ]
  );
}

async function fetchAll(spec, extraParam = {}) {
  const param = { ...(spec.extraParam || {}), ...extraParam };
  if (spec.style === "none") {
    const json = await omieCall(spec.url, spec.call, param);
    await saveStaging(spec.url, spec.call, json, 1);
    return { records: extractRecords(json, spec.recordsKey), pages: 1 };
  }
  let pages = 0;
  const records = await paginate(spec.url, spec.call, param, {
    style: spec.style,
    recordsKey: spec.recordsKey,
    pageSize: 100,
    onPage: async ({ page, json }) => {
      pages += 1;
      await saveStaging(spec.url, spec.call, json, page);
    },
  });
  return { records, pages };
}

// Envolve uma etapa com o registro em ops.sync_log.
async function logged(name, tipo, fn) {
  const spec = CATALOG[name];
  const logId = await startLog(spec.url, spec.call, tipo);
  try {
    const counts = await fn(spec);
    await finishLog(logId, "success", { novos: counts.total, ...counts });
    return counts.total;
  } catch (err) {
    await finishLog(logId, "error", {}, err.message);
    throw err;
  }
}

// Cadastro simples: busca tudo, mapeia e grava num único lote.
function syncCadastro(name, specName, mapper, keyField) {
  return logged(name, "full", async (spec) => {
    const { records, pages } = await fetchAll(spec);
    const rows = records
      .map((row) => mapper(row, appKey()))
      .filter((r) => r && r[keyField] !== null && r[keyField] !== "" && r[keyField] !== 0);
    await withTransaction((client) => bulkUpsert(client, specName, rows));
    return { total: records.length, paginas: pages };
  });
}

const syncEmpresas = () => syncCadastro("empresas", "empresa", m.mapEmpresa, "codigo_empresa_omie");
const syncBancos = () => syncCadastro("bancos", "banco", m.mapBanco, "codigo_banco");
const syncContasCorrentes = () => syncCadastro("contasCorrentes", "contaCorrente", m.mapContaCorrente, "codigo_cc_omie");
const syncDre = () => syncCadastro("dre", "dre", m.mapDre, "codigo_dre");
const syncCategorias = () => syncCadastro("categorias", "categoria", m.mapCategoria, "codigo");
const syncDepartamentos = () => syncCadastro("departamentos", "departamento", m.mapDepartamento, "codigo");
const syncOrigens = () => syncCadastro("origens", "origem", m.mapOrigem, "codigo");
const syncParcelas = () => syncCadastro("parcelas", "parcela", m.mapParcela, "codigo_parcela");
const syncClientes = () => syncCadastro("clientes", "cliente", m.mapCliente, "codigo_cliente_omie");

function splitTitulos(records, app) {
  const titulos = [];
  const cats = [];
  const deps = [];
  const baixas = [];
  for (const item of records) {
    const r = m.mapTitulo(item, app);
    if (!r.codigo_titulo_omie) continue;
    titulos.push(r);
    for (const cat of r._rateioCategorias) {
      const codigo = str(cat.cCodCateg || cat.codigo_categoria || cat.codigo, 20);
      if (!codigo) continue;
      cats.push({
        app_key: app,
        codigo_titulo_omie: r.codigo_titulo_omie,
        codigo_categoria: codigo,
        valor: num(cat.nValor || cat.valor),
        percentual: num(cat.nPerc || cat.percentual),
      });
    }
    for (const dep of r._rateioDepartamentos) {
      const codigo = str(dep.cCodDepartamento || dep.codigo, 40);
      if (!codigo) continue;
      deps.push({
        app_key: app,
        codigo_titulo_omie: r.codigo_titulo_omie,
        codigo_departamento: codigo,
        valor: num(dep.nDistrValor || dep.valor),
        percentual: num(dep.nDistrPercentual || dep.percentual),
        valor_fixo: String(dep.nValorFixo || dep.valor_fixo || "N").slice(0, 1),
      });
    }
    for (const baixa of r._baixas) {
      const b = m.mapBaixa(baixa, app, r.codigo_titulo_omie, r.natureza);
      if (b.codigo_baixa_omie) baixas.push(b);
    }
  }
  return { titulos, cats, deps, baixas };
}

// Grava uma página de títulos. Rateios e baixas de cada título são
// substituídos por inteiro, para não sobrar rateio antigo ou baixa estornada.
async function persistTitulosPage(records) {
  const app = appKey();
  const { titulos, cats, deps, baixas } = splitTitulos(records, app);
  const ids = titulos.map((t) => t.codigo_titulo_omie);
  if (!titulos.length) return ids;
  await withTransaction(async (client) => {
    await bulkUpsert(client, "titulo", titulos);
    for (const table of ["fato.titulo_rateio_categoria", "fato.titulo_rateio_departamento", "fato.baixa"]) {
      await client.query(
        `DELETE FROM ${table} WHERE app_key=$1 AND codigo_titulo_omie = ANY($2::bigint[])`,
        [app, ids]
      );
    }
    await bulkUpsert(client, "rateioCategoria", cats);
    await bulkUpsert(client, "rateioDepartamento", deps);
    await bulkUpsert(client, "baixa", baixas);
  });
  return ids;
}

// Títulos que não vieram numa varredura completa foram excluídos na Omie.
// A paginação da Omie pode mudar de ordem no meio da varredura (títulos
// repetidos entre páginas e outros pulados), então só limpa quando todos os
// títulos que a Omie declara existir foram vistos.
async function purgeTitulosAusentes(startedAt, vistos, declarados) {
  const app = appKey();
  if (declarados && vistos < declarados) {
    log(`limpeza de titulos ignorada: varredura viu ${vistos} de ${declarados} declarados pela Omie`);
    return 0;
  }
  const existentes = num((await query(`SELECT COUNT(*) AS n FROM fato.titulo WHERE app_key=$1`, [app])).rows[0].n);
  if (vistos < existentes * PURGE_MIN_RATIO) {
    log(`limpeza de titulos ignorada: varredura trouxe ${vistos} de ${existentes}`);
    return 0;
  }
  const r = await withTransaction((client) =>
    client.query(
      `WITH gone AS (
         DELETE FROM fato.titulo WHERE app_key=$1 AND synced_at < $2 RETURNING codigo_titulo_omie
       ), d1 AS (
         DELETE FROM fato.titulo_rateio_categoria x USING gone
         WHERE x.app_key=$1 AND x.codigo_titulo_omie = gone.codigo_titulo_omie
       ), d2 AS (
         DELETE FROM fato.titulo_rateio_departamento x USING gone
         WHERE x.app_key=$1 AND x.codigo_titulo_omie = gone.codigo_titulo_omie
       ), d3 AS (
         DELETE FROM fato.baixa x USING gone
         WHERE x.app_key=$1 AND x.codigo_titulo_omie = gone.codigo_titulo_omie
       )
       SELECT COUNT(*) AS n FROM gone`,
      [app, startedAt]
    )
  );
  return num(r.rows[0].n);
}

function syncTitulos() {
  return logged("titulos", "full", async (spec) => {
    const startedAt = (await query(`SELECT NOW() AS t`)).rows[0].t;
    const vistos = new Set();
    let declarados = 0;
    let pages = 0;
    let totalPages = 0;
    await paginate(spec.url, spec.call, spec.extraParam || {}, {
      style: spec.style,
      recordsKey: spec.recordsKey,
      pageSize: 100,
      onPage: async ({ page, totalPages: tp, records, json, meta }) => {
        pages += 1;
        totalPages = tp;
        declarados = Math.max(declarados, num(meta.totalRecords));
        if (page === 1 || page % 20 === 0) log(`titulos pagina ${page}/${tp}`);
        await saveStaging(spec.url, spec.call, json, page);
        for (const id of await persistTitulosPage(records)) vistos.add(id);
      },
    });
    let removidos = 0;
    if (pages >= totalPages) {
      removidos = await purgeTitulosAusentes(startedAt, vistos.size, declarados);
      if (removidos) log(`titulos excluidos na Omie removidos: ${removidos}`);
    }
    return { total: vistos.size, paginas: pages, atualizados: removidos };
  });
}

async function listContasCorrentesLocal() {
  const r = await query(
    `SELECT codigo_cc_omie FROM dim.conta_corrente WHERE app_key=$1 AND inativa <> 'S'`,
    [appKey()]
  );
  return r.rows.map((row) => Number(row.codigo_cc_omie));
}

// Uma janela (conta × mês): os movimentos daquele período são substituídos
// pelos que a Omie devolveu, para que estornos e exclusões saiam do BI.
async function syncExtratoJanela(spec, codigoCc, w) {
  const app = appKey();
  const json = await omieCall(spec.url, spec.call, {
    nCodCC: codigoCc,
    dPeriodoInicial: w.de,
    dPeriodoFinal: w.ate,
  });
  await saveStaging(spec.url, spec.call, json, 1);
  const movimentos = extractRecords(json, spec.recordsKey)
    .map((mov) => m.mapExtratoMovimento(mov, app, codigoCc))
    .filter((row) => row.codigo_lancamento);
  const saldo = m.mapSaldoExtrato(json, app, codigoCc, parseOmieDate(w.ate));
  await withTransaction(async (client) => {
    await client.query(
      `DELETE FROM fato.extrato_movimento
       WHERE app_key=$1 AND codigo_cc_omie=$2 AND data_lancamento BETWEEN $3::date AND $4::date`,
      [app, codigoCc, parseOmieDate(w.de), parseOmieDate(w.ate)]
    );
    await bulkUpsert(client, "saldo", [saldo]);
    await bulkUpsert(client, "extrato", movimentos);
  });
  return movimentos.length;
}

function syncExtrato(monthsBack = 12) {
  return logged("extrato", "full", async (spec) => {
    const windows = monthWindows(monthsBack);
    const contas = await listContasCorrentesLocal();
    const porConta = await mapLimit(contas, EXTRATO_CONCURRENCY, async (codigoCc) => {
      let n = 0;
      for (const w of windows) n += await syncExtratoJanela(spec, codigoCc, w);
      return n;
    });
    log(`extrato: ${contas.length} contas`);
    return { total: porConta.reduce((a, b) => a + b, 0), paginas: contas.length * windows.length };
  });
}

function syncOrcamentos(monthsBack = 12) {
  return logged("orcamentos", "full", async (spec) => {
    const app = appKey();
    let total = 0;
    for (const w of monthWindows(monthsBack)) {
      const json = await omieCall(spec.url, spec.call, { nAno: w.ano, nMes: w.mes });
      await saveStaging(spec.url, spec.call, json, 1);
      const rows = extractRecords(json, spec.recordsKey)
        .map((row) => m.mapOrcamento(row, app, w.ano, w.mes))
        .filter((r) => r.codigo_categoria);
      await withTransaction((client) => bulkUpsert(client, "orcamento", rows));
      total += rows.length;
    }
    return { total };
  });
}

function syncResumo() {
  return logged("resumo", "snapshot", async (spec) => {
    const dDia = todayBr();
    const json = await omieCall(spec.url, spec.call, { dDia, lApenasResumo: false, lExibirCategoria: true });
    await saveStaging(spec.url, spec.call, json, 1);
    const r = m.mapResumo(json, appKey(), parseOmieDate(dDia));
    await withTransaction(async (client) => {
      const inserted = await client.query(UPSERT_RESUMO, [
        r.app_key, r.data_referencia, r.cc_saldo_total, r.cc_limite_credito, r.ar_qtd_titulos,
        r.ar_valor_total, r.ar_valor_atraso, r.ap_qtd_titulos, r.ap_valor_total, r.ap_valor_atraso,
        r.fluxo_pagar, r.fluxo_receber, r.fluxo_saldo,
      ]);
      const snapshotId = inserted.rows[0].id;
      await client.query(`DELETE FROM fato.resumo_snapshot_categoria WHERE resumo_snapshot_id=$1`, [snapshotId]);
      const cats = [
        ...r.categoriasReceber.map((c) => ["R", c]),
        ...r.categoriasPagar.map((c) => ["P", c]),
      ].filter(([, c]) => c.cCodCateg);
      for (const [natureza, cat] of cats) {
        await client.query(
          `INSERT INTO fato.resumo_snapshot_categoria (resumo_snapshot_id, natureza, codigo_categoria, descricao_categoria, qtd_titulos, valor_total)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (resumo_snapshot_id, natureza, codigo_categoria) DO UPDATE SET valor_total=EXCLUDED.valor_total, qtd_titulos=EXCLUDED.qtd_titulos`,
          [snapshotId, natureza, cat.cCodCateg, cat.cDescCateg, num(cat.nTotal), num(cat.vTotal)]
        );
      }
    });
    return { total: 1 };
  });
}

// O Resumo da Omie (ObterResumoFinancas) só considera contas correntes marcadas
// para "Resumo e Fluxo de Caixa", e o "total" de cada card é atrasado + vence
// hoje — não o total em aberto. As consultas do BI reproduzem essas regras
// (conferido contra o ERP da DI PRIMO em 28/10/2026).
const TITULO_CONSIDERADO = `
  FROM fato.titulo t
  JOIN dim.conta_corrente cc ON cc.app_key=t.app_key AND cc.codigo_cc_omie=t.codigo_cc_omie
  WHERE t.app_key=$1 AND COALESCE(cc.visivel_resumo,'S')='S' AND t.valor_aberto > 0`;

async function reconcile() {
  const app = appKey();
  const resumo = (col) =>
    `SELECT ${col} FROM fato.resumo_snapshot WHERE app_key=$1 ORDER BY data_referencia DESC LIMIT 1`;
  const checks = [
    {
      metrica: "ar_valor_total",
      omie: resumo("ar_valor_total"),
      bi: `SELECT COALESCE(SUM(t.valor_aberto),0) AS v ${TITULO_CONSIDERADO} AND t.natureza='R' AND t.status IN ('ATRASADO','VENCEHOJE')`,
    },
    {
      metrica: "ap_valor_total",
      omie: resumo("ap_valor_total"),
      bi: `SELECT COALESCE(SUM(t.valor_aberto),0) AS v ${TITULO_CONSIDERADO} AND t.natureza='P' AND t.status IN ('ATRASADO','VENCEHOJE')`,
    },
    {
      metrica: "ar_valor_atraso",
      omie: resumo("ar_valor_atraso"),
      bi: `SELECT COALESCE(SUM(t.valor_aberto),0) AS v ${TITULO_CONSIDERADO} AND t.natureza='R' AND t.status='ATRASADO'`,
    },
    {
      metrica: "ap_valor_atraso",
      omie: resumo("ap_valor_atraso"),
      bi: `SELECT COALESCE(SUM(t.valor_aberto),0) AS v ${TITULO_CONSIDERADO} AND t.natureza='P' AND t.status='ATRASADO'`,
    },
    {
      metrica: "cc_saldo_total",
      omie: resumo("cc_saldo_total"),
      bi: `SELECT COALESCE(SUM(s.saldo_atual),0) AS v
           FROM dim.conta_corrente cc
           JOIN LATERAL (
             SELECT saldo_atual FROM fato.saldo_conta_corrente x
             WHERE x.app_key=cc.app_key AND x.codigo_cc_omie=cc.codigo_cc_omie
             ORDER BY data_referencia DESC LIMIT 1
           ) s ON true
           WHERE cc.app_key=$1 AND COALESCE(cc.visivel_resumo,'S')='S'`,
    },
  ];

  const today = parseOmieDate(todayBr());
  const results = [];
  for (const c of checks) {
    const omieRow = await query(c.omie, [app]);
    const biRow = await query(c.bi, [app]);
    const valorOmie = num(omieRow.rows[0] && Object.values(omieRow.rows[0])[0]);
    const valorBi = num(biRow.rows[0] && biRow.rows[0].v);
    await query(
      `INSERT INTO ops.reconciliacao (app_key, data_referencia, metrica, valor_omie, valor_bi)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (app_key, data_referencia, metrica) DO UPDATE SET valor_omie=EXCLUDED.valor_omie, valor_bi=EXCLUDED.valor_bi`,
      [app, today, c.metrica, valorOmie, valorBi]
    );
    results.push({ metrica: c.metrica, valorOmie, valorBi, diff: valorOmie - valorBi });
  }
  return results;
}

// Tabelas sem app_key (iguais para todas as empresas): uma vez por execução.
const GLOBAL_STEPS = [
  ["bancos", syncBancos],
  ["origens", syncOrigens],
  ["parcelas", syncParcelas],
];

const APP_STEPS = [
  ["empresas", syncEmpresas],
  ["contasCorrentes", syncContasCorrentes],
  ["dre", syncDre],
  ["categorias", syncCategorias],
  ["departamentos", syncDepartamentos],
  ["clientes", syncClientes],
  ["titulos", syncTitulos],
  ["extrato", () => syncExtrato(EXTRATO_MONTHS)],
  ["orcamentos", () => syncOrcamentos(12)],
  ["resumo", syncResumo],
];

async function runSteps(steps) {
  const report = {};
  for (const [name, fn] of steps) {
    const t0 = Date.now();
    try {
      const result = await fn();
      report[name] = { ok: true, registros: result, ms: Date.now() - t0 };
      log(`ok ${name} em ${Math.round((Date.now() - t0) / 1000)}s (${result} registros)`);
    } catch (err) {
      report[name] = { ok: false, error: err.message, ms: Date.now() - t0 };
      console.error(`[${currentCreds().label || maskKey(appKey())}] ERRO ${name}:`, err.message);
    }
  }
  return report;
}

function loadHasError(report) {
  return Object.values(report).some((item) => item && typeof item === "object" && item.ok === false);
}

async function runGlobals(creds) {
  return withOmieCreds({ ...creds, label: "global" }, () => runSteps(GLOBAL_STEPS));
}

async function loadApp(appKeyArg, label) {
  const creds = await resolveOmieCreds(appKeyArg);
  const tag = label || maskKey(creds.app_key);
  const t0 = Date.now();
  const report = await withOmieCreds({ ...creds, label: tag }, async () => {
    log("inicio da carga");
    const r = await runSteps(APP_STEPS);
    try {
      await reconcile();
      r.reconciliacao = { ok: true };
    } catch (err) {
      r.reconciliacao = { ok: false, error: err.message };
    }
    log(`fim da carga em ${Math.round((Date.now() - t0) / 60000)} min`);
    return r;
  });
  try {
    await markSync(creds.app_key, loadHasError(report) ? "error" : "success");
  } catch (err) {
    console.warn(`[${tag}] nao foi possivel atualizar ops.aplicativo:`, err.message);
  }
  return { creds, report };
}

// Carga de uma empresa (CLI: node scripts/load-full.js <app_key>).
async function loadFull(appKeyArg) {
  await ensureContaVisivelColumns();
  const creds = await resolveOmieCreds(appKeyArg);
  const globals = await runGlobals(creds);
  const { report } = await loadApp(creds.app_key);
  return [{ app_key: maskKey(creds.app_key), ok: !loadHasError(globals) && !loadHasError(report), globals, report }];
}

// Carga de todas as empresas ativas, em paralelo.
async function loadAll() {
  const apps = await listAplicativos({ onlySyncable: true, onlyAtivos: true });
  let targets = apps.map((a) => ({ app_key: a.app_key, label: a.apelido }));
  if (!targets.length && process.env.OMIE_APP_KEY) {
    targets = [{ app_key: process.env.OMIE_APP_KEY, label: process.env.OMIE_APP_NAME || null }];
  }
  if (!targets.length) {
    throw new Error("Nenhum aplicativo Omie ativo para sincronizar");
  }
  await ensureContaVisivelColumns();

  const globals = await runGlobals(await resolveOmieCreds(targets[0].app_key));
  const out = [{ app_key: "global", ok: !loadHasError(globals), report: globals }];

  const results = await mapLimit(targets, APP_CONCURRENCY, async (t) => {
    try {
      const { report } = await loadApp(t.app_key, t.label);
      return { app_key: t.label || maskKey(t.app_key), ok: !loadHasError(report), report };
    } catch (err) {
      console.error(`LOAD FAILED ${t.label || maskKey(t.app_key)}`, err.message);
      try {
        await markSync(t.app_key, "error");
      } catch {
        /* ignore */
      }
      return { app_key: t.label || maskKey(t.app_key), ok: false, error: err.message };
    }
  });
  return out.concat(results);
}

module.exports = {
  loadFull,
  loadAll,
  syncEmpresas,
  syncBancos,
  syncContasCorrentes,
  syncClientes,
  syncOrigens,
  syncTitulos,
  syncExtrato,
  syncOrcamentos,
  syncResumo,
  reconcile,
};
