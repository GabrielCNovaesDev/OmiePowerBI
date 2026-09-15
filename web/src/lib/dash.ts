import { query } from "./db";
import { n } from "./format";
import { yearStartISO } from "./period";
import { Binder, dimSql, type DimFilter } from "./params";

const OPEN_R = `NOT IN ('CANCELADO','RECEBIDO','LIQUIDADO')`;
const OPEN_P = `NOT IN ('CANCELADO','PAGO','LIQUIDADO')`;

function openClause(natureza: "R" | "P") {
  return natureza === "R" ? OPEN_R : OPEN_P;
}

export type NamedValue = { nome: string; valor: number; qtd?: number };
export type MonthCash = {
  mes: string;
  label: string;
  entrada: number;
  saida: number;
  transf: number;
  saldoInicial: number;
  resultado: number;
  saldoAcumulado: number;
};
export type DailyPoint = {
  dia: string;
  entrada: number;
  saida: number;
  previstoEntrada: number;
  previstoSaida: number;
  saldo: number;
};
export type TituloHoje = {
  categoria: string | null;
  cliente: string | null;
  nf: string | null;
  vencimento: string | null;
  qtd: number;
  valor: number;
};
export type AgingSlice = { faixa: string; valor: number; qtd: number };
export type CheckItem = { id: string; label: string; count: number; tone: "ok" | "warn" | "err" };

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const idx = Number(m) - 1;
  return names[idx] ? `${names[idx]}` : ym;
}

function tituloCols() {
  return {
    appKey: "t.app_key",
    cliente: "t.codigo_cliente_omie",
    categoria: "t.codigo_categoria",
    conta: "t.codigo_cc_omie",
    departamento: "t.codigo_departamento",
  };
}

export async function getSaldoAtual(filter?: DimFilter) {
  const b = new Binder();
  const rows = await query<Record<string, unknown>>(`
    SELECT COALESCE(SUM(s.saldo_atual),0)::float AS saldo,
           COALESCE(SUM(s.saldo_atual_previsto),0)::float AS previsto,
           COALESCE(SUM(s.limite_credito_total),0)::float AS limite
    FROM dim.conta_corrente cc
    LEFT JOIN LATERAL (
      SELECT saldo_atual, saldo_atual_previsto, limite_credito_total
      FROM fato.saldo_conta_corrente x
      WHERE x.app_key = cc.app_key AND x.codigo_cc_omie = cc.codigo_cc_omie
      ORDER BY data_referencia DESC
      LIMIT 1
    ) s ON true
    WHERE COALESCE(cc.inativa,'N') <> 'S'
      ${dimSql(b, filter, { appKey: "cc.app_key", conta: "cc.codigo_cc_omie" })}
  `, b.values);
  const r = rows[0] ?? {};
  return { saldo: n(r.saldo), previsto: n(r.previsto), limite: n(r.limite) };
}

export async function getSaldoPorConta(filter?: DimFilter) {
  const b = new Binder();
  return query<{ conta: string; saldo: number; previsto: number; disponivel: number }>(
    `SELECT cc.descricao AS conta,
            COALESCE(s.saldo_atual,0)::float AS saldo,
            COALESCE(s.saldo_atual_previsto,0)::float AS previsto,
            COALESCE(s.saldo_disponivel, s.saldo_atual + s.limite_credito_total, 0)::float AS disponivel
     FROM dim.conta_corrente cc
     LEFT JOIN LATERAL (
       SELECT saldo_atual, saldo_atual_previsto, saldo_disponivel, limite_credito_total
       FROM fato.saldo_conta_corrente x
       WHERE x.app_key=cc.app_key AND x.codigo_cc_omie=cc.codigo_cc_omie
       ORDER BY data_referencia DESC LIMIT 1
     ) s ON true
     WHERE COALESCE(cc.inativa,'N') <> 'S'
       ${dimSql(b, filter, { appKey: "cc.app_key", conta: "cc.codigo_cc_omie" })}
     ORDER BY cc.descricao`,
    b.values
  );
}

export async function getSaldoEvolucaoMensal(from: string, to: string, filter?: DimFilter) {
  const b = new Binder();
  const fromP = b.add(from);
  const toP = b.add(to);
  const rows = await query<{ mes: string; conta: string; saldo: number }>(
    `SELECT to_char(date_trunc('month', s.data_referencia), 'YYYY-MM') AS mes,
            cc.descricao AS conta,
            (ARRAY_AGG(s.saldo_atual ORDER BY s.data_referencia DESC))[1]::float AS saldo
     FROM fato.saldo_conta_corrente s
     JOIN dim.conta_corrente cc ON cc.app_key=s.app_key AND cc.codigo_cc_omie=s.codigo_cc_omie
     WHERE s.data_referencia BETWEEN ${fromP}::date AND ${toP}::date
       ${dimSql(b, filter, { appKey: "cc.app_key", conta: "cc.codigo_cc_omie" })}
     GROUP BY 1, 2
     ORDER BY 1, 2`,
    b.values
  );
  return rows;
}

