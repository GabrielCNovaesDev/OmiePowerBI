"use strict";

const { omieCall, paginate, extractRecords, paginationMeta } = require("../omie/client");
const { CATALOG } = require("../omie/catalog");
const { query, withClient } = require("../db/pool");
const { todayBr, monthWindows, num, str, parseOmieDate } = require("../lib/util");
const m = require("./mappers");
const s = require("./sql");

function appKey() {
  return process.env.OMIE_APP_KEY;
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
    onPage: async ({ page, json, totalPages }) => {
      pages += 1;
      if (page === 1 || page % 10 === 0) {
        console.log(`   pagina ${page}/${totalPages}`);
      }
      await saveStaging(spec.url, spec.call, json, page);
    },
  });
  return { records, pages };
}

async function syncSimple(name, mapper, insertSql, valuesFn, extraParam = {}) {
  const spec = CATALOG[name];
  const logId = await startLog(spec.url, spec.call, "full");
  try {
    const { records, pages } = await fetchAll(spec, extraParam);
    await withClient(async (client) => {
      for (const row of records) {
        const mapped = mapper(row, appKey());
        if (!mapped) continue;
        if (mapped.codigo_dre === null || mapped.codigo === "") {
          /* keep going — empty dre codes skipped below */
        }
        const nk = mapped.codigo_dre || mapped.codigo || mapped.codigo_cc_omie || mapped.codigo_cliente_omie || mapped.codigo_empresa_omie;
        if (nk === null || nk === "" || nk === 0) continue;
        await client.query(insertSql, valuesFn(mapped));
      }
    });
    await finishLog(logId, "success", { total: records.length, paginas: pages, novos: records.length });
    return records.length;
  } catch (err) {
    await finishLog(logId, "error", { total: 0 }, err.message);
    throw err;
  }
}

async function syncEmpresas() {
  return syncSimple(
    "empresas",
    m.mapEmpresa,
    s.UPSERT_EMPRESA,
    (r) => [r.app_key, r.codigo_empresa_omie, r.cnpj, r.razao_social, r.nome_fantasia, r.estado, r.cidade, r.regime_tributario, r.optante_simples, r.inativa]
  );
}

async function syncBancos() {
  const spec = CATALOG.bancos;
  const logId = await startLog(spec.url, spec.call, "full");
  try {
    const records = await paginate(spec.url, spec.call, {}, { style: spec.style, recordsKey: spec.recordsKey, pageSize: 100 });
    await withClient(async (client) => {
      for (const row of records) {
        const r = m.mapBanco(row);
        if (!r.codigo_banco) continue;
        await client.query(s.UPSERT_BANCO, [r.codigo_banco, r.nome, r.tipo, r.cod_compensacao, r.cod_ispb, r.integra_pix, r.integra_boleto]);
      }
    });
    await finishLog(logId, "success", { total: records.length, paginas: 1, novos: records.length });
    return records.length;
  } catch (err) {
    await finishLog(logId, "error", {}, err.message);
    throw err;
  }
}

async function syncContasCorrentes() {
  return syncSimple(
    "contasCorrentes",
    m.mapContaCorrente,
    s.UPSERT_CC,
    (r) => [r.app_key, r.codigo_cc_omie, r.codigo_integracao, r.descricao, r.codigo_banco, r.agencia, r.numero_conta, r.tipo_conta_corrente, r.visivel_fluxo_caixa, r.visivel_resumo, r.saldo_inicial, r.inativa]
  );
}

async function syncDre() {
  return syncSimple(
    "dre",
    m.mapDre,
    s.UPSERT_DRE,
    (r) => [r.app_key, r.codigo_dre, r.descricao, r.nivel, r.sinal, r.totalizadora, r.nao_exibir]
  );
}

async function syncCategorias() {
  return syncSimple(
    "categorias",
    m.mapCategoria,
    s.UPSERT_CATEGORIA,
    (r) => [r.app_key, r.codigo, r.descricao, r.descricao_padrao, r.categoria_superior, r.tipo_categoria, r.codigo_dre, r.conta_receita, r.conta_despesa, r.totalizadora, r.transferencia, r.conta_inativa, r.nao_exibir, r.definida_pelo_usuario]
  );
}

