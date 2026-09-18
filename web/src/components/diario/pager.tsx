import Link from "next/link";
import { cn } from "@/lib/format";
import { hrefWith } from "@/lib/params";

export const DIARIO_PAGES = [
  { p: 1, label: "Fluxo" },
  { p: 2, label: "Saldo" },
  { p: 3, label: "Resultado" },
  { p: 4, label: "Movimentos" },
  { p: 5, label: "Rec. atrasadas" },
  { p: 6, label: "Rec. a vencer" },
  { p: 7, label: "Pag. atrasados" },
  { p: 8, label: "Pag. a vencer" },
  { p: 9, label: "NFs" },
  { p: 10, label: "Q&A" },
] as const;

export function DiarioPager({
  current,
  raw,
}: {
  current: number;
  raw: Record<string, string | string[] | undefined>;
}) {
  const currentMeta = DIARIO_PAGES.find((x) => x.p === current);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-mist">
      <span>
        Página {current}/10{currentMeta ? ` · ${currentMeta.label}` : ""}
      </span>
      {DIARIO_PAGES.map((item) => (
        <Link
          key={item.p}
          href={hrefWith(raw, "/diario", { p: String(item.p) })}
          title={item.label}
          className={cn("rounded px-2 py-0.5", current === item.p ? "bg-cyan text-white" : "hover:bg-paper")}
        >
          {item.p}
        </Link>
      ))}
    </div>
  );
}
