export type DimFilter = {
  appKeys?: string[];
  cliente?: string;
  categoria?: string;
  contas?: string[];
  contasTodas?: boolean;
  tipoConta?: string;
  departamento?: string;
};

export const TIPO_CONTA_OPTIONS = [
  { value: "CB", label: "Conta corrente" },
  { value: "CX", label: "Caixa" },
  { value: "AC", label: "Aplicação" },
] as const;

export const TIPO_CONTA_CODES = new Set<string>(TIPO_CONTA_OPTIONS.map((o) => o.value));

export const GLOBAL_FILTER_KEYS = [
  "empresa",
  "periodo",
  "base",
  "cliente",
  "categoria",
  "tipo_conta",
  "conta",
  "departamento",
] as const;

export function globalQuery(sp: URLSearchParams | Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams();
  const get = (key: string) => {
    if (sp instanceof URLSearchParams) return sp.get(key) ?? undefined;
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };
  for (const key of GLOBAL_FILTER_KEYS) {
    const val = get(key);
    if (val && val !== "todos") q.set(key, val);
  }
  return q.toString();
}

export function hrefWith(
  sp: Record<string, string | string[] | undefined>,
  path: string,
  patch: Record<string, string | undefined>
): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    const val = Array.isArray(value) ? value[0] : value;
    if (val) q.set(key, val);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (!value) q.delete(key);
    else q.set(key, value);
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

export class Binder {
  values: unknown[] = [];
  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

// Sem contas escolhidas no filtro, o padrão é só as contas "Consideradas" para
// Resumo e Fluxo de Caixa — vale para saldo, extrato e fluxo. Títulos em aberto
// passam `contaPadrao: "todas"`: a conta de um título é só onde ele deve ser
// pago/recebido, e o ERP lista todos eles, em qualquer conta.
export function dimSql(
  b: Binder,
  filter: DimFilter | undefined,
  cols: {
    appKey?: string;
    cliente?: string;
    categoria?: string;
    conta?: string;
    departamento?: string;
    contaPadrao?: "consideradas" | "todas";
  }
): string {
  const parts: string[] = [];
  if (cols.appKey) {
    const keys = filter?.appKeys;
    if (!keys?.length) parts.push("FALSE");
    else parts.push(`${cols.appKey} = ANY(${b.add(keys)}::varchar[])`);
  }
  if (!filter) return parts.length ? ` AND ${parts.join(" AND ")}` : "";
  if (filter.cliente && cols.cliente) parts.push(`${cols.cliente} = ${b.add(Number(filter.cliente))}`);
  if (filter.categoria && cols.categoria) parts.push(`${cols.categoria} = ${b.add(filter.categoria)}`);
  if (cols.conta && filter.contas?.length) {
    const ids = filter.contas.map((c) => Number(c)).filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length) parts.push(`${cols.conta} = ANY(${b.add(ids)}::bigint[])`);
  } else if (cols.conta && !filter.contasTodas && cols.contaPadrao !== "todas") {
    const appMatch = cols.appKey ? ` AND cc_vis.app_key = ${cols.appKey}` : "";
    parts.push(
      `${cols.conta} IN (
        SELECT cc_vis.codigo_cc_omie
        FROM dim.conta_corrente cc_vis
        WHERE COALESCE(cc_vis.visivel_resumo, 'S') = 'S'
          AND COALESCE(cc_vis.visivel_fluxo_caixa, 'S') = 'S'
          ${appMatch}
      )`
    );
  }
  if (filter.tipoConta && cols.conta) {
    const tipoP = b.add(filter.tipoConta);
    const appMatch = cols.appKey ? ` AND cc_tf.app_key = ${cols.appKey}` : "";
    parts.push(
      `${cols.conta} IN (SELECT cc_tf.codigo_cc_omie FROM dim.conta_corrente cc_tf WHERE cc_tf.tipo_conta_corrente = ${tipoP}${appMatch})`
    );
  }
  if (filter.departamento && cols.departamento) parts.push(`${cols.departamento} = ${b.add(filter.departamento)}`);
  return parts.length ? ` AND ${parts.join(" AND ")}` : "";
}

export function oneParam(
  sp: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  if (!s || s === "todos") return undefined;
  return s;
}

export function listParam(
  sp: Record<string, string | string[] | undefined>,
  key: string
): string[] | undefined {
  const v = sp[key];
  const chunks = (Array.isArray(v) ? v : [v]).flatMap((item) => String(item ?? "").split(","));
  const ids = [...new Set(chunks.map((s) => s.trim()).filter((s) => s && s !== "todos" && s !== "all" && s !== "todas"))];
  return ids.length ? ids : undefined;
}

export function parseContaParam(
  sp: Record<string, string | string[] | undefined>
): { contas?: string[]; contasTodas?: boolean } {
  const v = sp.conta;
  const raw = (Array.isArray(v) ? v.join(",") : v ?? "").trim().toLowerCase();
  if (!raw || raw === "todos") return {};
  if (raw === "all" || raw === "todas") return { contasTodas: true };
  return { contas: listParam(sp, "conta") };
}