async function syncDepartamentos() {
  return syncSimple(
    "departamentos",
    m.mapDepartamento,
    s.UPSERT_DEP,
    (r) => [r.app_key, r.codigo, r.descricao, r.inativo, r.nivel_totalizador]
  );
}

async function syncOrigens() {
  const spec = CATALOG.origens;
  const logId = await startLog(spec.url, spec.call, "full");
  try {
    const { records, pages } = await fetchAll(spec);
    await withClient(async (client) => {
      for (const row of records) {
        const r = m.mapOrigem(row);
        if (!r.codigo) continue;
        await client.query(s.UPSERT_ORIGEM, [r.codigo, r.descricao]);
      }
    });
    await finishLog(logId, "success", { total: records.length, paginas: pages, novos: records.length });
    return records.length;
  } catch (err) {
    await finishLog(logId, "error", {}, err.message);
    throw err;
  }
}

async function syncParcelas() {
  const spec = CATALOG.parcelas;
  const logId = await startLog(spec.url, spec.call, "full");
  try {
    const records = await paginate(spec.url, spec.call, {}, { style: spec.style, recordsKey: spec.recordsKey, pageSize: 50 });
    await withClient(async (client) => {
      for (const row of records) {
        const r = m.mapParcela(row);
        if (!r.codigo_parcela) continue;
        await client.query(s.UPSERT_PARCELA, [r.codigo_parcela, r.descricao, r.num_parcelas]);
      }
    });
    await finishLog(logId, "success", { total: records.length, novos: records.length });
    return records.length;
  } catch (err) {
    await finishLog(logId, "error", {}, err.message);
    throw err;
  }
}

async function syncClientes() {
  return syncSimple(
    "clientes",
    m.mapCliente,
    s.UPSERT_CLIENTE,
    (r) => [r.app_key, r.codigo_cliente_omie, r.codigo_integracao, r.razao_social, r.nome_fantasia, r.cnpj_cpf, r.inscricao_estadual, r.email, r.telefone, r.cidade, r.estado, r.cep, r.pessoa_fisica, r.inativo]
  );
}

function tituloValues(r) {
  return [
    r.app_key, r.codigo_titulo_omie, r.codigo_integracao, r.natureza, r.status,
    r.codigo_cliente_omie, r.codigo_cc_omie, r.codigo_categoria, r.codigo_tipo_documento, r.codigo_origem,
    r.codigo_departamento, r.codigo_projeto, r.codigo_vendedor, r.codigo_comprador, r.codigo_contrato_omie,
    r.codigo_pedido_omie, r.codigo_nf_omie, r.operacao, r.numero_titulo, r.numero_documento, r.numero_documento_fiscal,
    r.numero_parcela, r.numero_boleto, r.chave_nfe, r.codigo_barras, r.data_emissao, r.data_vencimento, r.data_previsao,
    r.data_pagamento, r.data_registro, r.data_cancelamento, r.valor_titulo, r.valor_pis, r.valor_cofins, r.valor_csll,
    r.valor_ir, r.valor_iss, r.valor_inss, r.retem_pis, r.retem_cofins, r.retem_csll, r.retem_ir, r.retem_iss, r.retem_inss,
    r.liquidado, r.valor_pago, r.valor_aberto, r.total_desconto, r.total_juros, r.total_multa, r.valor_liquido, r.observacao,
    r.omie_inclusao_data, r.omie_inclusao_hora, r.omie_inclusao_usuario, r.omie_alteracao_data, r.omie_alteracao_hora,
    r.omie_alteracao_usuario, r.importado_api,
  ];
}

