import { query } from "./db";
import { n } from "./format";

export type Empresa = {
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
};

export type Resumo = {
  data_referencia: string;
  cc_saldo_total: number;
  cc_limite_credito: number;
  ar_qtd_titulos: number;
  ar_valor_total: number;
  ar_valor_atraso: number;
  ap_qtd_titulos: number;
  ap_valor_total: number;
  ap_valor_atraso: number;
  fluxo_pagar: number;
  fluxo_receber: number;
  fluxo_saldo: number;
};

export type KpiHome = {
  empresa: Empresa | null;
  resumo: Resumo | null;
  arAberto: number;
  apAberto: number;
  arAtraso: number;
  apAtraso: number;
  receber7: number;
  receber30: number;
  pagar7: number;
  pagar30: number;
  lastSync: string | null;
};

export async function getEmpresa(): Promise<Empresa | null> {
  const rows = await query<Empresa>(
    `SELECT razao_social, nome_fantasia, cnpj FROM dim.empresa ORDER BY id LIMIT 1`
  );
  return rows[0] ?? null;
}

export async function getResumo(): Promise<Resumo | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT data_referencia::text, cc_saldo_total, cc_limite_credito,
            ar_qtd_titulos, ar_valor_total, ar_valor_atraso,
            ap_qtd_titulos, ap_valor_total, ap_valor_atraso,
            fluxo_pagar, fluxo_receber, fluxo_saldo
     FROM fato.resumo_snapshot
     ORDER BY data_referencia DESC LIMIT 1`
  );
  const r = rows[0];
  if (!r) return null;
  return {
    data_referencia: String(r.data_referencia),
    cc_saldo_total: n(r.cc_saldo_total),
    cc_limite_credito: n(r.cc_limite_credito),
    ar_qtd_titulos: n(r.ar_qtd_titulos),
    ar_valor_total: n(r.ar_valor_total),
    ar_valor_atraso: n(r.ar_valor_atraso),
    ap_qtd_titulos: n(r.ap_qtd_titulos),
    ap_valor_total: n(r.ap_valor_total),
    ap_valor_atraso: n(r.ap_valor_atraso),
    fluxo_pagar: n(r.fluxo_pagar),
    fluxo_receber: n(r.fluxo_receber),
    fluxo_saldo: n(r.fluxo_saldo),
  };
}

export async function getHomeKpis(): Promise<KpiHome> {
  const [empresa, resumo, extras, last] = await Promise.all([
    getEmpresa(),
    getResumo(),
    query<Record<string, unknown>>(`
      SELECT
        COALESCE(SUM(valor_aberto) FILTER (WHERE natureza='R' AND status NOT IN ('CANCELADO','RECEBIDO','LIQUIDADO')),0) AS ar_aberto,
        COALESCE(SUM(valor_aberto) FILTER (WHERE natureza='P' AND status NOT IN ('CANCELADO','PAGO','LIQUIDADO')),0) AS ap_aberto,
        COALESCE(SUM(valor_aberto) FILTER (WHERE natureza='R' AND status='ATRASADO'),0) AS ar_atraso,
        COALESCE(SUM(valor_aberto) FILTER (WHERE natureza='P' AND status='ATRASADO'),0) AS ap_atraso,
        COALESCE(SUM(valor_aberto) FILTER (WHERE natureza='R' AND status NOT IN ('CANCELADO','RECEBIDO','LIQUIDADO') AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7),0) AS rec7,
        COALESCE(SUM(valor_aberto) FILTER (WHERE natureza='R' AND status NOT IN ('CANCELADO','RECEBIDO','LIQUIDADO') AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30),0) AS rec30,
        COALESCE(SUM(valor_aberto) FILTER (WHERE natureza='P' AND status NOT IN ('CANCELADO','PAGO','LIQUIDADO') AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7),0) AS pag7,
        COALESCE(SUM(valor_aberto) FILTER (WHERE natureza='P' AND status NOT IN ('CANCELADO','PAGO','LIQUIDADO') AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30),0) AS pag30
      FROM fato.titulo
    `),
    query<Record<string, unknown>>(
      `SELECT finished_at::text AS ts FROM ops.sync_log WHERE status='success' ORDER BY finished_at DESC NULLS LAST LIMIT 1`
    ),
  ]);
  const x = extras[0] ?? {};
  return {
    empresa,
    resumo,
    arAberto: n(x.ar_aberto),
    apAberto: n(x.ap_aberto),
    arAtraso: n(x.ar_atraso),
    apAtraso: n(x.ap_atraso),
    receber7: n(x.rec7),
    receber30: n(x.rec30),
    pagar7: n(x.pag7),
    pagar30: n(x.pag30),
    lastSync: last[0] ? String(last[0].ts) : null,
  };
}

export async function getAging(natureza: "R" | "P") {
  return query<{ faixa: string; qtd: number; valor: number }>(
    `SELECT faixa_aging AS faixa, COUNT(*)::int AS qtd, COALESCE(SUM(valor_aberto),0)::float AS valor
     FROM ${natureza === "R" ? "fato.vw_aging_receber" : "fato.vw_aging_pagar"}
     GROUP BY faixa_aging
     ORDER BY faixa_aging`
  );
}

export async function getRanking(natureza: "R" | "P", limit = 10) {
  return query<{ razao_social: string; cnpj_cpf: string | null; valor: number; qtd: number }>(
    `SELECT COALESCE(c.razao_social,'(sem cadastro)') AS razao_social, c.cnpj_cpf,
            COALESCE(SUM(t.valor_aberto),0)::float AS valor, COUNT(*)::int AS qtd
     FROM fato.titulo t
     LEFT JOIN dim.cliente c ON c.app_key=t.app_key AND c.codigo_cliente_omie=t.codigo_cliente_omie
     WHERE t.natureza=$1
       AND t.status::text NOT IN ('CANCELADO', CASE WHEN $1='R' THEN 'RECEBIDO' ELSE 'PAGO' END, 'LIQUIDADO')
       AND t.valor_aberto > 0
     GROUP BY c.razao_social, c.cnpj_cpf
     ORDER BY valor DESC
     LIMIT $2`,
    [natureza, limit]
  );
}

export type TituloRow = {
  codigo_titulo_omie: string;
  numero_titulo: string | null;
  razao_social: string | null;
  status: string;
  data_vencimento: string | null;
  data_emissao: string | null;
  valor_titulo: number;
  valor_aberto: number;
  valor_pago: number;
  codigo_categoria: string | null;
  descricao_categoria: string | null;
  origem: string | null;
};

export async function getTitulos(natureza: "R" | "P", limit = 80): Promise<TituloRow[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT t.codigo_titulo_omie::text, t.numero_titulo, c.razao_social, t.status::text,
            t.data_vencimento::text, t.data_emissao::text,
            t.valor_titulo::float, t.valor_aberto::float, t.valor_pago::float,
            t.codigo_categoria, cat.descricao AS descricao_categoria, t.codigo_origem AS origem
     FROM fato.titulo t
     LEFT JOIN dim.cliente c ON c.app_key=t.app_key AND c.codigo_cliente_omie=t.codigo_cliente_omie
     LEFT JOIN dim.categoria cat ON cat.app_key=t.app_key AND cat.codigo=t.codigo_categoria
     WHERE t.natureza=$1
     ORDER BY
       CASE WHEN t.status IN ('ATRASADO') THEN 0
            WHEN t.status IN ('VENCEHOJE','AVENCER','EMABERTO','PAGTO_PARCIAL') THEN 1
            ELSE 2 END,
       t.data_vencimento ASC NULLS LAST
     LIMIT $2`,
    [natureza, limit]
  );
  return rows.map((r) => ({
    codigo_titulo_omie: String(r.codigo_titulo_omie),
    numero_titulo: r.numero_titulo ? String(r.numero_titulo) : null,
    razao_social: r.razao_social ? String(r.razao_social) : null,
    status: String(r.status),
    data_vencimento: r.data_vencimento ? String(r.data_vencimento) : null,
    data_emissao: r.data_emissao ? String(r.data_emissao) : null,
    valor_titulo: n(r.valor_titulo),
    valor_aberto: n(r.valor_aberto),
    valor_pago: n(r.valor_pago),
    codigo_categoria: r.codigo_categoria ? String(r.codigo_categoria) : null,
    descricao_categoria: r.descricao_categoria ? String(r.descricao_categoria) : null,
    origem: r.origem ? String(r.origem) : null,
  }));
}

