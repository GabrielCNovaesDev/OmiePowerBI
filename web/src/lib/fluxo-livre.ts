import { query } from "./db";
import { n } from "./format";
import { Binder, dimSql, type DimFilter } from "./params-shared";
import { EXTRATO_RATEADO, TITULO_RATEADO } from "./rateio";
import { HOJE_SQL, previsaoSql } from "./datas-sql";
import { todayISO } from "./period";
import { cacheDados } from "./cache-dados";

// Fluxo de Caixa Livre: categorias do Omie reagrupadas pelo de/para da empresa
// (ops.categoria_fluxo) em Operação → Dívida → Investimento → Distribuição.
//
// Realizado = extrato realizado (como o Fluxo de Caixa do Omie), com rateio.
// A realizar = títulos em aberto pela data de previsão; os já vencidos ficam na
//              coluna "Vencido".
// Projetado = realizado + a realizar. Saldos encadeados mês a mês a partir do
//             saldo real das contas no início do ano.
// Contas: padrão "Consideradas" (Resumo e Fluxo de Caixa), como no Omie.

export type FclValor = { real: number | null; prev: number | null };
export type FclColuna = { id: string; rotulo: string; tipo: "venc" | "mes" | "ano"; fechado?: boolean; atual?: boolean };
export type FclLinha = {
  id: string;
  rotulo: string;
  nivel: number;
  tipo: "saldo" | "grupo" | "total" | "subgrupo" | "conta";
  pai?: string;
  valores: Record<string, FclValor>;
};
export type FluxoLivre = {
  ano: number;
  colunas: FclColuna[];
  linhas: FclLinha[];
  semDepara: boolean;
  naoClassificadas: string[];
};

const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

type Bloco = "receb" | "pag" | "divida" | "invest" | "distrib" | "naoclass" | "transf";

function blocoDe(classificacao: string | null, tipo: string | null, entrada: boolean): Bloco {
  const c = norm(classificacao ?? "");
  if (c.includes("DIVIDA")) return "divida";
  if (c.includes("INVESTIMENTO")) return "invest";
  if (c.includes("DISTRIBUICAO")) return "distrib";
  if (c.includes("OPERACAO")) {
    const t = norm(tipo ?? "");
    if (t.startsWith("ENTRADA")) return "receb";
    if (t.startsWith("SAIDA")) return "pag";
    return entrada ? "receb" : "pag";
  }
  return "naoclass";
}

const BLOCOS: Array<{ id: Bloco; rotulo: string }> = [
  { id: "receb", rotulo: "RECEBIMENTOS" },
  { id: "pag", rotulo: "PAGAMENTOS" },
  { id: "divida", rotulo: "EMPRÉSTIMOS E FINANCIAMENTOS" },
  { id: "invest", rotulo: "INVESTIMENTOS" },
  { id: "distrib", rotulo: "ANTECIPAÇÃO DE LUCROS" },
  { id: "naoclass", rotulo: "NÃO CLASSIFICADO" },
  { id: "transf", rotulo: "Transferências entre contas" },
];

