import { unstable_cache } from "next/cache";
import { query } from "./db";
import { n } from "./format";
import { todayISO, yearStartISO } from "./period";
import { Binder, dimSql, type DimFilter } from "./params";
import { EXTRATO_RATEADO, TITULO_RATEADO } from "./rateio";

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
export type MonthCashCompare = MonthCash & {
  entradaAtual: number;
  saidaAtual: number;
  transfAtual: number;
  entradaPrev: number;
  saidaPrev: number;
  resultadoAtual: number;
  saldoAtualAcumulado: number | null;
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
  return getTitulosVencendo(natureza, filter, { mode: "hoje" });
}

export async function getTitulosVencendo(
  natureza: "R" | "P",
  filter?: DimFilter,
  range?: { mode: "hoje" } | { mode: "periodo"; from: string; to: string } | { mode: "atrasado" }
): Promise<TituloHoje[]> {
  const b = new Binder();
  const nat = b.add(natureza);
  const recorte = range ?? { mode: "hoje" as const };
  const dateClause =
    recorte.mode === "atrasado"
      ? `AND t.status = 'ATRASADO'`
      : recorte.mode === "periodo"
        ? `AND t.data_vencimento BETWEEN ${b.add(recorte.from)}::date AND ${b.add(recorte.to)}::date
           AND t.status ${openClause(natureza)}`
        : `AND t.data_vencimento = CURRENT_DATE
           AND t.status ${openClause(natureza)}`;
  const orderBy = recorte.mode === "atrasado" ? "vencimento ASC NULLS LAST, valor DESC" : "valor DESC";
  return query<TituloHoje>(
    `SELECT COALESCE(cat.descricao, t.codigo_categoria, '(sem categoria)') AS categoria,
            COALESCE(c.razao_social, '(sem cadastro)') AS cliente,
            t.numero_documento_fiscal AS nf,
            t.data_vencimento::text AS vencimento,
            COUNT(DISTINCT t.codigo_titulo_omie)::int AS qtd,
            COALESCE(SUM(t.valor_aberto),0)::float AS valor
     FROM ${TITULO_RATEADO} t
     LEFT JOIN dim.cliente c ON c.app_key=t.app_key AND c.codigo_cliente_omie=t.codigo_cliente_omie
     LEFT JOIN dim.categoria cat ON cat.app_key=t.app_key AND cat.codigo=t.codigo_categoria
     WHERE t.natureza=${nat}
       AND t.valor_aberto > 0
       ${dateClause}
       ${dimSql(b, filter, tituloCols())}
     GROUP BY 1,2,3,4
     ORDER BY ${orderBy}
     LIMIT 40`,
    b.values
  );
}

export async function getKpisDia(filter?: DimFilter) {
  return getKpisPeriodo("hoje", "hoje", filter);
}

export async function getKpisPeriodo(from: string, to: string, filter?: DimFilter) {
  const b = new Binder();
  const singleDay = from === "hoje" && to === "hoje";
  const fromP = singleDay ? null : b.add(from);
  const toP = singleDay ? null : b.add(to);
  const vencR = singleDay
    ? `natureza='R' AND status ${OPEN_R} AND data_vencimento = CURRENT_DATE AND valor_aberto > 0`
    : `natureza='R' AND status ${OPEN_R} AND data_vencimento BETWEEN ${fromP}::date AND ${toP}::date AND valor_aberto > 0`;
  const vencP = singleDay
    ? `natureza='P' AND status ${OPEN_P} AND data_vencimento = CURRENT_DATE AND valor_aberto > 0`
    : `natureza='P' AND status ${OPEN_P} AND data_vencimento BETWEEN ${fromP}::date AND ${toP}::date AND valor_aberto > 0`;
  const rows = await query<Record<string, unknown>>(`
    SELECT
      COALESCE(SUM(valor_aberto) FILTER (WHERE ${vencR}),0)::float AS receber_hoje,
      COALESCE(SUM(valor_aberto) FILTER (WHERE ${vencP}),0)::float AS pagar_hoje,
      COALESCE(SUM(valor_aberto) FILTER (WHERE natureza='R' AND status='ATRASADO'),0)::float AS receber_atraso,
      COALESCE(SUM(valor_aberto) FILTER (WHERE natureza='P' AND status='ATRASADO'),0)::float AS pagar_atraso,
      COUNT(DISTINCT t.codigo_titulo_omie) FILTER (WHERE ${vencR})::int AS qtd_receber,
      COUNT(DISTINCT t.codigo_titulo_omie) FILTER (WHERE ${vencP})::int AS qtd_pagar,
      COUNT(DISTINCT t.codigo_titulo_omie) FILTER (WHERE natureza='R' AND status='ATRASADO')::int AS qtd_receber_atraso,
      COUNT(DISTINCT t.codigo_titulo_omie) FILTER (WHERE natureza='P' AND status='ATRASADO')::int AS qtd_pagar_atraso
    FROM ${TITULO_RATEADO} t
    WHERE 1=1 ${dimSql(b, filter, tituloCols())}
      AND (
        t.status = 'ATRASADO'
        OR (
          t.valor_aberto > 0
          AND ((${vencR}) OR (${vencP}))
        )
      )
  `, b.values);
  const r = rows[0] ?? {};
  return {
    receberHoje: n(r.receber_hoje),
    pagarHoje: n(r.pagar_hoje),
    receberAtraso: n(r.receber_atraso),
    pagarAtraso: n(r.pagar_atraso),
    qtdReceber: n(r.qtd_receber),
    qtdPagar: n(r.qtd_pagar),
    qtdReceberAtraso: n(r.qtd_receber_atraso),
    qtdPagarAtraso: n(r.qtd_pagar_atraso),
  };
}

