import type { DimFilter } from "@/lib/params-shared";

export type DiarioCtx = {
  today: string;
  weekFrom: string;
  rollingFrom: string;
  yearFrom: string;
  filter: DimFilter;
  raw: Record<string, string | string[] | undefined>;
};