async function getFluxoLivreSemCache(ano: number, filter?: DimFilter): Promise<FluxoLivre> {
  const de = `${ano}-01-01`;
  const ate = `${ano}-12-31`;
  const hoje = todayISO();
  const mesAtual = hoje.slice(0, 7);
  const prev = previsaoSql("t");

  const bReal = new Binder();
  const pDe = bReal.add(de);
  const pAte = bReal.add(ate);
  const realRows = await query<{ col: string; app_key: string; codigo: string | null; transf: string; v: number }>(
    `SELECT to_char(e.data_lancamento, 'YYYY-MM') AS col, e.app_key, e.codigo_categoria AS codigo,
            COALESCE(c.transferencia, 'N') AS transf, SUM(e.valor_documento)::float AS v
     FROM ${EXTRATO_RATEADO} e
     LEFT JOIN dim.categoria c ON c.app_key=e.app_key AND c.codigo=e.codigo_categoria
     WHERE e.data_lancamento BETWEEN ${pDe}::date AND ${pAte}::date
       AND COALESCE(e.codigo_lancamento,0) <> 0
       AND COALESCE(e.situacao,'') <> 'Previsto'
       ${dimSql(bReal, filter, { appKey: "e.app_key", cliente: "e.codigo_cliente_omie", categoria: "e.codigo_categoria", conta: "e.codigo_cc_omie" })}
     GROUP BY 1,2,3,4`,
    bReal.values
  );

  const bPrev = new Binder();
  const qDe = bPrev.add(de);
  const qAte = bPrev.add(ate);
  const prevRows = await query<{ col: string; app_key: string; codigo: string | null; transf: string; v: number }>(
    `SELECT CASE WHEN ${prev} < ${HOJE_SQL} THEN 'VENC' ELSE to_char(${prev}, 'YYYY-MM') END AS col,
            t.app_key, t.codigo_categoria AS codigo, COALESCE(c.transferencia, 'N') AS transf,
            SUM(CASE WHEN t.natureza='R' THEN t.valor_aberto ELSE -t.valor_aberto END)::float AS v
     FROM ${TITULO_RATEADO} t
     LEFT JOIN dim.categoria c ON c.app_key=t.app_key AND c.codigo=t.codigo_categoria
     WHERE t.valor_aberto > 0
       AND ((t.natureza='R' AND t.status::text NOT IN ('CANCELADO','RECEBIDO','LIQUIDADO'))
         OR (t.natureza='P' AND t.status::text NOT IN ('CANCELADO','PAGO','LIQUIDADO')))
       AND (${prev} < ${HOJE_SQL} OR ${prev} BETWEEN ${qDe}::date AND ${qAte}::date)
       ${dimSql(bPrev, filter, { appKey: "t.app_key", cliente: "t.codigo_cliente_omie", categoria: "t.codigo_categoria", conta: "t.codigo_cc_omie", departamento: "t.codigo_departamento" })}
     GROUP BY 1,2,3,4`,
    bPrev.values
  );

  const bMap = new Binder();
  const keys = filter?.appKeys ?? [];
  const mapa = keys.length
    ? await query<{ app_key: string; codigo_categoria: string; classificacao: string; subgrupo: string; categoria_ajustada: string; tipo: string | null }>(
        `SELECT app_key, codigo_categoria, classificacao, subgrupo, categoria_ajustada, tipo
         FROM ops.categoria_fluxo WHERE app_key = ANY(${bMap.add(keys)}::varchar[])`,
        bMap.values
      ).catch(() => [])
    : [];
  const cats = keys.length
    ? await query<{ app_key: string; codigo: string; descricao: string }>(
        `SELECT app_key, codigo, descricao FROM dim.categoria WHERE app_key = ANY($1::varchar[])`,
        [keys]
      )
    : [];

  const bSaldo = new Binder();
  const sDe = bSaldo.add(de);
  const saldoRows = await query<{ saldo: number }>(
    `SELECT COALESCE(SUM(s.saldo_atual),0)::float AS saldo
     FROM dim.conta_corrente cc
     LEFT JOIN LATERAL (
       SELECT saldo_atual FROM fato.saldo_conta_corrente x
       WHERE x.app_key=cc.app_key AND x.codigo_cc_omie=cc.codigo_cc_omie AND x.data_referencia < ${sDe}::date
       ORDER BY data_referencia DESC LIMIT 1
     ) s ON true
     WHERE COALESCE(cc.inativa,'N') <> 'S'
       ${dimSql(bSaldo, filter, { appKey: "cc.app_key", conta: "cc.codigo_cc_omie" })}`,
    bSaldo.values
  );
  const saldoInicialAno = n(saldoRows[0]?.saldo);

  // colunas
  const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);
  const colunas: FclColuna[] = [
    { id: "VENC", rotulo: "VENCIDO", tipo: "venc" },
    ...meses.map((m, i) => ({ id: m, rotulo: MESES[i] ?? m, tipo: "mes" as const, fechado: m < mesAtual, atual: m === mesAtual })),
    { id: "ANO", rotulo: `TOTAL ${ano}`, tipo: "ano" },
  ];

  // de/para → linha de categoria
  const porCodigo = new Map(mapa.map((m) => [`${m.app_key}|${m.codigo_categoria}`, m]));
  const descr = new Map(cats.map((c) => [`${c.app_key}|${c.codigo}`, c.descricao]));
  const naoClass = new Set<string>();

  const vazio = (): Record<string, FclValor> => ({});
  const soma = (l: FclLinha, col: string, campo: "real" | "prev", v: number) => {
    const cell = l.valores[col] ?? (l.valores[col] = { real: null, prev: null });
    cell[campo] = (cell[campo] ?? 0) + v;
  };

  // folhas = categorias ajustadas, já com o bloco e o subgrupo do de/para
  const folhas = new Map<string, { bloco: Bloco; sub: string; cat: string; id: string }>();
  const folhaDe = (app: string, codigo: string | null, transf: string) => {
    if (transf === "S") return { bloco: "transf" as Bloco, sub: "", cat: descr.get(`${app}|${codigo}`) ?? "Transferência" };
    const m = codigo ? porCodigo.get(`${app}|${codigo}`) : undefined;
    const entrada = String(codigo ?? "").startsWith("1.");
    if (!m) {
      const nome = (codigo && descr.get(`${app}|${codigo}`)) || "(sem categoria)";
      naoClass.add(codigo ? `${codigo} ${nome}` : nome);
      return { bloco: "naoclass" as Bloco, sub: entrada ? "Entradas" : "Saídas", cat: nome };
    }
    return { bloco: blocoDe(m.classificacao, m.tipo, entrada), sub: m.subgrupo, cat: m.categoria_ajustada };
  };
  const linhaFolha = (app: string, codigo: string | null, transf: string) => {
    const f = folhaDe(app, codigo, transf);
    const subId = f.sub ? `${f.bloco}/${norm(f.sub)}` : f.bloco;
    const id = `${subId}/${norm(f.cat)}`;
    if (!folhas.has(id)) folhas.set(id, { ...f, id });
    return id;
  };

  const valoresFolha = new Map<string, Record<string, FclValor>>();
  const acumula = (id: string, col: string, campo: "real" | "prev", v: number) => {
    const vals = valoresFolha.get(id) ?? {};
    const cell = vals[col] ?? (vals[col] = { real: null, prev: null });
    cell[campo] = (cell[campo] ?? 0) + v;
    valoresFolha.set(id, vals);
  };
  for (const r of realRows) if (r.v) acumula(linhaFolha(r.app_key, r.codigo, r.transf), r.col, "real", n(r.v));
  for (const r of prevRows) if (r.v) acumula(linhaFolha(r.app_key, r.codigo, r.transf), r.col, "prev", n(r.v));
  const folhasPorBloco = (b: Bloco) => [...folhas.values()].filter((f) => f.bloco === b);

  // monta a árvore na ordem do modelo
  const final: FclLinha[] = [];
  const blocoLinha: Record<string, FclLinha> = {};

  const somaEm = (alvo: FclLinha, fonte: Record<string, FclValor>) => {
    for (const [col, v] of Object.entries(fonte)) {
      if (v.real !== null) soma(alvo, col, "real", v.real);
      if (v.prev !== null) soma(alvo, col, "prev", v.prev);
    }
  };

  const total = (id: string, rotulo: string, partes: FclLinha[]): FclLinha => {
    const l: FclLinha = { id, rotulo, nivel: 0, tipo: "total", valores: vazio() };
    for (const p of partes) somaEm(l, p.valores);
    return l;
  };

  const saldoIni: FclLinha = { id: "SALDO_INI", rotulo: "1. SALDO INICIAL", nivel: 0, tipo: "saldo", valores: vazio() };
  final.push(saldoIni);

  for (const b of BLOCOS) {
    const fs = folhasPorBloco(b.id);
    if (!fs.length && (b.id === "naoclass" || b.id === "transf")) continue;
    const g: FclLinha = { id: b.id, rotulo: b.rotulo, nivel: 0, tipo: "grupo", valores: vazio() };
    blocoLinha[b.id] = g;
    const blocoFilhos: FclLinha[] = [];
    const subs = [...new Set(fs.map((f) => f.sub))].filter(Boolean);
    const pushFolhas = (lista: typeof fs, pai: string, nivel: number) => {
      const out: FclLinha[] = [];
      for (const f of lista.sort((a, b2) => a.cat.localeCompare(b2.cat, "pt-BR"))) {
        const l: FclLinha = { id: f.id, rotulo: f.cat, nivel, tipo: "conta", pai, valores: valoresFolha.get(f.id) ?? {} };
        out.push(l);
      }
      return out;
    };
    if (subs.length) {
      for (const s of subs.sort((a, b2) => a.localeCompare(b2, "pt-BR"))) {
        const subId = `${b.id}/${norm(s)}`;
        const sl: FclLinha = { id: subId, rotulo: s, nivel: 1, tipo: "subgrupo", pai: b.id, valores: vazio() };
        const filhas = pushFolhas(fs.filter((f) => f.sub === s), subId, 2);
        for (const f of filhas) somaEm(sl, f.valores);
        blocoFilhos.push(sl, ...filhas);
        somaEm(g, sl.valores);
      }
    } else {
      const filhas = pushFolhas(fs, b.id, 1);
      for (const f of filhas) somaEm(g, f.valores);
      blocoFilhos.push(...filhas);
    }
    final.push(g, ...blocoFilhos);

    if (b.id === "pag") {
      final.push(total("FC_OPERACAO", "FLUXO DE CAIXA DA OPERAÇÃO", [blocoLinha.receb, blocoLinha.pag].filter((x): x is FclLinha => Boolean(x))));
    }
    if (b.id === "divida") {
      final.push(total("FC_DIVIDA", "FLUXO DE CAIXA APÓS A DÍVIDA", [blocoLinha.receb, blocoLinha.pag, blocoLinha.divida].filter((x): x is FclLinha => Boolean(x))));
    }
    if (b.id === "invest") {
      final.push(
        total("FC_INVEST", "FLUXO DE CAIXA APÓS OS INVESTIMENTOS", [blocoLinha.receb, blocoLinha.pag, blocoLinha.divida, blocoLinha.invest].filter((x): x is FclLinha => Boolean(x)))
      );
    }
  }

  const livre = total("FC_LIVRE", "FLUXO DE CAIXA LIVRE", Object.values(blocoLinha));
  final.push(livre);
  const saldoFim: FclLinha = { id: "SALDO_FIM", rotulo: "(=) SALDO FINAL", nivel: 0, tipo: "saldo", valores: vazio() };
  final.push(saldoFim);

  // totais do ano: realizado (meses), a realizar (vencido + meses)
  for (const l of final) {
    if (l.tipo === "saldo") continue;
    let real: number | null = null;
    let prevT: number | null = null;
    for (const c of colunas) {
      const v = l.valores[c.id];
      if (!v || c.tipo === "ano") continue;
      if (v.real !== null) real = (real ?? 0) + v.real;
      if (v.prev !== null) prevT = (prevT ?? 0) + v.prev;
    }
    l.valores.ANO = { real, prev: prevT };
  }

  // saldos encadeados: real (só meses fechados/atual) e projetado (todos)
  let siReal = saldoInicialAno;
  let siProj = saldoInicialAno;
  for (const m of meses) {
    const fl = livre.valores[m] ?? { real: null, prev: null };
    const temReal = m <= mesAtual;
    saldoIni.valores[m] = { real: temReal ? siReal : null, prev: siProj };
    const sfReal = siReal + (fl.real ?? 0);
    const sfProj = siProj + (fl.real ?? 0) + (fl.prev ?? 0);
    saldoFim.valores[m] = { real: temReal ? sfReal : null, prev: sfProj };
    siReal = sfReal;
    siProj = sfProj;
  }
  saldoIni.valores.ANO = { real: saldoInicialAno, prev: saldoInicialAno };
  const ultimoReal = meses.filter((m) => m <= mesAtual).pop();
  saldoFim.valores.ANO = {
    real: ultimoReal ? (saldoFim.valores[ultimoReal]?.real ?? null) : null,
    prev: (saldoFim.valores[`${ano}-12`]?.prev ?? 0) + (livre.valores.VENC?.prev ?? 0),
  };
  saldoFim.valores.VENC = { real: null, prev: livre.valores.VENC?.prev ?? null };

  return { ano, colunas, linhas: final, semDepara: mapa.length === 0, naoClassificadas: [...naoClass].sort() };
}

export const getFluxoLivre = cacheDados("getFluxoLivre", getFluxoLivreSemCache);