/** saldo inicial + a receber + vencidos a receber − a pagar − a pagar atrasados */
export function saldoPrevistoHoje(
  saldoInicial: number,
  kpis: Pick<Awaited<ReturnType<typeof getKpisDia>>, "receberHoje" | "receberAtraso" | "pagarHoje" | "pagarAtraso">
) {
  return saldoInicial + kpis.receberHoje + kpis.receberAtraso - kpis.pagarHoje - kpis.pagarAtraso;
}

function monthKeys(from: string, to: string): string[] {
  const keys: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const ey = Number(to.slice(0, 4));
  const em = Number(to.slice(5, 7));
  if (!y || !m || !ey || !em) return keys;
  while (y < ey || (y === ey && m <= em)) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys.length > 24 ? keys.slice(-24) : keys;
}

function rollMonthCash(
  opening: number,
  rows: Array<{ mes: string; entrada: number; saida: number; transf: number }>
): MonthCash[] {
  let acc = opening;
  return rows.map((m) => {
    const saldoInicial = acc;
    const resultado = m.entrada + m.transf - m.saida;
    acc = saldoInicial + resultado;
    return {
      mes: m.mes,
      label: monthLabel(m.mes),
      entrada: m.entrada,
      saida: m.saida,
      transf: m.transf,
      saldoInicial,
      resultado,
      saldoAcumulado: acc,
    };
  });
}

async function getSaldoAbertura(from: string, filter?: DimFilter): Promise<number> {
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
  return n(openingRows[0]?.saldo);
}

const PREVISTO_DATA_SQL = `CASE WHEN t.data_vencimento < CURRENT_DATE THEN CURRENT_DATE ELSE t.data_vencimento END`;

async function queryPrevistoMensal(from: string, to: string, filter?: DimFilter) {
  const b = new Binder();
  const fromP = b.add(from);
  const toP = b.add(to);
  return query<{ mes: string; entrada: number; saida: number }>(
    `SELECT to_char(date_trunc('month', ${PREVISTO_DATA_SQL}), 'YYYY-MM') AS mes,
            COALESCE(SUM(t.valor_aberto) FILTER (WHERE t.natureza='R'),0)::float AS entrada,
            COALESCE(SUM(t.valor_aberto) FILTER (WHERE t.natureza='P'),0)::float AS saida
     FROM ${TITULO_RATEADO} t
     WHERE t.valor_aberto > 0
       AND t.status::text NOT IN ('CANCELADO','PAGO','RECEBIDO','LIQUIDADO')
       AND ((t.natureza='R' AND t.status ${OPEN_R}) OR (t.natureza='P' AND t.status ${OPEN_P}))
       AND ${PREVISTO_DATA_SQL} BETWEEN ${fromP}::date AND ${toP}::date
       ${dimSql(b, filter, tituloCols())}
     GROUP BY 1
     ORDER BY 1`,
    b.values
  );
}

