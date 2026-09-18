import { resolvePeriod, type PeriodBounds } from "./period";
import { auth } from "@/auth";
import { resolveTenant, type Tenant } from "./tenant";
import { oneParam, parseContaParam, TIPO_CONTA_CODES } from "./params-shared";
import { redirect } from "next/navigation";

function parseTipoConta(value?: string): string | undefined {
  if (!value || !TIPO_CONTA_CODES.has(value)) return undefined;
  return value;
}

export type { DimFilter } from "./params-shared";
export {
  GLOBAL_FILTER_KEYS,
  TIPO_CONTA_CODES,
  TIPO_CONTA_OPTIONS,
  globalQuery,
  hrefWith,
  Binder,
  dimSql,
} from "./params-shared";

import type { DimFilter } from "./params-shared";

export type PageParams = {
  period: PeriodBounds;
  base: "caixa" | "comp";
  view: string;
  filter: DimFilter;
  raw: Record<string, string | string[] | undefined>;
  tenant: Tenant;
};

export async function readParams(
  searchParams: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
): Promise<PageParams> {
  const sp = await searchParams;
  const rawView = sp.view;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const tenant = await resolveTenant(session, oneParam(sp, "empresa"));
  return {
    period: resolvePeriod(sp.periodo),
    base: sp.base === "comp" ? "comp" : "caixa",
    view: Array.isArray(rawView) ? (rawView[0] ?? "hoje") : (rawView ?? "hoje"),
    filter: {
      appKeys: tenant.selectedKeys,
      cliente: oneParam(sp, "cliente"),
      categoria: oneParam(sp, "categoria"),
      ...parseContaParam(sp),
      tipoConta: parseTipoConta(oneParam(sp, "tipo_conta")),
      departamento: oneParam(sp, "departamento"),
    },
    raw: sp,
    tenant,
  };
}
