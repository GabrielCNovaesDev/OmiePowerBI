import { resolvePeriod, type PeriodBounds } from "./period";

export type PageParams = {
  period: PeriodBounds;
  base: "caixa" | "comp";
  view: string;
};

export async function readParams(
  searchParams: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
): Promise<PageParams> {
  const sp = await searchParams;
  const rawView = sp.view;
  return {
    period: resolvePeriod(sp.periodo),
    base: sp.base === "comp" ? "comp" : "caixa",
    view: Array.isArray(rawView) ? (rawView[0] ?? "hoje") : (rawView ?? "hoje"),
  };
}
