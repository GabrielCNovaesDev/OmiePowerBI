import { unstable_cache } from "next/cache";
import { cache } from "react";
import { query } from "./db";
import { todayISO } from "./period";

// Os dados do BI só mudam quando a carga da Omie grava no banco. A "versão" é o
// fim da última etapa registrada em ops.sync_log: quando uma carga termina (ou
// avança), a versão muda e todo o cache antigo deixa de ser usado — sem webhook
// nem segredo extra. Uma consulta leve por requisição (deduplicada pelo React).
const versaoDados = cache(async (): Promise<string> => {
  try {
    const rows = await query<{ v: string }>(
      `SELECT COALESCE(MAX(finished_at), 'epoch'::timestamptz)::text AS v FROM ops.sync_log`
    );
    return rows[0]?.v ?? "0";
  } catch {
    return `sem-versao-${Date.now()}`;
  }
});

// Guarda o resultado por função + argumentos (filtros, empresas, período) +
// versão dos dados + dia de hoje em São Paulo ("Pagar hoje" vira à meia-noite).
// As empresas do usuário fazem parte dos argumentos, então o cache de uma
// empresa nunca serve outra. Validade máxima de 1 h como segurança extra.
export function cacheDados<A extends unknown[], R>(nome: string, fn: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R> => {
    const versao = await versaoDados();
    const chave = ["omie-dados", nome, versao, todayISO(), JSON.stringify(args)];
    return unstable_cache(() => fn(...args), chave, { revalidate: 3600, tags: ["omie-dados"] })();
  };
}
