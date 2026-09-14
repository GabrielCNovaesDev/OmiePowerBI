export type PeriodoKey =
  | "todo"
  | "ano_corrente"
  | "jan_atual"
  | "jan_ultimo"
  | "ultimo_mes"
  | "este_mes"
  | "ultimos_12";

export const PERIODO_OPTIONS: Array<{ value: PeriodoKey; label: string }> = [
  { value: "todo", label: "Todo Período" },
  { value: "ano_corrente", label: "Ano Corrente" },
  { value: "jan_atual", label: "Jan. até Atual" },
  { value: "jan_ultimo", label: "Jan. até Último Mês" },
  { value: "ultimo_mes", label: "Último Mês" },
  { value: "este_mes", label: "Este Mês" },
  { value: "ultimos_12", label: "Últimos 12 Meses" },
];

export type PeriodBounds = {
  key: PeriodoKey;
  from: string;
  to: string;
  label: string;
};

function todaySP(): Date {
  const iso = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return new Date(`${iso}T00:00:00`);
}

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function resolvePeriod(raw?: string | string[] | null): PeriodBounds {
  const key = (Array.isArray(raw) ? raw[0] : raw) as PeriodoKey | undefined;
  const valid = PERIODO_OPTIONS.some((o) => o.value === key) ? (key as PeriodoKey) : "ano_corrente";
  const today = todaySP();
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const label = PERIODO_OPTIONS.find((o) => o.value === valid)?.label ?? "Ano Corrente";

  switch (valid) {
    case "todo":
      return { key: valid, from: "2000-01-01", to: iso(today), label };
    case "este_mes":
      return { key: valid, from: iso(startOfMonth(today)), to: iso(today), label };
    case "ultimo_mes":
      return { key: valid, from: iso(startOfMonth(lastMonth)), to: iso(endOfMonth(lastMonth)), label };
    case "ultimos_12": {
      const from = new Date(today.getFullYear(), today.getMonth() - 11, 1);
      return { key: valid, from: iso(from), to: iso(today), label };
    }
    case "jan_ultimo":
      return { key: valid, from: iso(yearStart), to: iso(endOfMonth(lastMonth)), label };
    case "jan_atual":
    case "ano_corrente":
    default:
      return { key: valid, from: iso(yearStart), to: iso(today), label };
  }
}

export function yearStartISO(): string {
  const today = todaySP();
  return iso(new Date(today.getFullYear(), 0, 1));
}

export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
