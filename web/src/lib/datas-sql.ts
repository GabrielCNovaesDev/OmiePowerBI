// "Hoje" no fuso da operação. CURRENT_DATE do Postgres segue o fuso da sessão
// (UTC no Neon): a partir das 21h de Brasília ele já é o dia seguinte.
export const HOJE_SQL = `(now() AT TIME ZONE 'America/Sao_Paulo')::date`;

// Último dia útil antes de hoje: pula fins de semana e feriados nacionais fixos.
// Feriados móveis (Carnaval, Sexta-feira Santa, Corpus Christi) não entram.
const DIA_UTIL_ANTERIOR_SQL = `(
  SELECT MAX(g.d)::date
  FROM generate_series(${HOJE_SQL} - 7, ${HOJE_SQL} - 1, interval '1 day') AS g(d)
  WHERE EXTRACT(ISODOW FROM g.d) < 6
    AND to_char(g.d, 'MM-DD') NOT IN ('01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25')
)`;

// Data em que o título é esperado. A Omie classifica "A vencer", "Vence hoje" e
// "Atrasado" pela previsão de recebimento/pagamento, não pelo vencimento.
export function previsaoSql(alias?: string): string {
  const p = alias ? `${alias}.` : "";
  return `COALESCE(${p}data_previsao, ${p}data_vencimento)`;
}

// Boleto a receber com previsão no último dia útil: o banco só credita no dia
// útil seguinte, e a Omie mostra "A vencer (D+1)" e soma o título no "hoje" do
// Resumo. A API, porém, já devolve status ATRASADO (ex.: DI PRIMO, NF 188,
// previsão 03/11/2026, contado como hoje em 04/11).
export function boletoD1Sql(alias?: string): string {
  const p = alias ? `${alias}.` : "";
  const prev = previsaoSql(alias);
  return `(${p}natureza = 'R' AND NULLIF(${p}numero_boleto, '') IS NOT NULL
           AND ${prev} >= ${DIA_UTIL_ANTERIOR_SQL} AND ${prev} < ${HOJE_SQL})`;
}

// Atrasado como no ERP: status da Omie, menos os boletos ainda no D+1.
export function atrasadoSql(alias?: string): string {
  const p = alias ? `${alias}.` : "";
  return `(${p}status = 'ATRASADO' AND NOT ${boletoD1Sql(alias)})`;
}

// Previsão para recortes por data ("hoje", semana, mês, fluxo previsto): o
// boleto no D+1 conta como hoje.
export function previsaoEfetivaSql(alias?: string): string {
  return `(CASE WHEN ${boletoD1Sql(alias)} THEN ${HOJE_SQL} ELSE ${previsaoSql(alias)} END)`;
}