export async function getFluxoMensal(months = 12) {
  return query<{ mes: string; receber: number; pagar: number }>(
    `SELECT to_char(date_trunc('month', data_baixa), 'YYYY-MM') AS mes,
            COALESCE(SUM(valor_baixa) FILTER (WHERE natureza='R'),0)::float AS receber,
            COALESCE(SUM(valor_baixa) FILTER (WHERE natureza='P'),0)::float AS pagar
     FROM fato.baixa
     WHERE data_baixa >= (CURRENT_DATE - ($1 || ' months')::interval)
     GROUP BY 1
     ORDER BY 1`,
    [months]
  );
}

export async function getFluxoProjetado() {
  return query<{ data: string; natureza: string; valor: number; qtd: number }>(
    `SELECT data::text, natureza::text, valor_total::float AS valor, qtd_titulos::int AS qtd
     FROM fato.vw_fluxo_caixa_projetado
     WHERE data <= CURRENT_DATE + 45
     ORDER BY data, natureza`
  );
}

export async function getFluxoPorCategoria() {
  return query<{ codigo: string; descricao: string; receber: number; pagar: number }>(
    `SELECT COALESCE(t.codigo_categoria,'(sem)') AS codigo,
            COALESCE(c.descricao, t.codigo_categoria, '(sem categoria)') AS descricao,
            COALESCE(SUM(t.valor_aberto) FILTER (WHERE t.natureza='R'),0)::float AS receber,
            COALESCE(SUM(t.valor_aberto) FILTER (WHERE t.natureza='P'),0)::float AS pagar
     FROM fato.titulo t
     LEFT JOIN dim.categoria c ON c.app_key=t.app_key AND c.codigo=t.codigo_categoria
     WHERE t.status NOT IN ('CANCELADO','PAGO','RECEBIDO','LIQUIDADO') AND t.valor_aberto > 0
     GROUP BY 1,2
     ORDER BY (COALESCE(SUM(t.valor_aberto),0)) DESC
     LIMIT 12`
  );
}

