import { resolvePeriod, type PeriodBounds } from "./period";
import { auth } from "@/auth";
import { resolveTenant, type Tenant } from "./tenant";
import { oneParam } from "./params-shared";

export type { DimFilter } from "./params-shared";
export {
  GLOBAL_FILTER_KEYS,
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
    throw new Error("Sessao ausente");
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
      conta: oneParam(sp, "conta"),
      departamento: oneParam(sp, "departamento"),
    },
    raw: sp,
    tenant,
  };
}