async function persistTitulo(client, item) {
  const r = m.mapTitulo(item, appKey());
  if (!r.codigo_titulo_omie) return false;
  await client.query(s.UPSERT_TITULO, tituloValues(r));

  for (const cat of r._rateioCategorias) {
    const codigo = str(cat.cCodCateg || cat.codigo_categoria || cat.codigo, 20);
    if (!codigo) continue;
    await client.query(s.UPSERT_RATEIO_CAT, [
      appKey(),
      r.codigo_titulo_omie,
      codigo,
      num(cat.nValor || cat.valor),
      num(cat.nPerc || cat.percentual),
    ]);
  }

  for (const dep of r._rateioDepartamentos) {
    const codigo = str(dep.cCodDepartamento || dep.codigo, 40);
    if (!codigo) continue;
    await client.query(s.UPSERT_RATEIO_DEP, [
      appKey(),
      r.codigo_titulo_omie,
      codigo,
      num(dep.nDistrValor || dep.valor),
      num(dep.nDistrPercentual || dep.percentual),
      String(dep.nValorFixo || dep.valor_fixo || "N").slice(0, 1),
    ]);
  }

  for (const baixa of r._baixas) {
    const b = m.mapBaixa(baixa, appKey(), r.codigo_titulo_omie, r.natureza);
    if (!b.codigo_baixa_omie) continue;
    await client.query(s.UPSERT_BAIXA, [
      b.app_key, b.codigo_titulo_omie, b.codigo_baixa_omie, b.codigo_integracao_baixa,
      b.codigo_lancamento_cc, b.codigo_cc_omie, b.natureza, b.data_baixa, b.valor_baixa,
      b.desconto, b.juros, b.multa, b.observacao,
    ]);
  }
  return true;
}

async function syncTitulos() {
  const spec = CATALOG.titulos;
  const logId = await startLog(spec.url, spec.call, "full");
  try {
    let total = 0;
    let pages = 0;
    await paginate(
      spec.url,
      spec.call,
      { lDadosCad: true },
      {
        style: "nPagina",
        recordsKey: "titulosEncontrados",
        pageSize: 100,
        onPage: async ({ page, totalPages, records, json }) => {
          pages += 1;
          if (page === 1 || page % 5 === 0) {
            console.log(`  titulos pagina ${page}/${totalPages} (${records.length})`);
          }
          await saveStaging(spec.url, spec.call, json, page);
          await withClient(async (client) => {
            for (const item of records) {
              const ok = await persistTitulo(client, item);
              if (ok) total += 1;
            }
          });
        },
      }
    );
    await finishLog(logId, "success", { total, paginas: pages, novos: total });
    return total;
  } catch (err) {
    await finishLog(logId, "error", {}, err.message);
    throw err;
  }
}

async function listContasCorrentesLocal() {
  const r = await query(
    `SELECT codigo_cc_omie FROM dim.conta_corrente WHERE app_key=$1 AND inativa <> 'S'`,
    [appKey()]
  );
  return r.rows.map((row) => Number(row.codigo_cc_omie));
}

async function syncExtrato(monthsBack = 12) {
  const spec = CATALOG.extrato;
  const logId = await startLog(spec.url, spec.call, "full");
  const windows = monthWindows(monthsBack);
  const contas = await listContasCorrentesLocal();
  let total = 0;
  try {
    for (const codigoCc of contas) {
      for (const w of windows) {
        const json = await omieCall(spec.url, spec.call, {
          nCodCC: codigoCc,
          dPeriodoInicial: w.de,
          dPeriodoFinal: w.ate,
        });
        await saveStaging(spec.url, spec.call, json, 1);
        const movimentos = extractRecords(json, "listaMovimentos");
        const dataRef = parseOmieDate(w.ate);
        const saldo = m.mapSaldoExtrato(json, appKey(), codigoCc, dataRef);
        await withClient(async (client) => {
          await client.query(s.UPSERT_SALDO, [
            saldo.app_key, saldo.codigo_cc_omie, saldo.data_referencia, saldo.saldo_anterior,
            saldo.saldo_anterior_previsto, saldo.saldo_atual, saldo.saldo_atual_previsto,
            saldo.saldo_conciliado, saldo.saldo_provisorio, saldo.limite_credito_total, saldo.saldo_disponivel,
          ]);
          for (const mov of movimentos) {
            const row = m.mapExtratoMovimento(mov, appKey(), codigoCc);
            if (!row.codigo_lancamento) continue;
            await client.query(s.UPSERT_EXTRATO, [
              row.app_key, row.codigo_cc_omie, row.codigo_lancamento, row.codigo_lancamento_relac,
              row.situacao, row.data_lancamento, row.natureza, row.codigo_cliente_omie, row.nome_cliente,
              row.razao_social_cliente, row.cnpj_cpf_cliente, row.tipo_documento, row.numero_documento,
              row.numero_documento_fiscal, row.numero_parcela, row.nosso_numero, row.codigo_categoria,
              row.descricao_categoria, row.origem, row.vendedor, row.projeto, row.valor_documento,
              row.saldo_realizado, row.saldo_previsto, row.data_conciliacao, row.bloqueado,
              row.data_inclusao, row.hora_inclusao, row.observacoes,
            ]);
            total += 1;
          }
        });
      }
      console.log(`  extrato CC ${codigoCc} ok`);
    }
    await finishLog(logId, "success", { total, paginas: contas.length * windows.length, novos: total });
    return total;
  } catch (err) {
    await finishLog(logId, "error", { total }, err.message);
    throw err;
  }
}