export async function getContas() {
  return query<{
    codigo_cc_omie: string;
    descricao: string;
    banco: string | null;
    tipo: string | null;
    saldo: number;
    previsto: number;
  }>(
    `SELECT cc.codigo_cc_omie::text, cc.descricao, b.nome AS banco, cc.tipo_conta_corrente AS tipo,
            COALESCE(s.saldo_atual,0)::float AS saldo,
            COALESCE(s.saldo_atual_previsto,0)::float AS previsto
     FROM dim.conta_corrente cc
     LEFT JOIN dim.banco b ON b.codigo_banco = cc.codigo_banco
     LEFT JOIN LATERAL (
       SELECT saldo_atual, saldo_atual_previsto
       FROM fato.saldo_conta_corrente x
       WHERE x.app_key=cc.app_key AND x.codigo_cc_omie=cc.codigo_cc_omie
       ORDER BY data_referencia DESC
       LIMIT 1
     ) s ON true
     WHERE cc.inativa <> 'S'
     ORDER BY cc.descricao`
  );
}

export async function getExtrato(limit = 120) {
  return query<{
    data_lancamento: string;
    descricao: string;
    categoria: string | null;
    natureza: string | null;
    valor: number;
    conta: string;
    situacao: string | null;
  }>(
    `SELECT e.data_lancamento::text, COALESCE(e.nome_cliente, e.razao_social_cliente, e.observacoes, 'Lançamento') AS descricao,
            COALESCE(e.descricao_categoria, e.codigo_categoria) AS categoria,
            e.natureza, e.valor_documento::float AS valor, cc.descricao AS conta, e.situacao
     FROM fato.extrato_movimento e
     JOIN dim.conta_corrente cc ON cc.app_key=e.app_key AND cc.codigo_cc_omie=e.codigo_cc_omie
     WHERE e.codigo_lancamento IS NOT NULL AND e.codigo_lancamento <> 0
     ORDER BY e.data_lancamento DESC, e.id DESC
     LIMIT $1`,
    [limit]
  );
}

export async function getSyncHealth() {
  const logs = await query<Record<string, unknown>>(
    `SELECT id, metodo, endpoint, tipo_sync, status::text, registros_total, paginas_total,
            erro_mensagem, started_at::text, finished_at::text, duracao_ms
     FROM ops.sync_log
     ORDER BY started_at DESC
     LIMIT 30`
  );
  const rec = await query<Record<string, unknown>>(
    `SELECT metrica, valor_omie::float, valor_bi::float, diferenca::float, diferenca_percentual::float, toleravel, data_referencia::text
     FROM ops.reconciliacao
     ORDER BY data_referencia DESC, metrica
     LIMIT 20`
  );
  const counts = await query<Record<string, unknown>>(`
    SELECT
      (SELECT COUNT(*) FROM dim.cliente) AS clientes,
      (SELECT COUNT(*) FROM dim.categoria) AS categorias,
      (SELECT COUNT(*) FROM dim.conta_corrente) AS contas,
      (SELECT COUNT(*) FROM fato.titulo) AS titulos,
      (SELECT COUNT(*) FROM fato.baixa) AS baixas,
      (SELECT COUNT(*) FROM fato.extrato_movimento) AS extrato
  `);
  return { logs, rec, counts: counts[0] ?? {} };
}

export async function getStatusBreakdown(natureza: "R" | "P") {
  return query<{ status: string; qtd: number; valor: number }>(
    `SELECT status::text, COUNT(*)::int AS qtd, COALESCE(SUM(valor_aberto),0)::float AS valor
     FROM fato.titulo
     WHERE natureza=$1
     GROUP BY status
     ORDER BY valor DESC`,
    [natureza]
  );
}
