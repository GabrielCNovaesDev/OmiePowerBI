"use strict";

// Cada tabela é descrita uma vez: colunas na ordem do INSERT, chave natural
// (ON CONFLICT) e colunas de carimbo. O upsert é gerado em lote, uma ida ao
// banco por bloco de linhas, e atualiza todas as colunas não-chave.

const MAX_PARAMS = 60000;

const TABLES = {
  empresa: {
    table: "dim.empresa",
    cols: ["app_key", "codigo_empresa_omie", "cnpj", "razao_social", "nome_fantasia", "estado", "cidade", "regime_tributario", "optante_simples", "inativa"],
    key: ["app_key", "codigo_empresa_omie"],
    touch: ["updated_at"],
  },
  banco: {
    table: "dim.banco",
    cols: ["codigo_banco", "nome", "tipo", "cod_compensacao", "cod_ispb", "integra_pix", "integra_boleto"],
    key: ["codigo_banco"],
    touch: ["updated_at"],
  },
  contaCorrente: {
    table: "dim.conta_corrente",
    cols: ["app_key", "codigo_cc_omie", "codigo_integracao", "descricao", "codigo_banco", "agencia", "numero_conta", "tipo_conta_corrente", "visivel_fluxo_caixa", "visivel_resumo", "saldo_inicial", "inativa"],
    key: ["app_key", "codigo_cc_omie"],
    touch: ["updated_at"],
  },
  cliente: {
    table: "dim.cliente",
    cols: ["app_key", "codigo_cliente_omie", "codigo_integracao", "razao_social", "nome_fantasia", "cnpj_cpf", "inscricao_estadual", "email", "telefone", "cidade", "estado", "cep", "pessoa_fisica", "inativo"],
    key: ["app_key", "codigo_cliente_omie"],
    touch: ["updated_at"],
  },
  categoria: {
    table: "dim.categoria",
    cols: ["app_key", "codigo", "descricao", "descricao_padrao", "categoria_superior", "tipo_categoria", "codigo_dre", "conta_receita", "conta_despesa", "totalizadora", "transferencia", "conta_inativa", "nao_exibir", "definida_pelo_usuario"],
    key: ["app_key", "codigo"],
    touch: ["updated_at"],
  },
  dre: {
    table: "dim.dre",
    cols: ["app_key", "codigo_dre", "descricao", "nivel", "sinal", "totalizadora", "nao_exibir"],
    key: ["app_key", "codigo_dre"],
    touch: ["updated_at"],
  },
  departamento: {
    table: "dim.departamento",
    cols: ["app_key", "codigo", "descricao", "inativo", "nivel_totalizador"],
    key: ["app_key", "codigo"],
    touch: ["updated_at"],
  },
  origem: {
    table: "dim.origem",
    cols: ["codigo", "descricao"],
    key: ["codigo"],
    touch: [],
  },
  parcela: {
    table: "dim.parcela",
    cols: ["codigo_parcela", "descricao", "num_parcelas"],
    key: ["codigo_parcela"],
    touch: [],
  },
  titulo: {
    table: "fato.titulo",
    cols: [
      "app_key", "codigo_titulo_omie", "codigo_integracao", "natureza", "status",
      "codigo_cliente_omie", "codigo_cc_omie", "codigo_categoria", "codigo_tipo_documento", "codigo_origem",
      "codigo_departamento", "codigo_projeto", "codigo_vendedor", "codigo_comprador", "codigo_contrato_omie",
      "codigo_pedido_omie", "codigo_nf_omie", "operacao", "numero_titulo", "numero_documento", "numero_documento_fiscal",
      "numero_parcela", "numero_boleto", "chave_nfe", "codigo_barras", "data_emissao", "data_vencimento", "data_previsao",
      "data_pagamento", "data_registro", "data_cancelamento", "valor_titulo", "valor_pis", "valor_cofins", "valor_csll",
      "valor_ir", "valor_iss", "valor_inss", "retem_pis", "retem_cofins", "retem_csll", "retem_ir", "retem_iss", "retem_inss",
      "liquidado", "valor_pago", "valor_aberto", "total_desconto", "total_juros", "total_multa", "valor_liquido", "observacao",
      "omie_inclusao_data", "omie_inclusao_hora", "omie_inclusao_usuario", "omie_alteracao_data", "omie_alteracao_hora",
      "omie_alteracao_usuario", "importado_api",
    ],
    key: ["app_key", "codigo_titulo_omie"],
    touch: ["synced_at", "updated_at"],
  },
  baixa: {
    table: "fato.baixa",
    cols: ["app_key", "codigo_titulo_omie", "codigo_baixa_omie", "codigo_integracao_baixa", "codigo_lancamento_cc", "codigo_cc_omie", "natureza", "data_baixa", "valor_baixa", "desconto", "juros", "multa", "observacao"],
    key: ["app_key", "codigo_titulo_omie", "codigo_baixa_omie"],
    touch: ["synced_at"],
  },
  rateioCategoria: {
    table: "fato.titulo_rateio_categoria",
    cols: ["app_key", "codigo_titulo_omie", "codigo_categoria", "valor", "percentual"],
    key: ["app_key", "codigo_titulo_omie", "codigo_categoria"],
    touch: [],
  },
  rateioDepartamento: {
    table: "fato.titulo_rateio_departamento",
    cols: ["app_key", "codigo_titulo_omie", "codigo_departamento", "valor", "percentual", "valor_fixo"],
    key: ["app_key", "codigo_titulo_omie", "codigo_departamento"],
    touch: [],
  },
  extrato: {
    table: "fato.extrato_movimento",
    cols: [
      "app_key", "codigo_cc_omie", "codigo_lancamento", "codigo_lancamento_relac", "situacao", "data_lancamento", "natureza",
      "codigo_cliente_omie", "nome_cliente", "razao_social_cliente", "cnpj_cpf_cliente", "tipo_documento", "numero_documento",
      "numero_documento_fiscal", "numero_parcela", "nosso_numero", "codigo_categoria", "descricao_categoria", "origem", "vendedor",
      "projeto", "valor_documento", "saldo_realizado", "saldo_previsto", "data_conciliacao", "bloqueado", "data_inclusao", "hora_inclusao",
      "observacoes",
    ],
    key: ["app_key", "codigo_cc_omie", "codigo_lancamento"],
    touch: ["synced_at"],
  },
  saldo: {
    table: "fato.saldo_conta_corrente",
    cols: ["app_key", "codigo_cc_omie", "data_referencia", "saldo_anterior", "saldo_anterior_previsto", "saldo_atual", "saldo_atual_previsto", "saldo_conciliado", "saldo_provisorio", "limite_credito_total", "saldo_disponivel"],
    key: ["app_key", "codigo_cc_omie", "data_referencia"],
    touch: [],
  },
  orcamento: {
    table: "fato.orcamento_caixa",
    cols: ["app_key", "ano", "mes", "codigo_categoria", "descricao_categoria", "valor_previsto", "valor_realizado"],
    key: ["app_key", "ano", "mes", "codigo_categoria"],
    touch: ["updated_at"],
  },
};

