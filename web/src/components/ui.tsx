import { cn, compactMoney, money } from "@/lib/format";

export function Card({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={cn("rounded-md border border-line bg-card shadow-sm", padded && "p-4", className)}>
      {children}
    </div>
  );
}

export function SectionBar({ title, period }: { title: string; period?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4 rounded-t-md bg-cyan px-4 py-2 text-white">
      <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
      {period ? <p className="text-[11px] text-white/80">Período analisado: {period}</p> : null}
    </div>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
  compact = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "gain" | "loss" | "receive" | "pay" | "cyan";
  compact?: boolean;
}) {
  const color =
    tone === "gain"
      ? "text-gain"
      : tone === "loss"
        ? "text-loss"
        : tone === "receive"
          ? "text-receive"
          : tone === "pay"
            ? "text-pay"
            : tone === "cyan"
              ? "text-cyan-2"
              : "text-ink";
  return (
    <div className="rounded-md border border-line bg-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-mist">{label}</p>
      <p className={cn("mt-1 font-semibold tracking-tight", compact ? "text-xl" : "text-2xl", color)}>
        {typeof value === "number" ? money(value) : value}
      </p>
      {hint ? <p className="mt-1 text-xs text-mist">{hint}</p> : null}
    </div>
  );
}

export function ToneCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone: "receive" | "pay" | "gain" | "loss";
}) {
  const bg =
    tone === "receive" ? "bg-receive text-white" : tone === "pay" || tone === "loss" ? "bg-pay text-white" : "bg-gain text-white";
  return (
    <div className={cn("rounded-md px-4 py-3 shadow-sm", bg)}>
      <p className="text-[11px] uppercase tracking-wide text-white/80">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{compactMoney(value)}</p>
      {hint ? <p className="mt-1 text-xs text-white/80">{hint}</p> : null}
    </div>
  );
}

export function Signed({ value }: { value: number }) {
  return <span className={value < 0 ? "text-loss" : value > 0 ? "text-gain" : "text-ink"}>{money(value)}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    ATRASADO: "bg-loss/15 text-loss",
    VENCEHOJE: "bg-warn/20 text-ink",
    AVENCER: "bg-gain/10 text-gain",
    EMABERTO: "bg-paper text-ink",
    PAGTO_PARCIAL: "bg-warn/20 text-ink",
    PAGO: "bg-gain/10 text-gain",
    RECEBIDO: "bg-gain/10 text-gain",
    LIQUIDADO: "bg-gain/10 text-gain",
    CANCELADO: "bg-line text-mist",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide", map[status] || "bg-paper text-mist")}>
      {status.replace("_", " ")}
    </span>
  );
}

export function DataTable({
  headers,
  rows,
  footer,
}: {
  headers: string[];
  rows: Array<Array<React.ReactNode>>;
  footer?: Array<React.ReactNode>;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="w-full text-sm">
        <thead className="bg-header text-left text-[11px] uppercase tracking-[0.08em] text-white">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-line even:bg-paper/70">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-8 text-mist" colSpan={headers.length}>
                Sem registros neste recorte. Os números vêm da carga Omie — não dos prints de referência.
              </td>
            </tr>
          ) : null}
        </tbody>
        {footer ? (
          <tfoot>
            <tr className="border-t border-line bg-paper font-medium">
              {footer.map((cell, i) => (
                <td key={i} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

export function Standby({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="rounded-md border border-dashed border-line bg-paper px-5 py-10 text-center">
      <p className="text-xs uppercase tracking-[0.16em] text-cyan-2">Em standby</p>
      <h2 className="mt-2 text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-mist">{reason}</p>
    </div>
  );
}

export function Dot({ tone }: { tone: "ok" | "warn" | "err" }) {
  const bg = tone === "ok" ? "bg-gain" : tone === "err" ? "bg-loss" : "bg-warn";
  return <span className={cn("inline-block h-3.5 w-3.5 rounded-full", bg)} />;
}