export async function getTitulosHoje(natureza: "R" | "P", filter?: DimFilter): Promise<TituloHoje[]> {
  const b = new Binder();
  const nat = b.add(natureza);
  return query<TituloHoje>(
    `SELECT COALESCE(cat.descricao, t.codigo_categoria, '(sem categoria)') AS categoria,
            COALESCE(c.razao_social, '(sem cadastro)') AS cliente,
            t.numero_documento_fiscal AS nf,
            t.data_vencimento::text AS vencimento,
            COUNT(*)::int AS qtd,
            COALESCE(SUM(t.valor_aberto),0)::float AS valor
     FROM fato.titulo t
     LEFT JOIN dim.cliente c ON c.app_key=t.app_key AND c.codigo_cliente_omie=t.codigo_cliente_omie
     LEFT JOIN dim.categoria cat ON cat.app_key=t.app_key AND cat.codigo=t.codigo_categoria
     WHERE t.natureza=${nat}
       AND t.status ${openClause(natureza)}
       AND t.valor_aberto > 0
       AND t.data_vencimento = CURRENT_DATE
       ${dimSql(b, filter, tituloCols())}
     GROUP BY 1,2,3,4
     ORDER BY valor DESC
     LIMIT 40`,
    b.values
  );
}

export async function getKpisDia(filter?: DimFilter) {
  const b = new Binder();
  const rows = await query<Record<string, unknown>>(`
    SELECT
      COALESCE(SUM(valor_aberto) FILTER (WHERE natureza='R' AND status ${OPEN_R} AND data_vencimento = CURRENT_DATE),0)::float AS receber_hoje,
      COALESCE(SUM(valor_aberto) FILTER (WHERE natureza='P' AND status ${OPEN_P} AND data_vencimento = CURRENT_DATE),0)::float AS pagar_hoje,
      COALESCE(SUM(valor_aberto) FILTER (WHERE natureza='R' AND status='ATRASADO'),0)::float AS receber_atraso,
      COALESCE(SUM(valor_aberto) FILTER (WHERE natureza='P' AND status='ATRASADO'),0)::float AS pagar_atraso,
      COUNT(*) FILTER (WHERE natureza='R' AND status ${OPEN_R} AND data_vencimento = CURRENT_DATE)::int AS qtd_receber,
      COUNT(*) FILTER (WHERE natureza='P' AND status ${OPEN_P} AND data_vencimento = CURRENT_DATE)::int AS qtd_pagar
    FROM fato.titulo t
    WHERE 1=1 ${dimSql(b, filter, tituloCols())}
  `, b.values);
  const r = rows[0] ?? {};
  return {
    receberHoje: n(r.receber_hoje),
    pagarHoje: n(r.pagar_hoje),
    receberAtraso: n(r.receber_atraso),
    pagarAtraso: n(r.pagar_atraso),
    qtdReceber: n(r.qtd_receber),
    qtdPagar: n(r.qtd_pagar),
  };
}

export async function getFluxoMensalCaixa(from: string, to: string, filter?: DimFilter): Promise<MonthCash[]> {
  const openB = new Binder();
  const fromOpen = openB.add(from);
  const openingRows = await query<Record<string, unknown>>(
    `SELECT COALESCE(SUM(s.saldo_atual),0)::float AS saldo
     FROM dim.conta_corrente cc
     LEFT JOIN LATERAL (
       SELECT saldo_atual FROM fato.saldo_conta_corrente x
       WHERE x.app_key=cc.app_key AND x.codigo_cc_omie=cc.codigo_cc_omie
         AND x.data_referencia < ${fromOpen}::date
       ORDER BY data_referencia DESC LIMIT 1
     ) s ON true
     WHERE COALESCE(cc.inativa,'N') <> 'S'
       ${dimSql(openB, filter, { appKey: "cc.app_key", conta: "cc.codigo_cc_omie" })}`,
    openB.values
  );
  const b = new Binder();
  const fromP = b.add(from);
  const toP = b.add(to);
  const extratoDims = dimSql(b, filter, {
    appKey: "e.app_key",
    cliente: "e.codigo_cliente_omie",
    categoria: "e.codigo_categoria",
    conta: "e.codigo_cc_omie",
  });
  const months = await query<Record<string, unknown>>(
    `SELECT to_char(date_trunc('month', e.data_lancamento), 'YYYY-MM') AS mes,
            COALESCE(SUM(ABS(e.valor_documento)) FILTER (
              WHERE e.natureza='E' AND COALESCE(c.transferencia,'N') <> 'S'
            ),0)::float AS entrada,
            COALESCE(SUM(ABS(e.valor_documento)) FILTER (
              WHERE e.natureza='S' AND COALESCE(c.transferencia,'N') <> 'S'
            ),0)::float AS saida,
            COALESCE(SUM(CASE
              WHEN COALESCE(c.transferencia,'N')='S' AND e.natureza='E' THEN e.valor_documento
              WHEN COALESCE(c.transferencia,'N')='S' AND e.natureza='S' THEN -e.valor_documento
              ELSE 0 END),0)::float AS transf
     FROM fato.extrato_movimento e
     LEFT JOIN dim.categoria c ON c.app_key=e.app_key AND c.codigo=e.codigo_categoria
     WHERE e.data_lancamento BETWEEN ${fromP}::date AND ${toP}::date
       AND COALESCE(e.codigo_lancamento,0) <> 0
       ${extratoDims}
     GROUP BY 1
     ORDER BY 1`,
    b.values
  );

  let used = months;
  if (!used.length) {
    const fb = new Binder();
    const f1 = fb.add(from);
    const f2 = fb.add(to);
    used = await query<Record<string, unknown>>(
      `SELECT to_char(date_trunc('month', b.data_baixa), 'YYYY-MM') AS mes,
              COALESCE(SUM(b.valor_baixa) FILTER (WHERE t.natureza='R'),0)::float AS entrada,
              COALESCE(SUM(b.valor_baixa) FILTER (WHERE t.natureza='P'),0)::float AS saida,
              0::float AS transf
       FROM fato.baixa b
       JOIN fato.titulo t ON t.app_key=b.app_key AND t.codigo_titulo_omie=b.codigo_titulo_omie
       WHERE b.data_baixa BETWEEN ${f1}::date AND ${f2}::date
         ${dimSql(fb, filter, tituloCols())}
       GROUP BY 1
       ORDER BY 1`,
      fb.values
    );
  }

  let acc = n(openingRows[0]?.saldo);
  return used.map((m) => {
    const entrada = n(m.entrada);
    const saida = n(m.saida);
    const transf = n(m.transf);
    const saldoInicial = acc;
    const resultado = entrada + transf - saida;
    acc = saldoInicial + resultado;
    const mes = String(m.mes);
    return {
      mes,
      label: monthLabel(mes),
      entrada,
      saida,
      transf,
      saldoInicial,
      resultado,
      saldoAcumulado: acc,
    };
  });
}

