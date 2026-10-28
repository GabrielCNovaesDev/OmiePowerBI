// Rateio de categoria.
//
// Na Omie um título pode ser dividido entre várias categorias (ex.: 98% Manutenção,
// 2% Compras). Nesses títulos o cabeçalho vem sem categoria, e o extrato lança o
// pagamento inteiro na primeira categoria do rateio. As relações abaixo substituem
// `fato.titulo` e `fato.extrato_movimento` nas consultas agregadas: títulos com uma
// categoria ficam iguais; títulos rateados viram uma linha por categoria, com os
// valores multiplicados pela fração (`fator`). Somas totais não mudam.
//
// Não usar em listagens linha a linha (Lançamentos, Extrato): lá cada título ou
// movimento deve aparecer uma vez só.

const TITULO_COLS = [
  "id", "app_key", "codigo_titulo_omie", "codigo_integracao", "natureza", "status",
  "codigo_cliente_omie", "codigo_cc_omie", "codigo_tipo_documento", "codigo_origem",
  "codigo_departamento", "codigo_projeto", "codigo_vendedor", "codigo_comprador", "codigo_contrato_omie",
  "codigo_pedido_omie", "codigo_nf_omie", "operacao", "numero_titulo", "numero_documento",
  "numero_documento_fiscal", "numero_parcela", "numero_boleto", "chave_nfe", "codigo_barras",
  "data_emissao", "data_vencimento", "data_previsao", "data_pagamento", "data_registro", "data_cancelamento",
  "retem_pis", "retem_cofins", "retem_csll", "retem_ir", "retem_iss", "retem_inss", "liquidado", "observacao",
  "omie_inclusao_data", "omie_inclusao_hora", "omie_inclusao_usuario", "omie_alteracao_data",
  "omie_alteracao_hora", "omie_alteracao_usuario", "importado_api", "created_at", "updated_at", "synced_at",
];

const TITULO_VALORES = [
  "valor_titulo", "valor_pis", "valor_cofins", "valor_csll", "valor_ir", "valor_iss", "valor_inss",
  "valor_pago", "valor_aberto", "total_desconto", "total_juros", "total_multa", "valor_liquido",
];

const EXTRATO_COLS = [
  "id", "app_key", "codigo_cc_omie", "codigo_lancamento", "codigo_lancamento_relac", "situacao",
  "data_lancamento", "natureza", "codigo_cliente_omie", "nome_cliente", "razao_social_cliente",
  "cnpj_cpf_cliente", "tipo_documento", "numero_documento", "numero_documento_fiscal", "numero_parcela",
  "nosso_numero", "origem", "vendedor", "projeto", "saldo_realizado", "saldo_previsto", "data_conciliacao",
  "bloqueado", "data_inclusao", "hora_inclusao", "observacoes", "created_at", "synced_at",
];

// Frações por categoria, só para títulos com mais de uma categoria.
const RATEIO_MULTI = `(
  SELECT rc.app_key, rc.codigo_titulo_omie, rc.codigo_categoria,
         COALESCE(
           rc.percentual / NULLIF(SUM(rc.percentual) OVER w, 0),
           1.0 / COUNT(*) OVER w
         ) AS fator,
         COUNT(*) OVER w AS n
  FROM fato.titulo_rateio_categoria rc
  WINDOW w AS (PARTITION BY rc.app_key, rc.codigo_titulo_omie)
)`;

export const TITULO_RATEADO = `(
  SELECT ${TITULO_COLS.map((c) => `t0.${c}`).join(", ")},
         COALESCE(r.codigo_categoria, t0.codigo_categoria) AS codigo_categoria,
         ${TITULO_VALORES.map((c) => `t0.${c} * COALESCE(r.fator, 1) AS ${c}`).join(", ")},
         COALESCE(r.fator, 1) AS fator
  FROM fato.titulo t0
  LEFT JOIN ${RATEIO_MULTI} r
    ON r.app_key = t0.app_key AND r.codigo_titulo_omie = t0.codigo_titulo_omie AND r.n > 1
)`;

// Valores realizados em regime de caixa, como nos relatórios "Recebimentos
// realizados" e "Pagamentos realizados" da Omie: baixas de títulos (na conta e
// data da baixa) + lançamentos feitos direto na conta corrente, sem título.
// Transferências e movimentos "Previsto" do extrato não entram aqui; quem filtra
// transferência é a consulta (pela categoria). `valor` é sempre positivo;
// `natureza` é R (entrada) ou P (saída).
export function movimentoRealizado(): string {
  return `(
  SELECT t.app_key, b.data_baixa AS data, t.natureza::text AS natureza,
         b.valor_baixa * t.fator AS valor,
         t.codigo_categoria, t.codigo_cliente_omie, b.codigo_cc_omie,
         t.codigo_departamento, t.codigo_projeto, t.status::text AS status
  FROM fato.baixa b
  JOIN ${TITULO_RATEADO} t ON t.app_key = b.app_key AND t.codigo_titulo_omie = b.codigo_titulo_omie
  UNION ALL
  SELECT e.app_key, e.data_lancamento, CASE WHEN e.natureza = 'E' THEN 'R' ELSE 'P' END,
         ABS(e.valor_documento),
         e.codigo_categoria, e.codigo_cliente_omie, e.codigo_cc_omie,
         NULL::varchar, NULL::bigint, 'CONTA CORRENTE'
  FROM ${EXTRATO_RATEADO} e
  WHERE COALESCE(e.codigo_lancamento, 0) <> 0
    AND e.natureza IN ('E', 'S')
    AND COALESCE(e.situacao, '') <> 'Previsto'
    AND NOT EXISTS (
      SELECT 1 FROM fato.baixa x
      WHERE x.app_key = e.app_key AND x.codigo_lancamento_cc = e.codigo_lancamento
    )
)`;
}

// O movimento do extrato é ligado ao título pela baixa (codigo_lancamento_cc).
// Só divide quando o movimento paga um único título rateado; pagamentos em lote
// de vários títulos ficam como vieram da Omie.
export const EXTRATO_RATEADO = `(
  SELECT ${EXTRATO_COLS.map((c) => `e0.${c}`).join(", ")},
         COALESCE(r.codigo_categoria, e0.codigo_categoria) AS codigo_categoria,
         CASE WHEN r.codigo_categoria IS NULL THEN e0.descricao_categoria END AS descricao_categoria,
         e0.valor_documento * COALESCE(r.fator, 1) AS valor_documento,
         COALESCE(r.fator, 1) AS fator
  FROM fato.extrato_movimento e0
  LEFT JOIN (
    SELECT bx.app_key, bx.codigo_lancamento_cc, rm.codigo_categoria, rm.fator
    FROM (
      SELECT app_key, codigo_lancamento_cc, MIN(codigo_titulo_omie) AS codigo_titulo_omie
      FROM fato.baixa
      WHERE codigo_lancamento_cc IS NOT NULL
      GROUP BY app_key, codigo_lancamento_cc
      HAVING COUNT(DISTINCT codigo_titulo_omie) = 1
    ) bx
    JOIN ${RATEIO_MULTI} rm
      ON rm.app_key = bx.app_key AND rm.codigo_titulo_omie = bx.codigo_titulo_omie AND rm.n > 1
  ) r ON r.app_key = e0.app_key AND r.codigo_lancamento_cc = e0.codigo_lancamento
)`;
