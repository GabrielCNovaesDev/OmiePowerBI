// "Hoje" no fuso da operação. CURRENT_DATE do Postgres segue o fuso da sessão
// (UTC no Neon): a partir das 21h de Brasília ele já é o dia seguinte.
export const HOJE_SQL = `(now() AT TIME ZONE 'America/Sao_Paulo')::date`;

// Data em que o título é esperado. A Omie classifica "A vencer", "Vence hoje" e
// "Atrasado" pela previsão de recebimento/pagamento, não pelo vencimento.
export function previsaoSql(alias?: string): string {
  const p = alias ? `${alias}.` : "";
  return `COALESCE(${p}data_previsao, ${p}data_vencimento)`;
}