function dedupeByKey(spec, rows) {
  const byKey = new Map();
  for (const row of rows) {
    byKey.set(spec.key.map((k) => String(row[k])).join("\u0001"), row);
  }
  return [...byKey.values()];
}

// Upsert em lote. `rows` são objetos com as colunas de `spec.cols`.
// Linhas repetidas na mesma chave ficam com a última ocorrência (o Postgres
// recusa atualizar a mesma linha duas vezes num único INSERT ... ON CONFLICT).
async function bulkUpsert(client, specName, rows) {
  const spec = TABLES[specName];
  if (!spec) throw new Error(`Tabela desconhecida: ${specName}`);
  const unique = dedupeByKey(spec, rows);
  if (!unique.length) return 0;

  const insertCols = [...spec.cols, ...spec.touch];
  const updates = [
    ...spec.cols.filter((c) => !spec.key.includes(c)).map((c) => `${c}=EXCLUDED.${c}`),
    ...spec.touch.map((c) => `${c}=NOW()`),
  ];
  const conflict = updates.length
    ? `ON CONFLICT (${spec.key.join(", ")}) DO UPDATE SET ${updates.join(", ")}`
    : `ON CONFLICT (${spec.key.join(", ")}) DO NOTHING`;
  const chunkSize = Math.max(1, Math.floor(MAX_PARAMS / spec.cols.length));

  for (let start = 0; start < unique.length; start += chunkSize) {
    const chunk = unique.slice(start, start + chunkSize);
    const values = [];
    const tuples = chunk.map((row) => {
      const placeholders = spec.cols.map((col) => {
        values.push(row[col] === undefined ? null : row[col]);
        return `$${values.length}`;
      });
      return `(${[...placeholders, ...spec.touch.map(() => "NOW()")].join(",")})`;
    });
    await client.query(
      `INSERT INTO ${spec.table} (${insertCols.join(", ")}) VALUES ${tuples.join(",")} ${conflict}`,
      values
    );
  }
  return unique.length;
}

const UPSERT_RESUMO = `
INSERT INTO fato.resumo_snapshot (app_key, data_referencia, cc_saldo_total, cc_limite_credito, ar_qtd_titulos, ar_valor_total, ar_valor_atraso, ap_qtd_titulos, ap_valor_total, ap_valor_atraso, fluxo_pagar, fluxo_receber, fluxo_saldo)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
ON CONFLICT (app_key, data_referencia) DO UPDATE SET
  cc_saldo_total=EXCLUDED.cc_saldo_total, cc_limite_credito=EXCLUDED.cc_limite_credito,
  ar_qtd_titulos=EXCLUDED.ar_qtd_titulos, ar_valor_total=EXCLUDED.ar_valor_total, ar_valor_atraso=EXCLUDED.ar_valor_atraso,
  ap_qtd_titulos=EXCLUDED.ap_qtd_titulos, ap_valor_total=EXCLUDED.ap_valor_total, ap_valor_atraso=EXCLUDED.ap_valor_atraso,
  fluxo_pagar=EXCLUDED.fluxo_pagar, fluxo_receber=EXCLUDED.fluxo_receber, fluxo_saldo=EXCLUDED.fluxo_saldo
RETURNING id`;

module.exports = { TABLES, bulkUpsert, UPSERT_RESUMO };