export async function getFluxoDiarioMes(from: string, to: string, filter?: DimFilter): Promise<DailyPoint[]> {
  const a = new Binder();
  const aFrom = a.add(from);
  const aTo = a.add(to);
  const actual = await query<{ dia: string; entrada: number; saida: number }>(
    `SELECT e.data_lancamento::text AS dia,
            COALESCE(SUM(e.valor_documento) FILTER (WHERE e.natureza='E'),0)::float AS entrada,
            COALESCE(SUM(e.valor_documento) FILTER (WHERE e.natureza='S'),0)::float AS saida
     FROM fato.extrato_movimento e
     WHERE e.data_lancamento BETWEEN ${aFrom}::date AND ${aTo}::date
       AND COALESCE(e.codigo_lancamento,0) <> 0
       ${dimSql(a, filter, { appKey: "e.app_key", cliente: "e.codigo_cliente_omie", categoria: "e.codigo_categoria", conta: "e.codigo_cc_omie" })}
     GROUP BY 1
     ORDER BY 1`,
    a.values
  );
  const p = new Binder();
  const pFrom = p.add(from);
  const pTo = p.add(to);
  const prev = await query<{ dia: string; natureza: string; valor: number }>(
    `SELECT data_vencimento::text AS dia, natureza::text, COALESCE(SUM(valor_aberto),0)::float AS valor
     FROM fato.titulo t
     WHERE data_vencimento BETWEEN GREATEST(${pFrom}::date, CURRENT_DATE) AND ${pTo}::date
       AND valor_aberto > 0
       AND status::text NOT IN ('CANCELADO','PAGO','RECEBIDO','LIQUIDADO')
       ${dimSql(p, filter, tituloCols())}
     GROUP BY 1, 2`,
    p.values
  );

  const map = new Map<string, DailyPoint>();
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cursor <= end) {
    const dia = cursor.toISOString().slice(0, 10);
    map.set(dia, { dia, entrada: 0, saida: 0, previstoEntrada: 0, previstoSaida: 0, saldo: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const row of actual) {
    const item = map.get(row.dia.slice(0, 10));
    if (item) {
      item.entrada = n(row.entrada);
      item.saida = n(row.saida);
    }
  }
  for (const row of prev) {
    const item = map.get(row.dia.slice(0, 10));
    if (!item) continue;
    if (row.natureza === "R") item.previstoEntrada = n(row.valor);
    if (row.natureza === "P") item.previstoSaida = n(row.valor);
  }

  const opening = await getSaldoAtual(filter);
  const days = [...map.values()];
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  let running = opening.saldo;
  // rewind to start of series using actuals before today
  for (const d of days) {
    if (d.dia < today) running -= d.entrada - d.saida;
  }
  for (const d of days) {
    if (d.dia < today) running += d.entrada - d.saida;
    else running += d.entrada + d.previstoEntrada - d.saida - d.previstoSaida;
    d.saldo = running;
  }
  return days;
}

export async function getAgingBi(natureza: "R" | "P", atrasado: boolean, filter?: DimFilter): Promise<AgingSlice[]> {
  const sign = atrasado ? "CURRENT_DATE - t.data_vencimento" : "t.data_vencimento - CURRENT_DATE";
  const extra = atrasado
    ? `AND t.data_vencimento < CURRENT_DATE AND t.status = 'ATRASADO'`
    : `AND t.data_vencimento >= CURRENT_DATE AND t.status ${openClause(natureza)}`;
  const b = new Binder();
  const nat = b.add(natureza);
  return query<AgingSlice>(
    `SELECT CASE
              WHEN ${sign} < 30 THEN 'Menor que 30'
              WHEN ${sign} < 60 THEN 'Entre 30 a 60'
              WHEN ${sign} < 90 THEN 'Entre 60 a 90'
              WHEN ${sign} < 180 THEN 'Entre 90 a 180'
              ELSE 'Maior que 180'
            END AS faixa,
            COALESCE(SUM(t.valor_aberto),0)::float AS valor,
            COUNT(*)::int AS qtd
     FROM fato.titulo t
     WHERE t.natureza=${nat} AND t.valor_aberto > 0 AND t.status::text NOT IN ('CANCELADO','PAGO','RECEBIDO','LIQUIDADO')
       ${extra}
       ${dimSql(b, filter, tituloCols())}
     GROUP BY 1`,
    b.values
  );
}

export async function getAgingByDim(
  natureza: "R" | "P",
  atrasado: boolean,
  dim: "categoria" | "cliente",
  filter?: DimFilter
): Promise<NamedValue[]> {
  const extra = atrasado
    ? `AND t.data_vencimento < CURRENT_DATE`
    : `AND t.data_vencimento >= CURRENT_DATE`;
  const nameExpr =
    dim === "categoria"
      ? `COALESCE(cat.descricao, t.codigo_categoria, '(sem categoria)')`
      : `COALESCE(c.razao_social, '(sem cadastro)')`;
  const b = new Binder();
  const nat = b.add(natureza);
  return query<NamedValue>(
    `SELECT ${nameExpr} AS nome,
            COALESCE(SUM(t.valor_aberto),0)::float AS valor,
            COUNT(*)::int AS qtd
     FROM fato.titulo t
     LEFT JOIN dim.cliente c ON c.app_key=t.app_key AND c.codigo_cliente_omie=t.codigo_cliente_omie
     LEFT JOIN dim.categoria cat ON cat.app_key=t.app_key AND cat.codigo=t.codigo_categoria
     WHERE t.natureza=${nat} AND t.valor_aberto > 0
       AND t.status ${openClause(natureza)}
       ${extra}
       ${dimSql(b, filter, tituloCols())}
     GROUP BY 1
     ORDER BY valor DESC
     LIMIT 12`,
    b.values
  );
}

export type Kind = "receita" | "custo" | "despesa";

function kindSql(kind: Kind) {
  if (kind === "receita") {
    return `(t.natureza = 'R' AND COALESCE(cat.transferencia,'N') <> 'S')`;
  }
  if (kind === "custo") {
    return `(t.natureza = 'P' AND (
      COALESCE(d.descricao,'') ILIKE '%custo%'
      OR COALESCE(cat.codigo,'') LIKE '2.01%'
      OR COALESCE(cat.descricao,'') ILIKE '%custo%'
      OR COALESCE(cat.descricao,'') ILIKE '%compra%'
      OR COALESCE(cat.descricao,'') ILIKE '%cmv%'
    ))`;
  }
  return `(t.natureza = 'P' AND COALESCE(cat.transferencia,'N') <> 'S' AND NOT (
      COALESCE(d.descricao,'') ILIKE '%custo%'
      OR COALESCE(cat.codigo,'') LIKE '2.01%'
      OR COALESCE(cat.descricao,'') ILIKE '%custo%'
      OR COALESCE(cat.descricao,'') ILIKE '%compra%'
      OR COALESCE(cat.descricao,'') ILIKE '%cmv%'
  ))`;
}

export async function getBreakdown(kind: Kind, from: string, to: string, base: "caixa" | "comp", filter?: DimFilter) {
  const dateCol = base === "caixa" ? "COALESCE(t.data_pagamento, t.data_vencimento)" : "COALESCE(t.data_emissao, t.data_registro, t.data_vencimento)";
  const valueCol = base === "caixa" ? "CASE WHEN t.valor_pago > 0 THEN t.valor_pago ELSE t.valor_titulo END" : "t.valor_titulo";
  const filtro = kindSql(kind);
  const b = new Binder();
  const fromP = b.add(from);
  const toP = b.add(to);
  const dims = dimSql(b, filter, tituloCols());
  const join = `
    FROM fato.titulo t
    LEFT JOIN dim.cliente c ON c.app_key=t.app_key AND c.codigo_cliente_omie=t.codigo_cliente_omie
    LEFT JOIN dim.categoria cat ON cat.app_key=t.app_key AND cat.codigo=t.codigo_categoria
    LEFT JOIN dim.dre d ON d.app_key=t.app_key AND d.codigo_dre=cat.codigo_dre
    WHERE ${filtro}
      AND t.status::text <> 'CANCELADO'
      AND ${dateCol} BETWEEN ${fromP}::date AND ${toP}::date
      ${dims}
  `;

  const [cnpj, status, uf, clientes, categorias, projetos] = await Promise.all([
    query<NamedValue>(`SELECT COALESCE(c.cnpj_cpf, '(sem CNPJ)') AS nome, COALESCE(SUM(${valueCol}),0)::float AS valor ${join} GROUP BY 1 ORDER BY valor DESC LIMIT 8`, b.values),
    query<NamedValue>(`SELECT t.status::text AS nome, COALESCE(SUM(${valueCol}),0)::float AS valor ${join} GROUP BY 1 ORDER BY valor DESC`, b.values),
    query<NamedValue>(`SELECT COALESCE(NULLIF(c.estado,''), '(sem UF)') AS nome, COALESCE(SUM(${valueCol}),0)::float AS valor ${join} GROUP BY 1 ORDER BY valor DESC`, b.values),
    query<NamedValue>(`SELECT COALESCE(c.razao_social,'(sem cadastro)') AS nome, COALESCE(SUM(${valueCol}),0)::float AS valor ${join} GROUP BY 1 ORDER BY valor DESC LIMIT 15`, b.values),
    query<NamedValue>(`SELECT COALESCE(cat.descricao, t.codigo_categoria, '(sem categoria)') AS nome, COALESCE(SUM(${valueCol}),0)::float AS valor ${join} GROUP BY 1 ORDER BY valor DESC LIMIT 12`, b.values),
    query<NamedValue>(`SELECT COALESCE(t.codigo_projeto::text, '(em branco)') AS nome, COALESCE(SUM(${valueCol}),0)::float AS valor ${join} GROUP BY 1 ORDER BY valor DESC LIMIT 8`, b.values),
  ]);

  const total = clientes.reduce((s, x) => s + n(x.valor), 0);
  return { total, cnpj, status, uf, clientes, categorias, projetos };
}

export async function getResultado(from: string, to: string, filter?: DimFilter) {
  const b = new Binder();
  const fromP = b.add(from);
  const toP = b.add(to);
  const rows = await query<Record<string, unknown>>(
    `SELECT
       COALESCE(SUM(b.valor_baixa) FILTER (WHERE t.natureza='R' AND COALESCE(cat.transferencia,'N')<>'S'),0)::float AS receita,
       COALESCE(SUM(b.valor_baixa) FILTER (WHERE t.natureza='P' AND (
         COALESCE(d.descricao,'') ILIKE '%custo%' OR COALESCE(cat.codigo,'') LIKE '2.01%'
       )),0)::float AS custos,
       COALESCE(SUM(b.valor_baixa) FILTER (WHERE t.natureza='P' AND COALESCE(cat.transferencia,'N')<>'S' AND NOT (
         COALESCE(d.descricao,'') ILIKE '%custo%' OR COALESCE(cat.codigo,'') LIKE '2.01%'
       )),0)::float AS despesas
     FROM fato.baixa b
     JOIN fato.titulo t ON t.app_key=b.app_key AND t.codigo_titulo_omie=b.codigo_titulo_omie
     LEFT JOIN dim.categoria cat ON cat.app_key=t.app_key AND cat.codigo=t.codigo_categoria
     LEFT JOIN dim.dre d ON d.app_key=t.app_key AND d.codigo_dre=cat.codigo_dre
     WHERE b.data_baixa BETWEEN ${fromP}::date AND ${toP}::date
       ${dimSql(b, filter, tituloCols())}`,
    b.values
  );
  const r = rows[0] ?? {};
  const receita = n(r.receita);
  const custos = n(r.custos);
  const despesas = n(r.despesas);
  const bruto = receita - custos;
  const ebitda = bruto - despesas;
  return { receita, custos, despesas, bruto, ebitda, resultado: ebitda };
}

export async function getResultadoMensal(from: string, to: string, filter?: DimFilter) {
  const b = new Binder();
  const fromP = b.add(from);
  const toP = b.add(to);
  return query<{ mes: string; receita: number; custos: number; despesas: number; resultado: number }>(
    `SELECT to_char(date_trunc('month', b.data_baixa), 'YYYY-MM') AS mes,
            COALESCE(SUM(b.valor_baixa) FILTER (WHERE t.natureza='R' AND COALESCE(cat.transferencia,'N')<>'S'),0)::float AS receita,
            COALESCE(SUM(b.valor_baixa) FILTER (WHERE t.natureza='P' AND (
              COALESCE(d.descricao,'') ILIKE '%custo%' OR COALESCE(cat.codigo,'') LIKE '2.01%'
            )),0)::float AS custos,
            COALESCE(SUM(b.valor_baixa) FILTER (WHERE t.natureza='P' AND COALESCE(cat.transferencia,'N')<>'S' AND NOT (
              COALESCE(d.descricao,'') ILIKE '%custo%' OR COALESCE(cat.codigo,'') LIKE '2.01%'
            )),0)::float AS despesas,
            0::float AS resultado
     FROM fato.baixa b
     JOIN fato.titulo t ON t.app_key=b.app_key AND t.codigo_titulo_omie=b.codigo_titulo_omie
     LEFT JOIN dim.categoria cat ON cat.app_key=t.app_key AND cat.codigo=t.codigo_categoria
     LEFT JOIN dim.dre d ON d.app_key=t.app_key AND d.codigo_dre=cat.codigo_dre
     WHERE b.data_baixa BETWEEN ${fromP}::date AND ${toP}::date
       ${dimSql(b, filter, tituloCols())}
     GROUP BY 1
     ORDER BY 1`,
    b.values
  ).then((rows) =>
    rows.map((row) => ({
      ...row,
      resultado: n(row.receita) - n(row.custos) - n(row.despesas),
    }))
  );
}

export async function getDreLinhas(from: string, to: string, filter?: DimFilter) {
  const b = new Binder();
  const fromP = b.add(from);
  const toP = b.add(to);
  return query<{ codigo: string; descricao: string; nivel: number; sinal: string | null; valor: number }>(
    `SELECT COALESCE(d.codigo_dre, cat.codigo, '(sem DRE)') AS codigo,
            COALESCE(d.descricao, cat.descricao, '(sem vínculo DRE)') AS descricao,
            COALESCE(d.nivel, 1) AS nivel,
            d.sinal,
            COALESCE(SUM(CASE WHEN t.natureza='R' THEN b.valor_baixa ELSE -b.valor_baixa END),0)::float AS valor
     FROM fato.baixa b
     JOIN fato.titulo t ON t.app_key=b.app_key AND t.codigo_titulo_omie=b.codigo_titulo_omie
     LEFT JOIN dim.categoria cat ON cat.app_key=t.app_key AND cat.codigo=t.codigo_categoria
     LEFT JOIN dim.dre d ON d.app_key=t.app_key AND d.codigo_dre=cat.codigo_dre
     WHERE b.data_baixa BETWEEN ${fromP}::date AND ${toP}::date
       AND COALESCE(cat.transferencia,'N') <> 'S'
       ${dimSql(b, filter, tituloCols())}
     GROUP BY 1,2,3,4
     ORDER BY 1`,
    b.values
  );
}

export async function getOrcamentoMensal(year?: number, filter?: DimFilter) {
  const y = year ?? new Date().getFullYear();
  const b = new Binder();
  const yearP = b.add(y);
  return query<{ mes: number; previsto: number; realizado: number; tipo: string }>(
    `SELECT o.mes,
            COALESCE(SUM(o.valor_previsto),0)::float AS previsto,
            COALESCE(SUM(o.valor_realizado),0)::float AS realizado,
            CASE
              WHEN COALESCE(c.conta_receita,'N')='S' THEN 'receita'
              ELSE 'gasto'
            END AS tipo
     FROM fato.orcamento_caixa o
     LEFT JOIN dim.categoria c ON c.app_key=o.app_key AND c.codigo=o.codigo_categoria
     WHERE o.ano=${yearP}
       ${dimSql(b, filter, { appKey: "o.app_key", categoria: "o.codigo_categoria" })}
     GROUP BY 1, 4
     ORDER BY 1`,
    b.values
  );
}

export async function getQaClientes(from: string, to: string, filter?: DimFilter) {
  const currentB = new Binder();
  const cFrom = currentB.add(from);
  const cTo = currentB.add(to);
  const current = await query<NamedValue>(
    `SELECT COALESCE(c.razao_social,'(sem cadastro)') AS nome,
            COALESCE(SUM(b.valor_baixa),0)::float AS valor
     FROM fato.baixa b
     JOIN fato.titulo t ON t.app_key=b.app_key AND t.codigo_titulo_omie=b.codigo_titulo_omie
     LEFT JOIN dim.cliente c ON c.app_key=t.app_key AND c.codigo_cliente_omie=t.codigo_cliente_omie
     WHERE t.natureza='R' AND b.data_baixa BETWEEN ${cFrom}::date AND ${cTo}::date
       ${dimSql(currentB, filter, tituloCols())}
     GROUP BY 1
     ORDER BY valor DESC`,
    currentB.values
  );
  const prevFrom = shiftYear(from, -1);
  const prevTo = shiftYear(to, -1);
  const prevB = new Binder();
  const pFrom = prevB.add(prevFrom);
  const pTo = prevB.add(prevTo);
  const previous = await query<NamedValue>(
    `SELECT COALESCE(c.razao_social,'(sem cadastro)') AS nome,
            COALESCE(SUM(b.valor_baixa),0)::float AS valor
     FROM fato.baixa b
     JOIN fato.titulo t ON t.app_key=b.app_key AND t.codigo_titulo_omie=b.codigo_titulo_omie
     LEFT JOIN dim.cliente c ON c.app_key=t.app_key AND c.codigo_cliente_omie=t.codigo_cliente_omie
     WHERE t.natureza='R' AND b.data_baixa BETWEEN ${pFrom}::date AND ${pTo}::date
       ${dimSql(prevB, filter, tituloCols())}
     GROUP BY 1`,
    prevB.values
  );
  const prevMap = new Map(previous.map((p) => [p.nome, n(p.valor)]));
  const yoy = current
    .map((c) => {
      const before = prevMap.get(c.nome) ?? 0;
      const growth = before === 0 ? (n(c.valor) > 0 ? 100 : 0) : ((n(c.valor) - before) / before) * 100;
      return { nome: c.nome, valor: n(c.valor), growth };
    })
    .filter((x) => x.valor > 0);
  return {
    top: current.slice(0, 10),
    bottom: [...current].reverse().slice(0, 10),
    growthTop: [...yoy].sort((a, b) => b.growth - a.growth).slice(0, 10),
    growthBottom: [...yoy].sort((a, b) => a.growth - b.growth).slice(0, 10),
  };
}

function shiftYear(isoDate: string, years: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export async function getCheckPanel(from: string, to: string, filter?: DimFilter) {
  const bind = new Binder();
  const fromP = bind.add(from);
  const toP = bind.add(to);
  const extra = dimSql(bind, filter, tituloCols());
  const blank = await query<Record<string, unknown>>(
    `SELECT
       COUNT(*) FILTER (WHERE t.codigo_cliente_omie IS NULL)::int AS clientes,
       COUNT(*) FILTER (WHERE t.codigo_projeto IS NULL)::int AS projetos,
       COUNT(*) FILTER (WHERE t.codigo_categoria IS NULL OR t.codigo_categoria='')::int AS categorias,
       COUNT(*) FILTER (WHERE t.codigo_departamento IS NULL OR t.codigo_departamento='')::int AS departamentos,
       COUNT(*) FILTER (WHERE t.numero_documento_fiscal IS NULL OR t.numero_documento_fiscal='')::int AS nfs,
       COUNT(*) FILTER (WHERE t.data_emissao IS NULL)::int AS sem_emissao
     FROM fato.titulo t
     WHERE COALESCE(t.data_vencimento, t.data_emissao, CURRENT_DATE) BETWEEN ${fromP}::date AND ${toP}::date
       ${extra}`,
    bind.values
  );
  const dreB = new Binder();
  const dre = await query<Record<string, unknown>>(
    `SELECT COUNT(*)::int AS qtd
     FROM dim.categoria c
     WHERE (c.codigo_dre IS NULL OR c.codigo_dre='')
       AND COALESCE(c.conta_inativa,'N')<>'S'
       ${dimSql(dreB, filter, { appKey: "c.app_key" })}`,
    dreB.values
  );
  const rateioB = new Binder();
  const rateio = await query<Record<string, unknown>>(
    `SELECT COUNT(*)::int AS qtd FROM (
        SELECT r.app_key, r.codigo_titulo_omie
        FROM fato.titulo_rateio_categoria r
        WHERE TRUE ${dimSql(rateioB, filter, { appKey: "r.app_key" })}
        GROUP BY 1,2
        HAVING ABS(SUM(r.percentual)-100) > 0.5
     ) x`,
    rateioB.values
  );
  const b = blank[0] ?? {};
  const items: CheckItem[] = [
    { id: "clientes", label: "1.1 Clientes", count: n(b.clientes), tone: n(b.clientes) ? "warn" : "ok" },
    { id: "projetos", label: "1.2 Projetos", count: n(b.projetos), tone: n(b.projetos) ? "warn" : "ok" },
    { id: "categorias", label: "1.3 Categorias", count: n(b.categorias), tone: n(b.categorias) ? "warn" : "ok" },
    { id: "departamentos", label: "1.4 Departamentos", count: n(b.departamentos), tone: n(b.departamentos) ? "warn" : "ok" },
    { id: "nfs", label: "1.5 Notas Fiscais", count: n(b.nfs), tone: n(b.nfs) ? "warn" : "ok" },
    { id: "dre", label: "3.1 Categorias sem vínculo DRE", count: n(dre[0]?.qtd), tone: n(dre[0]?.qtd) ? "warn" : "ok" },
    { id: "emissao", label: "3.2 Contas sem data de emissão", count: n(b.sem_emissao), tone: n(b.sem_emissao) ? "warn" : "ok" },
    { id: "rateio", label: "5. Rateio ≠ 100%", count: n(rateio[0]?.qtd), tone: n(rateio[0]?.qtd) ? "warn" : "ok" },
  ];
  return items;
}

export async function getBlankDocs(
  from: string,
  to: string,
  field: "projetos" | "clientes" | "categorias" | "departamentos" | "nfs",
  filter?: DimFilter
) {
  const where =
    field === "projetos"
      ? "t.codigo_projeto IS NULL"
      : field === "clientes"
        ? "t.codigo_cliente_omie IS NULL"
        : field === "categorias"
          ? "t.codigo_categoria IS NULL OR t.codigo_categoria=''"
          : field === "departamentos"
            ? "t.codigo_departamento IS NULL OR t.codigo_departamento=''"
            : "t.numero_documento_fiscal IS NULL OR t.numero_documento_fiscal=''";
  const b = new Binder();
  const fromP = b.add(from);
  const toP = b.add(to);
  const extra = dimSql(b, filter, tituloCols());
  return query<{
    cnpj: string | null;
    nf: string | null;
    numero: string | null;
    cliente: string | null;
    categoria: string | null;
    valor: number;
    obs: string | null;
  }>(
    `SELECT emp.cnpj, t.numero_documento_fiscal AS nf, t.numero_titulo AS numero,
            c.razao_social AS cliente, cat.descricao AS categoria,
            t.valor_titulo::float AS valor, LEFT(t.observacao, 80) AS obs
     FROM fato.titulo t
     LEFT JOIN dim.empresa emp ON emp.app_key=t.app_key
     LEFT JOIN dim.cliente c ON c.app_key=t.app_key AND c.codigo_cliente_omie=t.codigo_cliente_omie
     LEFT JOIN dim.categoria cat ON cat.app_key=t.app_key AND cat.codigo=t.codigo_categoria
     WHERE ${where}
       AND COALESCE(t.data_vencimento, t.data_emissao, CURRENT_DATE) BETWEEN ${fromP}::date AND ${toP}::date
       ${extra}
     ORDER BY t.valor_titulo DESC
     LIMIT 80`,
    b.values
  );
}

export async function getInadimplenciaMensal(filter?: DimFilter) {
  const from = yearStartISO();
  const b = new Binder();
  const fromP = b.add(from);
  return query<{ mes: string; taxa: number }>(
    `SELECT to_char(date_trunc('month', t.data_vencimento), 'YYYY-MM') AS mes,
            CASE WHEN SUM(t.valor_titulo)=0 THEN 0
                 ELSE SUM(t.valor_aberto) FILTER (WHERE t.status='ATRASADO') / NULLIF(SUM(t.valor_titulo),0)
            END::float AS taxa
     FROM fato.titulo t
     WHERE t.natureza='R' AND t.data_vencimento >= ${fromP}::date
       ${dimSql(b, filter, tituloCols())}
     GROUP BY 1
     ORDER BY 1`,
    b.values
  );
}

export async function getEntradasSaidas(from: string, to: string, filter?: DimFilter) {
  async function slice(natureza: "R" | "P", by: "cat" | "cli") {
    const b = new Binder();
    const fromP = b.add(from);
    const toP = b.add(to);
    const name =
      by === "cat"
        ? `COALESCE(cat.descricao, t.codigo_categoria, '(sem)')`
        : `COALESCE(c.razao_social,'(sem cadastro)')`;
    return query<NamedValue>(
      `SELECT ${name} AS nome,
              COALESCE(SUM(bx.valor_baixa),0)::float AS valor
       FROM fato.baixa bx
       JOIN fato.titulo t ON t.app_key=bx.app_key AND t.codigo_titulo_omie=bx.codigo_titulo_omie
       LEFT JOIN dim.categoria cat ON cat.app_key=t.app_key AND cat.codigo=t.codigo_categoria
       LEFT JOIN dim.cliente c ON c.app_key=t.app_key AND c.codigo_cliente_omie=t.codigo_cliente_omie
       WHERE t.natureza='${natureza}' AND bx.data_baixa BETWEEN ${fromP}::date AND ${toP}::date
         ${dimSql(b, filter, tituloCols())}
       GROUP BY 1 ORDER BY valor DESC LIMIT 10`,
      b.values
    );
  }
  const [recCat, recCli, pagCat, pagForn] = await Promise.all([
    slice("R", "cat"),
    slice("R", "cli"),
    slice("P", "cat"),
    slice("P", "cli"),
  ]);
  return { recCat, recCli, pagCat, pagForn };
}

export async function getNfs(from: string, to: string, filter?: DimFilter) {
  const b = new Binder();
  const fromP = b.add(from);
  const toP = b.add(to);
  return query<{
    numero: string | null;
    lancamento: string | null;
    categoria: string | null;
    cliente: string | null;
    emissao: string | null;
    valor: number;
  }>(
    `SELECT t.numero_documento_fiscal AS numero, t.numero_titulo AS lancamento,
            cat.descricao AS categoria, c.razao_social AS cliente,
            t.data_emissao::text AS emissao, t.valor_titulo::float AS valor
     FROM fato.titulo t
     LEFT JOIN dim.cliente c ON c.app_key=t.app_key AND c.codigo_cliente_omie=t.codigo_cliente_omie
     LEFT JOIN dim.categoria cat ON cat.app_key=t.app_key AND cat.codigo=t.codigo_categoria
     WHERE t.numero_documento_fiscal IS NOT NULL AND t.numero_documento_fiscal <> ''
       AND COALESCE(t.data_emissao, t.data_vencimento) BETWEEN ${fromP}::date AND ${toP}::date
       ${dimSql(b, filter, tituloCols())}
     ORDER BY t.data_emissao DESC NULLS LAST
     LIMIT 80`,
    b.values
  );
}

export async function getFilterOptions(filter?: DimFilter) {
  const b1 = new Binder();
  const b2 = new Binder();
  const b3 = new Binder();
  const b4 = new Binder();
  const [categorias, contas, clientes, departamentos] = await Promise.all([
    query<{ codigo: string; descricao: string }>(
      `SELECT codigo, descricao FROM dim.categoria
       WHERE COALESCE(conta_inativa,'N')<>'S'
         ${dimSql(b1, filter, { appKey: "app_key" })}
       ORDER BY descricao LIMIT 400`,
      b1.values
    ),
    query<{ codigo: string; descricao: string }>(
      `SELECT codigo_cc_omie::text AS codigo, descricao FROM dim.conta_corrente
       WHERE COALESCE(inativa,'N')<>'S'
         ${dimSql(b2, filter, { appKey: "app_key" })}
       ORDER BY descricao`,
      b2.values
    ),
    query<{ codigo: string; descricao: string }>(
      `SELECT codigo_cliente_omie::text AS codigo, razao_social AS descricao FROM dim.cliente
       WHERE COALESCE(inativo,'N')<>'S'
         ${dimSql(b3, filter, { appKey: "app_key" })}
       ORDER BY razao_social LIMIT 400`,
      b3.values
    ),
    query<{ codigo: string; descricao: string }>(
      `SELECT codigo, descricao FROM dim.departamento
       WHERE COALESCE(inativo,'N')<>'S'
         ${dimSql(b4, filter, { appKey: "app_key" })}
       ORDER BY descricao LIMIT 200`,
      b4.values
    ),
  ]);
  return { categorias, contas, clientes, departamentos };
}