async function syncOrcamentos(monthsBack = 12) {
  const spec = CATALOG.orcamentos;
  const logId = await startLog(spec.url, spec.call, "full");
  const windows = monthWindows(monthsBack);
  const seen = new Set();
  let total = 0;
  try {
    for (const w of windows) {
      const key = `${w.ano}-${w.mes}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const json = await omieCall(spec.url, spec.call, { nAno: w.ano, nMes: w.mes });
      await saveStaging(spec.url, spec.call, json, 1);
      const lista = extractRecords(json, "ListaOrcamentos");
      await withClient(async (client) => {
        for (const row of lista) {
          const r = m.mapOrcamento(row, appKey(), w.ano, w.mes);
          if (!r.codigo_categoria) continue;
          await client.query(s.UPSERT_ORC, [r.app_key, r.ano, r.mes, r.codigo_categoria, r.descricao_categoria, r.valor_previsto, r.valor_realizado]);
          total += 1;
        }
      });
    }
    await finishLog(logId, "success", { total, novos: total });
    return total;
  } catch (err) {
    await finishLog(logId, "error", { total }, err.message);
    throw err;
  }
}

async function syncResumo() {
  const spec = CATALOG.resumo;
  const logId = await startLog(spec.url, spec.call, "snapshot");
  try {
    const dDia = todayBr();
    const json = await omieCall(spec.url, spec.call, { dDia, lApenasResumo: false, lExibirCategoria: true });
    await saveStaging(spec.url, spec.call, json, 1);
    const iso = parseOmieDate(dDia);
    const r = m.mapResumo(json, appKey(), iso);
    const inserted = await query(s.UPSERT_RESUMO, [
      r.app_key, r.data_referencia, r.cc_saldo_total, r.cc_limite_credito, r.ar_qtd_titulos,
      r.ar_valor_total, r.ar_valor_atraso, r.ap_qtd_titulos, r.ap_valor_total, r.ap_valor_atraso,
      r.fluxo_pagar, r.fluxo_receber, r.fluxo_saldo,
    ]);
    const snapshotId = inserted.rows[0].id;
    await query(`DELETE FROM fato.resumo_snapshot_categoria WHERE resumo_snapshot_id=$1`, [snapshotId]);
    for (const cat of r.categoriasReceber) {
      await query(
        `INSERT INTO fato.resumo_snapshot_categoria (resumo_snapshot_id, natureza, codigo_categoria, descricao_categoria, qtd_titulos, valor_total)
         VALUES ($1,'R',$2,$3,$4,$5)
         ON CONFLICT (resumo_snapshot_id, natureza, codigo_categoria) DO UPDATE SET valor_total=EXCLUDED.valor_total, qtd_titulos=EXCLUDED.qtd_titulos`,
        [snapshotId, cat.cCodCateg, cat.cDescCateg, num(cat.nTotal), num(cat.vTotal)]
      );
    }
    for (const cat of r.categoriasPagar) {
      await query(
        `INSERT INTO fato.resumo_snapshot_categoria (resumo_snapshot_id, natureza, codigo_categoria, descricao_categoria, qtd_titulos, valor_total)
         VALUES ($1,'P',$2,$3,$4,$5)
         ON CONFLICT (resumo_snapshot_id, natureza, codigo_categoria) DO UPDATE SET valor_total=EXCLUDED.valor_total, qtd_titulos=EXCLUDED.qtd_titulos`,
        [snapshotId, cat.cCodCateg, cat.cDescCateg, num(cat.nTotal), num(cat.vTotal)]
      );
    }
    await finishLog(logId, "success", { total: 1, novos: 1 });
    return r;
  } catch (err) {
    await finishLog(logId, "error", {}, err.message);
    throw err;
  }
}

async function reconcile() {
  const app = appKey();
  const checks = [
    {
      metrica: "ar_valor_total",
      omie: `SELECT ar_valor_total FROM fato.resumo_snapshot WHERE app_key=$1 ORDER BY data_referencia DESC LIMIT 1`,
      bi: `SELECT COALESCE(SUM(valor_aberto),0) AS v FROM fato.titulo WHERE app_key=$1 AND natureza='R' AND status NOT IN ('CANCELADO','RECEBIDO','LIQUIDADO')`,
    },
    {
      metrica: "ap_valor_total",
      omie: `SELECT ap_valor_total FROM fato.resumo_snapshot WHERE app_key=$1 ORDER BY data_referencia DESC LIMIT 1`,
      bi: `SELECT COALESCE(SUM(valor_aberto),0) AS v FROM fato.titulo WHERE app_key=$1 AND natureza='P' AND status NOT IN ('CANCELADO','PAGO','LIQUIDADO')`,
    },
    {
      metrica: "ar_valor_atraso",
      omie: `SELECT ar_valor_atraso FROM fato.resumo_snapshot WHERE app_key=$1 ORDER BY data_referencia DESC LIMIT 1`,
      bi: `SELECT COALESCE(SUM(valor_aberto),0) AS v FROM fato.titulo WHERE app_key=$1 AND natureza='R' AND status='ATRASADO'`,
    },
    {
      metrica: "ap_valor_atraso",
      omie: `SELECT ap_valor_atraso FROM fato.resumo_snapshot WHERE app_key=$1 ORDER BY data_referencia DESC LIMIT 1`,
      bi: `SELECT COALESCE(SUM(valor_aberto),0) AS v FROM fato.titulo WHERE app_key=$1 AND natureza='P' AND status='ATRASADO'`,
    },
    {
      metrica: "cc_saldo_total",
      omie: `SELECT cc_saldo_total FROM fato.resumo_snapshot WHERE app_key=$1 ORDER BY data_referencia DESC LIMIT 1`,
      bi: `SELECT COALESCE(SUM(saldo_atual),0) AS v FROM fato.saldo_conta_corrente s
           WHERE s.app_key=$1 AND s.data_referencia = (
             SELECT MAX(data_referencia) FROM fato.saldo_conta_corrente WHERE app_key=$1
           )`,
    },
  ];

  const today = new Date().toISOString().slice(0, 10);
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

async function loadFull() {
  const report = {};
  const steps = [
    ["empresas", syncEmpresas],
    ["bancos", syncBancos],
    ["contasCorrentes", syncContasCorrentes],
    ["dre", syncDre],
    ["categorias", syncCategorias],
    ["departamentos", syncDepartamentos],
    ["origens", syncOrigens],
    ["parcelas", syncParcelas],
    ["clientes", syncClientes],
    ["titulos", syncTitulos],
    ["extrato", () => syncExtrato(12)],
    ["orcamentos", () => syncOrcamentos(12)],
    ["resumo", syncResumo],
  ];
  for (const [name, fn] of steps) {
    const t0 = Date.now();
    console.log(`\n>> sync ${name}`);
    try {
      const result = await fn();
      report[name] = { ok: true, result, ms: Date.now() - t0 };
      console.log(`   ok ${name} em ${Date.now() - t0}ms`, typeof result === "number" ? result : "");
    } catch (err) {
      report[name] = { ok: false, error: err.message, ms: Date.now() - t0 };
      console.error(`   ERRO ${name}:`, err.message);
    }
  }
  try {
    report.reconciliacao = await reconcile();
    console.log("\n>> reconciliacao", report.reconciliacao);
  } catch (err) {
    report.reconciliacao = { error: err.message };
  }
  return report;
}

module.exports = {
  loadFull,
  syncEmpresas,
  syncBancos,
  syncContasCorrentes,
  syncClientes,
  syncTitulos,
  syncExtrato,
  syncOrcamentos,
  syncResumo,
  reconcile,
};