async function queryFluxoMensalAtual(from: string, to: string, filter?: DimFilter) {
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
     FROM ${EXTRATO_RATEADO} e
     LEFT JOIN dim.categoria c ON c.app_key=e.app_key AND c.codigo=e.codigo_categoria
     WHERE e.data_lancamento BETWEEN ${fromP}::date AND ${toP}::date
       AND COALESCE(e.codigo_lancamento,0) <> 0
       ${extratoDims}
     GROUP BY 1
     ORDER BY 1`,
    b.values
  );

  if (months.length) return months;
  const fb = new Binder();
  const f1 = fb.add(from);
  const f2 = fb.add(to);
  return query<Record<string, unknown>>(
    `SELECT to_char(date_trunc('month', b.data_baixa), 'YYYY-MM') AS mes,
            COALESCE(SUM(b.valor_baixa * t.fator) FILTER (WHERE t.natureza='R'),0)::float AS entrada,
            COALESCE(SUM(b.valor_baixa * t.fator) FILTER (WHERE t.natureza='P'),0)::float AS saida,
            0::float AS transf
     FROM fato.baixa b
     JOIN ${TITULO_RATEADO} t ON t.app_key=b.app_key AND t.codigo_titulo_omie=b.codigo_titulo_omie
     WHERE b.data_baixa BETWEEN ${f1}::date AND ${f2}::date
       ${dimSql(fb, filter, tituloCols())}
     GROUP BY 1
     ORDER BY 1`,
    fb.values
  );
}

export async function getFluxoMensalCaixa(from: string, to: string, filter?: DimFilter): Promise<MonthCash[]> {
  const [opening, used] = await Promise.all([getSaldoAbertura(from, filter), queryFluxoMensalAtual(from, to, filter)]);
  let acc = opening;
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

export async function getFluxoMensalPrevisto(from: string, to: string, filter?: DimFilter): Promise<MonthCash[]> {
  const keys = monthKeys(from, to);
  const rangeFrom = keys[0] ? `${keys[0]}-01` : from;
  const [saldo, raw] = await Promise.all([getSaldoAtual(filter), queryPrevistoMensal(rangeFrom, to, filter)]);
  const by = new Map(raw.map((r) => [r.mes, r]));
  return rollMonthCash(
    saldo.saldo,
    keys.map((mes) => ({
      mes,
      entrada: n(by.get(mes)?.entrada),
      saida: n(by.get(mes)?.saida),
      transf: 0,
    }))
  );
}

export async function getFluxoMensalAtualPrevisto(from: string, to: string, filter?: DimFilter): Promise<MonthCashCompare[]> {
  const todayYm = todayISO().slice(0, 7);
  const keys = monthKeys(from, to);
  const rangeFrom = keys[0] ? `${keys[0]}-01` : from;
  const [opening, atualRows, prevRaw] = await Promise.all([
    getSaldoAbertura(rangeFrom, filter),
    queryFluxoMensalAtual(rangeFrom, to, filter),
    queryPrevistoMensal(rangeFrom, to, filter),
  ]);
  const atual = rollMonthCash(
    opening,
    atualRows.map((m) => ({
      mes: String(m.mes),
      entrada: n(m.entrada),
      saida: n(m.saida),
      transf: n(m.transf),
    }))
  );
  const atualMap = new Map(atual.map((m) => [m.mes, m]));
  const prevMap = new Map(prevRaw.map((r) => [r.mes, r]));
  let accH = opening;
  let accA = opening;
  return keys.map((mes) => {
    const a = atualMap.get(mes);
    const entradaAtual = a?.entrada ?? 0;
    const saidaAtual = a?.saida ?? 0;
    const transfAtual = a?.transf ?? 0;
    const entradaPrev = n(prevMap.get(mes)?.entrada);
    const saidaPrev = n(prevMap.get(mes)?.saida);
    const entrada = entradaAtual + entradaPrev;
    const saida = saidaAtual + saidaPrev;
    const saldoInicial = accH;
    const resultadoAtual = entradaAtual + transfAtual - saidaAtual;
    const resultado = entrada + transfAtual - saida;
    accH = saldoInicial + resultado;
    if (mes <= todayYm) accA += resultadoAtual;
    return {
      mes,
      label: monthLabel(mes),
      entrada,
      saida,
      transf: transfAtual,
      saldoInicial,
      resultado,
      saldoAcumulado: accH,
      entradaAtual,
      saidaAtual,
      transfAtual,
      entradaPrev,
      saidaPrev,
      resultadoAtual,
      saldoAtualAcumulado: mes <= todayYm ? accA : null,
    };
  });
}

export type FluxoDrillLevel = "grupo" | "subgrupo" | "categoria" | "fornecedor";
export type FluxoDrillNode = {
  key: string;
  id: string;
  nome: string;
  level: FluxoDrillLevel;
  entrada: number;
  saida: number;
  byMonth: Record<string, { entrada: number; saida: number }>;
  children: FluxoDrillNode[];
};

type FluxoDrillFact = {
  grupoId: string;
  grupoNome: string;
  subgrupoId: string;
  subgrupoNome: string;
  catId: string;
  catNome: string;
  fornId: string;
  fornNome: string;
  mes: string;
  entrada: number;
  saida: number;
};

const CAT_HIER_SQL = `
WITH RECURSIVE tree AS (
  SELECT c.app_key, c.codigo AS cat_codigo, c.descricao AS cat_nome,
         c.codigo AS walk, c.descricao AS walk_nome, c.categoria_superior, 0 AS dist
  FROM dim.categoria c
  UNION ALL
  SELECT t.app_key, t.cat_codigo, t.cat_nome,
         p.codigo, p.descricao, p.categoria_superior, t.dist + 1
  FROM tree t
  JOIN dim.categoria p ON p.app_key = t.app_key AND p.codigo = t.categoria_superior
  WHERE t.dist < 8
),
hier AS (
  SELECT app_key, cat_codigo,
         MAX(cat_nome) AS cat_nome,
         (ARRAY_AGG(walk ORDER BY dist DESC))[1] AS grupo_codigo,
         (ARRAY_AGG(walk_nome ORDER BY dist DESC))[1] AS grupo_nome,
         COALESCE((ARRAY_AGG(walk ORDER BY dist DESC))[2], MAX(cat_codigo)) AS subgrupo_codigo,
         COALESCE((ARRAY_AGG(walk_nome ORDER BY dist DESC))[2], MAX(cat_nome)) AS subgrupo_nome
  FROM tree
  GROUP BY app_key, cat_codigo
)`;

function fluxoPrefixGrupo(col: string) {
  return `CASE
    WHEN COALESCE(${col},'') = '' THEN '(sem grupo)'
    WHEN array_length(string_to_array(${col}, '.'), 1) >= 2
      THEN split_part(${col}, '.', 1) || '.' || split_part(${col}, '.', 2)
    ELSE ${col}
  END`;
}

function fluxoPrefixSubgrupo(col: string) {
  return `CASE
    WHEN COALESCE(${col},'') = '' THEN '(sem sub-grupo)'
    WHEN array_length(string_to_array(${col}, '.'), 1) >= 3
      THEN split_part(${col}, '.', 1) || '.' || split_part(${col}, '.', 2) || '.' || split_part(${col}, '.', 3)
    ELSE ${col}
  END`;
}

const DRILL_GRAIN_SELECT = `SELECT to_char(date_trunc('month', x.data_ref), 'YYYY-MM') AS mes,
            x.grupo_codigo, x.grupo_nome, x.subgrupo_codigo, x.subgrupo_nome,
            x.cat_codigo, x.cat_nome, x.fornecedor_id, x.fornecedor_nome,
            COALESCE(SUM(x.entrada),0)::float AS entrada,
            COALESCE(SUM(x.saida),0)::float AS saida`;

function mapDrillFacts(rows: Record<string, unknown>[]): FluxoDrillFact[] {
  return rows.map((r) => ({
    grupoId: String(r.grupo_codigo ?? "(sem grupo)"),
    grupoNome: String(r.grupo_nome || r.grupo_codigo || "(sem grupo)"),
    subgrupoId: String(r.subgrupo_codigo ?? "(sem sub-grupo)"),
    subgrupoNome: String(r.subgrupo_nome || r.subgrupo_codigo || "(sem sub-grupo)"),
    catId: String(r.cat_codigo ?? "(sem categoria)"),
    catNome: String(r.cat_nome || r.cat_codigo || "(sem categoria)"),
    fornId: String(r.fornecedor_id ?? "sem"),
    fornNome: String(r.fornecedor_nome || "(sem fornecedor)"),
    mes: String(r.mes),
    entrada: n(r.entrada),
    saida: n(r.saida),
  }));
}

async function getFluxoDrillFacts(
  from: string,
  to: string,
  filter: DimFilter | undefined,
  fonte: "atual" | "previsto"
): Promise<FluxoDrillFact[]> {
  if (fonte === "previsto") {
    const b = new Binder();
    const fromP = b.add(from);
    const toP = b.add(to);
    const tg = fluxoPrefixGrupo("t.codigo_categoria");
    const tsg = fluxoPrefixSubgrupo("t.codigo_categoria");
    const rows = await query<Record<string, unknown>>(
      `${CAT_HIER_SQL}
       ${DRILL_GRAIN_SELECT}
       FROM (
         SELECT ${PREVISTO_DATA_SQL} AS data_ref,
                COALESCE(h.grupo_codigo, ${tg}) AS grupo_codigo,
                COALESCE(h.grupo_nome, NULLIF(g.descricao, ''), ${tg}) AS grupo_nome,
                COALESCE(h.subgrupo_codigo, ${tsg}) AS subgrupo_codigo,
                COALESCE(h.subgrupo_nome, NULLIF(sg.descricao, ''), ${tsg}) AS subgrupo_nome,
                COALESCE(h.cat_codigo, NULLIF(t.codigo_categoria, ''), '(sem categoria)') AS cat_codigo,
                COALESCE(h.cat_nome, NULLIF(cat.descricao, ''), NULLIF(t.codigo_categoria, ''), '(sem categoria)') AS cat_nome,
                COALESCE(t.codigo_cliente_omie::text, 'sem') AS fornecedor_id,
                COALESCE(cli.razao_social, '(sem fornecedor)') AS fornecedor_nome,
                CASE WHEN t.natureza='R' THEN t.valor_aberto ELSE 0 END AS entrada,
                CASE WHEN t.natureza='P' THEN t.valor_aberto ELSE 0 END AS saida
         FROM ${TITULO_RATEADO} t
         LEFT JOIN dim.categoria cat ON cat.app_key=t.app_key AND cat.codigo=t.codigo_categoria
         LEFT JOIN hier h ON h.app_key=t.app_key AND h.cat_codigo=t.codigo_categoria
         LEFT JOIN dim.categoria g ON g.app_key=t.app_key AND g.codigo=${tg}
         LEFT JOIN dim.categoria sg ON sg.app_key=t.app_key AND sg.codigo=${tsg}
         LEFT JOIN dim.cliente cli ON cli.app_key=t.app_key AND cli.codigo_cliente_omie=t.codigo_cliente_omie
         WHERE t.valor_aberto > 0
           AND t.status::text NOT IN ('CANCELADO','PAGO','RECEBIDO','LIQUIDADO')
           AND ((t.natureza='R' AND t.status ${OPEN_R}) OR (t.natureza='P' AND t.status ${OPEN_P}))
           AND ${PREVISTO_DATA_SQL} BETWEEN ${fromP}::date AND ${toP}::date
           ${dimSql(b, filter, tituloCols())}
       ) x
       GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9`,
      b.values
    );
    return mapDrillFacts(rows);
  }

  const b = new Binder();
  const fromP = b.add(from);
  const toP = b.add(to);
  const gExpr = fluxoPrefixGrupo("e.codigo_categoria");
  const sgExpr = fluxoPrefixSubgrupo("e.codigo_categoria");
  const extratoDims = dimSql(b, filter, {
    appKey: "e.app_key",
    cliente: "e.codigo_cliente_omie",
    categoria: "e.codigo_categoria",
    conta: "e.codigo_cc_omie",
  });
  let rows = await query<Record<string, unknown>>(
    `${CAT_HIER_SQL}
     ${DRILL_GRAIN_SELECT}
     FROM (
       SELECT e.data_lancamento AS data_ref,
              COALESCE(h.grupo_codigo, ${gExpr}) AS grupo_codigo,
              COALESCE(h.grupo_nome, NULLIF(g.descricao, ''), ${gExpr}) AS grupo_nome,
              COALESCE(h.subgrupo_codigo, ${sgExpr}) AS subgrupo_codigo,
              COALESCE(h.subgrupo_nome, NULLIF(sg.descricao, ''), ${sgExpr}) AS subgrupo_nome,
              COALESCE(h.cat_codigo, NULLIF(e.codigo_categoria, ''), '(sem categoria)') AS cat_codigo,
              COALESCE(h.cat_nome, NULLIF(e.descricao_categoria, ''), NULLIF(e.codigo_categoria, ''), '(sem categoria)') AS cat_nome,
              COALESCE(e.codigo_cliente_omie::text, 'sem') AS fornecedor_id,
              COALESCE(cli.razao_social, e.razao_social_cliente, e.nome_cliente, '(sem fornecedor)') AS fornecedor_nome,
              CASE WHEN e.natureza='E' THEN ABS(e.valor_documento) ELSE 0 END AS entrada,
              CASE WHEN e.natureza='S' THEN ABS(e.valor_documento) ELSE 0 END AS saida
       FROM ${EXTRATO_RATEADO} e
       LEFT JOIN dim.categoria c ON c.app_key=e.app_key AND c.codigo=e.codigo_categoria
       LEFT JOIN hier h ON h.app_key=e.app_key AND h.cat_codigo=e.codigo_categoria
       LEFT JOIN dim.categoria g ON g.app_key=e.app_key AND g.codigo=${gExpr}
       LEFT JOIN dim.categoria sg ON sg.app_key=e.app_key AND sg.codigo=${sgExpr}
       LEFT JOIN dim.cliente cli ON cli.app_key=e.app_key AND cli.codigo_cliente_omie=e.codigo_cliente_omie
       WHERE e.data_lancamento BETWEEN ${fromP}::date AND ${toP}::date
         AND COALESCE(e.codigo_lancamento,0) <> 0
         AND COALESCE(c.transferencia,'N') <> 'S'
         ${extratoDims}
     ) x
     GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9`,
    b.values
  );

  if (!rows.length) {
    const fb = new Binder();
    const f1 = fb.add(from);
    const f2 = fb.add(to);
    const tg = fluxoPrefixGrupo("t.codigo_categoria");
    const tsg = fluxoPrefixSubgrupo("t.codigo_categoria");
    rows = await query<Record<string, unknown>>(
      `${CAT_HIER_SQL}
       ${DRILL_GRAIN_SELECT}
       FROM (
         SELECT b.data_baixa AS data_ref,
                COALESCE(h.grupo_codigo, ${tg}) AS grupo_codigo,
                COALESCE(h.grupo_nome, NULLIF(g.descricao, ''), ${tg}) AS grupo_nome,
                COALESCE(h.subgrupo_codigo, ${tsg}) AS subgrupo_codigo,
                COALESCE(h.subgrupo_nome, NULLIF(sg.descricao, ''), ${tsg}) AS subgrupo_nome,
                COALESCE(h.cat_codigo, NULLIF(t.codigo_categoria, ''), '(sem categoria)') AS cat_codigo,
                COALESCE(h.cat_nome, NULLIF(cat.descricao, ''), NULLIF(t.codigo_categoria, ''), '(sem categoria)') AS cat_nome,
                COALESCE(t.codigo_cliente_omie::text, 'sem') AS fornecedor_id,
                COALESCE(cli.razao_social, '(sem fornecedor)') AS fornecedor_nome,
                CASE WHEN t.natureza='R' THEN b.valor_baixa * t.fator ELSE 0 END AS entrada,
                CASE WHEN t.natureza='P' THEN b.valor_baixa * t.fator ELSE 0 END AS saida
         FROM fato.baixa b
         JOIN ${TITULO_RATEADO} t ON t.app_key=b.app_key AND t.codigo_titulo_omie=b.codigo_titulo_omie
         LEFT JOIN dim.categoria cat ON cat.app_key=t.app_key AND cat.codigo=t.codigo_categoria
         LEFT JOIN hier h ON h.app_key=t.app_key AND h.cat_codigo=t.codigo_categoria
         LEFT JOIN dim.categoria g ON g.app_key=t.app_key AND g.codigo=${tg}
         LEFT JOIN dim.categoria sg ON sg.app_key=t.app_key AND sg.codigo=${tsg}
         LEFT JOIN dim.cliente cli ON cli.app_key=t.app_key AND cli.codigo_cliente_omie=t.codigo_cliente_omie
         WHERE b.data_baixa BETWEEN ${f1}::date AND ${f2}::date
           ${dimSql(fb, filter, tituloCols())}
       ) x
       GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9`,
      fb.values
    );
  }
  return mapDrillFacts(rows);
}

function emptyDrillNode(key: string, id: string, nome: string, level: FluxoDrillLevel): FluxoDrillNode {
  return { key, id, nome, level, entrada: 0, saida: 0, byMonth: {}, children: [] };
}

function addDrillMonth(node: FluxoDrillNode, mes: string, entrada: number, saida: number) {
  node.entrada += entrada;
  node.saida += saida;
  const cell = node.byMonth[mes] ?? { entrada: 0, saida: 0 };
  cell.entrada += entrada;
  cell.saida += saida;
  node.byMonth[mes] = cell;
}

function sortDrillNodes(nodes: FluxoDrillNode[]) {
  nodes.sort((a, b) => Math.abs(b.entrada - b.saida) - Math.abs(a.entrada - a.saida));
  for (const node of nodes) sortDrillNodes(node.children);
}

function childOf(parent: FluxoDrillNode, id: string, nome: string, level: FluxoDrillLevel, maps: Map<string, FluxoDrillNode>) {
  const key = `${parent.key}/${level}:${id}`;
  let node = maps.get(key);
  if (!node) {
    node = emptyDrillNode(key, id, nome, level);
    maps.set(key, node);
    parent.children.push(node);
  } else if (node.nome === id && nome !== id) {
    node.nome = nome;
  }
  return node;
}

export function buildFluxoDrillTree(facts: FluxoDrillFact[]): FluxoDrillNode[] {
  const roots: FluxoDrillNode[] = [];
  const maps = new Map<string, FluxoDrillNode>();
  for (const fact of facts) {
    const gKey = `grupo:${fact.grupoId}`;
    let grupo = maps.get(gKey);
    if (!grupo) {
      grupo = emptyDrillNode(gKey, fact.grupoId, fact.grupoNome, "grupo");
      maps.set(gKey, grupo);
      roots.push(grupo);
    } else if (grupo.nome === fact.grupoId && fact.grupoNome !== fact.grupoId) {
      grupo.nome = fact.grupoNome;
    }
    addDrillMonth(grupo, fact.mes, fact.entrada, fact.saida);

    let parent = grupo;
    if (fact.subgrupoId !== fact.grupoId) {
      parent = childOf(parent, fact.subgrupoId, fact.subgrupoNome, "subgrupo", maps);
      addDrillMonth(parent, fact.mes, fact.entrada, fact.saida);
    }
    if (fact.catId !== parent.id) {
      parent = childOf(parent, fact.catId, fact.catNome, "categoria", maps);
      addDrillMonth(parent, fact.mes, fact.entrada, fact.saida);
    }
    const fornecedor = childOf(parent, fact.fornId, fact.fornNome, "fornecedor", maps);
    addDrillMonth(fornecedor, fact.mes, fact.entrada, fact.saida);
  }
  sortDrillNodes(roots);
  return roots;
}

export async function getFluxoDrilldown(
  from: string,
  to: string,
  filter: DimFilter | undefined,
  fonte: "atual" | "previsto" = "atual"
): Promise<FluxoDrillNode[]> {
  return buildFluxoDrillTree(await getFluxoDrillFacts(from, to, filter, fonte));
}

export async function getFluxoDrilldownHibrido(
  from: string,
  to: string,
  filter: DimFilter | undefined,
  currentYm: string
): Promise<FluxoDrillNode[]> {
  const [atual, previsto] = await Promise.all([
    getFluxoDrillFacts(from, to, filter, "atual"),
    getFluxoDrillFacts(from, to, filter, "previsto"),
  ]);
  const map = new Map<string, FluxoDrillFact>();
  const ingest = (facts: FluxoDrillFact[], keep: (mes: string) => boolean) => {
    for (const fact of facts) {
      if (!keep(fact.mes)) continue;
      const key = [fact.grupoId, fact.subgrupoId, fact.catId, fact.fornId, fact.mes].join("|");
      const prev = map.get(key);
      if (!prev) map.set(key, { ...fact });
      else {
        prev.entrada += fact.entrada;
        prev.saida += fact.saida;
      }
    }
  };
  ingest(atual, (mes) => mes <= currentYm);
  ingest(previsto, (mes) => mes >= currentYm);
  return buildFluxoDrillTree([...map.values()]);
}

export async function getFluxoDiarioMes(from: string, to: string, filter?: DimFilter): Promise<DailyPoint[]> {
  const a = new Binder();
  const aFrom = a.add(from);
  const aTo = a.add(to);
  const p = new Binder();
  const pFrom = p.add(from);
  const pTo = p.add(to);
  const [actual, prev, opening] = await Promise.all([
    query<{ dia: string; entrada: number; saida: number }>(
      `SELECT e.data_lancamento::text AS dia,
              COALESCE(SUM(ABS(e.valor_documento)) FILTER (WHERE e.natureza='E'),0)::float AS entrada,
              COALESCE(SUM(ABS(e.valor_documento)) FILTER (WHERE e.natureza='S'),0)::float AS saida
       FROM ${EXTRATO_RATEADO} e
       WHERE e.data_lancamento BETWEEN ${aFrom}::date AND ${aTo}::date
         AND COALESCE(e.codigo_lancamento,0) <> 0
         ${dimSql(a, filter, { appKey: "e.app_key", cliente: "e.codigo_cliente_omie", categoria: "e.codigo_categoria", conta: "e.codigo_cc_omie" })}
       GROUP BY 1
       ORDER BY 1`,
      a.values
    ),
    query<{ dia: string; natureza: string; valor: number }>(
      `SELECT data_vencimento::text AS dia, natureza::text, COALESCE(SUM(valor_aberto),0)::float AS valor
       FROM ${TITULO_RATEADO} t
       WHERE data_vencimento BETWEEN GREATEST(${pFrom}::date, CURRENT_DATE) AND ${pTo}::date
         AND valor_aberto > 0
         AND status::text NOT IN ('CANCELADO','PAGO','RECEBIDO','LIQUIDADO')
         ${dimSql(p, filter, tituloCols())}
       GROUP BY 1, 2`,
      p.values
    ),
    getSaldoAtual(filter),
  ]);

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
            COUNT(DISTINCT t.codigo_titulo_omie)::int AS qtd
     FROM ${TITULO_RATEADO} t
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
            COUNT(DISTINCT t.codigo_titulo_omie)::int AS qtd
     FROM ${TITULO_RATEADO} t
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
    FROM ${TITULO_RATEADO} t
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
       COALESCE(SUM(b.valor_baixa * t.fator) FILTER (WHERE t.natureza='R' AND COALESCE(cat.transferencia,'N')<>'S'),0)::float AS receita,
       COALESCE(SUM(b.valor_baixa * t.fator) FILTER (WHERE t.natureza='P' AND (
         COALESCE(d.descricao,'') ILIKE '%custo%' OR COALESCE(cat.codigo,'') LIKE '2.01%'
       )),0)::float AS custos,
       COALESCE(SUM(b.valor_baixa * t.fator) FILTER (WHERE t.natureza='P' AND COALESCE(cat.transferencia,'N')<>'S' AND NOT (
         COALESCE(d.descricao,'') ILIKE '%custo%' OR COALESCE(cat.codigo,'') LIKE '2.01%'
       )),0)::float AS despesas
     FROM fato.baixa b
     JOIN ${TITULO_RATEADO} t ON t.app_key=b.app_key AND t.codigo_titulo_omie=b.codigo_titulo_omie
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
            COALESCE(SUM(b.valor_baixa * t.fator) FILTER (WHERE t.natureza='R' AND COALESCE(cat.transferencia,'N')<>'S'),0)::float AS receita,
            COALESCE(SUM(b.valor_baixa * t.fator) FILTER (WHERE t.natureza='P' AND (
              COALESCE(d.descricao,'') ILIKE '%custo%' OR COALESCE(cat.codigo,'') LIKE '2.01%'
            )),0)::float AS custos,
            COALESCE(SUM(b.valor_baixa * t.fator) FILTER (WHERE t.natureza='P' AND COALESCE(cat.transferencia,'N')<>'S' AND NOT (
              COALESCE(d.descricao,'') ILIKE '%custo%' OR COALESCE(cat.codigo,'') LIKE '2.01%'
            )),0)::float AS despesas,
            0::float AS resultado
     FROM fato.baixa b
     JOIN ${TITULO_RATEADO} t ON t.app_key=b.app_key AND t.codigo_titulo_omie=b.codigo_titulo_omie
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
            COALESCE(SUM(CASE WHEN t.natureza='R' THEN b.valor_baixa * t.fator ELSE -b.valor_baixa * t.fator END),0)::float AS valor
     FROM fato.baixa b
     JOIN ${TITULO_RATEADO} t ON t.app_key=b.app_key AND t.codigo_titulo_omie=b.codigo_titulo_omie
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
            COALESCE(SUM(b.valor_baixa * t.fator),0)::float AS valor
     FROM fato.baixa b
     JOIN ${TITULO_RATEADO} t ON t.app_key=b.app_key AND t.codigo_titulo_omie=b.codigo_titulo_omie
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
            COALESCE(SUM(b.valor_baixa * t.fator),0)::float AS valor
     FROM fato.baixa b
     JOIN ${TITULO_RATEADO} t ON t.app_key=b.app_key AND t.codigo_titulo_omie=b.codigo_titulo_omie
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
       COUNT(DISTINCT t.codigo_titulo_omie) FILTER (WHERE t.codigo_cliente_omie IS NULL)::int AS clientes,
       COUNT(DISTINCT t.codigo_titulo_omie) FILTER (WHERE t.codigo_projeto IS NULL)::int AS projetos,
       COUNT(DISTINCT t.codigo_titulo_omie) FILTER (WHERE t.codigo_categoria IS NULL OR t.codigo_categoria='')::int AS categorias,
       COUNT(DISTINCT t.codigo_titulo_omie) FILTER (WHERE t.codigo_departamento IS NULL OR t.codigo_departamento='')::int AS departamentos,
       COUNT(DISTINCT t.codigo_titulo_omie) FILTER (WHERE t.numero_documento_fiscal IS NULL OR t.numero_documento_fiscal='')::int AS nfs,
       COUNT(DISTINCT t.codigo_titulo_omie) FILTER (WHERE t.data_emissao IS NULL)::int AS sem_emissao
     FROM ${TITULO_RATEADO} t
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
          ? `(t.codigo_categoria IS NULL OR t.codigo_categoria='')
             AND NOT EXISTS (SELECT 1 FROM fato.titulo_rateio_categoria r
                             WHERE r.app_key=t.app_key AND r.codigo_titulo_omie=t.codigo_titulo_omie)`
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
     WHERE (${where})
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
     FROM ${TITULO_RATEADO} t
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
              COALESCE(SUM(bx.valor_baixa * t.fator),0)::float AS valor
       FROM fato.baixa bx
       JOIN ${TITULO_RATEADO} t ON t.app_key=bx.app_key AND t.codigo_titulo_omie=bx.codigo_titulo_omie
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

async function loadFilterOptions(appKeys: string[]) {
  const filter = { appKeys };
  const b1 = new Binder();
  const b2 = new Binder();
  const b3 = new Binder();
  const b4 = new Binder();
  const [categorias, contas, clientes, departamentos] = await Promise.all([
    query<{ codigo: string; descricao: string }>(
      `SELECT codigo, MIN(descricao) AS descricao FROM dim.categoria
       WHERE COALESCE(conta_inativa,'N')<>'S'
         ${dimSql(b1, filter, { appKey: "app_key" })}
       GROUP BY codigo
       ORDER BY MIN(descricao) LIMIT 400`,
      b1.values
    ),
    query<{ codigo: string; descricao: string; tipo: string | null; considerada: boolean }>(
      `SELECT codigo_cc_omie::text AS codigo,
              MIN(descricao) AS descricao,
              MIN(tipo_conta_corrente) AS tipo,
              BOOL_AND(
                COALESCE(visivel_resumo,'S') = 'S'
                AND COALESCE(visivel_fluxo_caixa,'S') = 'S'
              ) AS considerada
       FROM dim.conta_corrente
       WHERE COALESCE(inativa,'N')<>'S'
         ${dimSql(b2, filter, { appKey: "app_key" })}
       GROUP BY codigo_cc_omie
       ORDER BY MIN(descricao)`,
      b2.values
    ),
    query<{ codigo: string; descricao: string }>(
      `SELECT codigo_cliente_omie::text AS codigo, MIN(razao_social) AS descricao FROM dim.cliente
       WHERE COALESCE(inativo,'N')<>'S'
         ${dimSql(b3, filter, { appKey: "app_key" })}
       GROUP BY codigo_cliente_omie
       ORDER BY MIN(razao_social) LIMIT 400`,
      b3.values
    ),
    query<{ codigo: string; descricao: string }>(
      `SELECT codigo, MIN(descricao) AS descricao FROM dim.departamento
       WHERE COALESCE(inativo,'N')<>'S'
         ${dimSql(b4, filter, { appKey: "app_key" })}
       GROUP BY codigo
       ORDER BY MIN(descricao) LIMIT 200`,
      b4.values
    ),
  ]);
  return {
    categorias,
    contas: contas.map((c) => ({ ...c, considerada: Boolean(c.considerada) })),
    clientes,
    departamentos,
  };
}

export async function getFilterOptions(filter?: DimFilter) {
  const appKeys = [...(filter?.appKeys ?? [])].sort();
  return unstable_cache(
    () => loadFilterOptions(appKeys),
    ["filter-options", appKeys.join("|")],
    { revalidate: 90, tags: ["filter-options"] }
  )();
}

export type DesvioMetodo = "iqr" | "z";
export type DesvioPonto = {
  categoria: string;
  valor: number;
  outlier: boolean;
  cliente: string;
  numero: string | null;
};
export type DesvioRow = {
  categoria: string;
  cliente: string;
  numero: string | null;
  nf: string | null;
  natureza: string;
  vencimento: string | null;
  valor: number;
  mediana: number;
  limInf: number;
  limSup: number;
  zscore: number;
  n: number;
};
export type AnaliseDesvios = {
  metodo: DesvioMetodo;
  docs: number;
  categorias: number;
  outliers: number;
  pontos: DesvioPonto[];
  rows: DesvioRow[];
};

const DESVIO_MIN_N = 8;

function quantile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo] ?? 0;
  return (sorted[lo] ?? 0) + ((sorted[hi] ?? 0) - (sorted[lo] ?? 0)) * (idx - lo);
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function sampleStd(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const varSum = values.reduce((s, v) => s + (v - avg) ** 2, 0);
  return Math.sqrt(varSum / (values.length - 1));
}

type DesvioDoc = {
  numero: string | null;
  nf: string | null;
  natureza: string;
  vencimento: string | null;
  valor: number;
  categoria: string;
  cliente: string;
};

export async function getAnaliseDesvios(
  from: string,
  to: string,
  filter?: DimFilter,
  metodo: DesvioMetodo = "iqr",
  natureza?: "R" | "P"
): Promise<AnaliseDesvios> {
  const b = new Binder();
  const fromP = b.add(from);
  const toP = b.add(to);
  const extra = dimSql(b, filter, tituloCols());
  const natClause = natureza ? `AND t.natureza = ${b.add(natureza)}` : "";
  const docs = await query<DesvioDoc>(
    `SELECT t.numero_titulo AS numero,
            t.numero_documento_fiscal AS nf,
            t.natureza::text AS natureza,
            t.data_vencimento::text AS vencimento,
            t.valor_titulo::float AS valor,
            COALESCE(cat.descricao, t.codigo_categoria, '(sem categoria)') AS categoria,
            COALESCE(c.razao_social, '(sem cadastro)') AS cliente
     FROM fato.titulo t
     LEFT JOIN dim.cliente c ON c.app_key=t.app_key AND c.codigo_cliente_omie=t.codigo_cliente_omie
     LEFT JOIN dim.categoria cat ON cat.app_key=t.app_key AND cat.codigo=t.codigo_categoria
     WHERE t.status <> 'CANCELADO'
       AND t.valor_titulo > 0
       AND COALESCE(t.data_vencimento, t.data_emissao, CURRENT_DATE) BETWEEN ${fromP}::date AND ${toP}::date
       ${natClause}
       ${extra}
     ORDER BY t.data_vencimento DESC
     LIMIT 20000`,
    b.values
  );

  const byCat = new Map<string, DesvioDoc[]>();
  for (const doc of docs) {
    const list = byCat.get(doc.categoria);
    if (list) list.push(doc);
    else byCat.set(doc.categoria, [doc]);
  }

  type CatStat = { n: number; mediana: number; limInf: number; limSup: number; media: number; desvio: number };
  const stats = new Map<string, CatStat>();
  for (const [cat, list] of byCat) {
    if (list.length < DESVIO_MIN_N) continue;
    const valores = list.map((d) => d.valor).sort((a, b) => a - b);
    const q1 = quantile(valores, 0.25);
    const q3 = quantile(valores, 0.75);
    const iqr = q3 - q1;
    const media = mean(valores);
    stats.set(cat, {
      n: list.length,
      mediana: quantile(valores, 0.5),
      limInf: q1 - 1.5 * iqr,
      limSup: q3 + 1.5 * iqr,
      media,
      desvio: sampleStd(valores, media),
    });
  }

  const scored: Array<DesvioDoc & { outlier: boolean; zscore: number; stat: CatStat }> = [];
  for (const [cat, list] of byCat) {
    const stat = stats.get(cat);
    if (!stat) continue;
    for (const doc of list) {
      const zscore = stat.desvio > 0 ? (doc.valor - stat.media) / stat.desvio : 0;
      const outlier =
        metodo === "z" ? Math.abs(zscore) >= 2.5 : doc.valor < stat.limInf || doc.valor > stat.limSup;
      scored.push({ ...doc, outlier, zscore, stat });
    }
  }

  const outliers = scored.filter((d) => d.outlier);
  const catRank = new Map<string, number>();
  for (const d of outliers) catRank.set(d.categoria, (catRank.get(d.categoria) ?? 0) + 1);
  const shownCats = [...catRank.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24)
    .map(([cat]) => cat);
  const shownSet = new Set(shownCats);
  const sampled = new Map<string, number>();
  const pontos: DesvioPonto[] = [];
  for (const d of scored) {
    if (!shownSet.has(d.categoria)) continue;
    if (!d.outlier) {
      const used = sampled.get(d.categoria) ?? 0;
      if (used >= 30) continue;
      sampled.set(d.categoria, used + 1);
    }
    pontos.push({
      categoria: d.categoria,
      valor: d.valor,
      outlier: d.outlier,
      cliente: d.cliente,
      numero: d.numero,
    });
  }

  const rows: DesvioRow[] = outliers
    .slice()
    .sort((a, b) => Math.abs(b.valor - b.stat.mediana) - Math.abs(a.valor - a.stat.mediana))
    .slice(0, 80)
    .map((d) => ({
      categoria: d.categoria,
      cliente: d.cliente,
      numero: d.numero,
      nf: d.nf,
      natureza: d.natureza,
      vencimento: d.vencimento,
      valor: d.valor,
      mediana: d.stat.mediana,
      limInf: d.stat.limInf,
      limSup: d.stat.limSup,
      zscore: d.zscore,
      n: d.stat.n,
    }));

  return {
    metodo,
    docs: scored.length,
    categorias: stats.size,
    outliers: outliers.length,
    pontos,
    rows,
  };
}
