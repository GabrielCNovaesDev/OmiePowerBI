import { resolvePeriod, type PeriodBounds } from "./period";
import { auth } from "@/auth";
import { resolveTenant, type Tenant } from "./tenant";

export type DimFilter = {
  appKeys?: string[];
  cliente?: string;
  categoria?: string;
  conta?: string;
  departamento?: string;
};

export type PageParams = {
  period: PeriodBounds;
  base: "caixa" | "comp";
  view: string;
  filter: DimFilter;
  raw: Record<string, string | string[] | undefined>;
  tenant: Tenant;
};

function one(
  sp: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  if (!s || s === "todos") return undefined;
  return s;
}

export async function readParams(
  searchParams: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
): Promise<PageParams> {
  const sp = await searchParams;
  const rawView = sp.view;
  const session = await auth();
  if (!session?.user) {
    throw new Error("Sessao ausente");
  }
  const tenant = await resolveTenant(session, one(sp, "empresa"));
  return {
    period: resolvePeriod(sp.periodo),
    base: sp.base === "comp" ? "comp" : "caixa",
    view: Array.isArray(rawView) ? (rawView[0] ?? "hoje") : (rawView ?? "hoje"),
    filter: {
      appKeys: tenant.selectedKeys,
      cliente: one(sp, "cliente"),
      categoria: one(sp, "categoria"),
      conta: one(sp, "conta"),
      departamento: one(sp, "departamento"),
    },
    raw: sp,
    tenant,
  };
}

export const GLOBAL_FILTER_KEYS = [
  "empresa",
  "periodo",
  "base",
  "cliente",
  "categoria",
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

export function dimSql(
  b: Binder,
  filter: DimFilter | undefined,
  cols: { appKey?: string; cliente?: string; categoria?: string; conta?: string; departamento?: string }
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
  if (filter.conta && cols.conta) parts.push(`${cols.conta} = ${b.add(Number(filter.conta))}`);
  if (filter.departamento && cols.departamento) parts.push(`${cols.departamento} = ${b.add(filter.departamento)}`);
  return parts.length ? ` AND ${parts.join(" AND ")}` : "";
}
