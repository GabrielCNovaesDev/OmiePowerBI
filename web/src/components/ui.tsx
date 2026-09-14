import { cn, money } from "@/lib/format";

export function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "gain" | "loss" | "gold";
}) {
  const color =
    tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : tone === "gold" ? "text-gold-2" : "text-paper";
  return (
    <div className="rounded-xl border border-line bg-panel px-5 py-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-mist">{label}</p>
      <p className={cn("mt-2 font-serif text-3xl tracking-tight", color)}>
        {typeof value === "number" ? money(value) : value}
      </p>
      {hint ? <p className="mt-2 text-xs text-mist">{hint}</p> : null}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    ATRASADO: "bg-loss/15 text-loss",
    VENCEHOJE: "bg-gold/15 text-gold-2",
    AVENCER: "bg-gain/10 text-gain",
    EMABERTO: "bg-panel-2 text-paper",
    PAGTO_PARCIAL: "bg-gold/10 text-gold",
    PAGO: "bg-gain/10 text-gain",
    RECEBIDO: "bg-gain/10 text-gain",
    LIQUIDADO: "bg-gain/10 text-gain",
    CANCELADO: "bg-line text-mist",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide", map[status] || "bg-panel-2 text-mist")}>
      {status.replace("_", " ")}
    </span>
  );
}

export function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<React.ReactNode>>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-sm">
        <thead className="bg-panel-2 text-left text-[11px] uppercase tracking-[0.12em] text-mist">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-line even:bg-panel/40">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-mist" colSpan={headers.length}>
                Sem registros nesta carga. Rode o sync ou aguarde a API popular o banco.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
