import type { DiarioCtx } from "@/components/diario/ctx";
import { DataTable, Kpi } from "@/components/ui";
import { formatDate, money } from "@/lib/format";
import { getNfs } from "@/lib/dash";

export async function DiarioNfs({ ctx }: { ctx: DiarioCtx }) {
  const rows = await getNfs(ctx.today, ctx.today, ctx.filter);
  const total = rows.reduce((s, r) => s + Number(r.valor), 0);

  return (
    <>
      <div className="rounded bg-cyan px-4 py-2 text-sm font-semibold text-white">NFs do dia</div>
      <p className="text-sm text-mist">Títulos com número de documento fiscal na data de referência (emissão ou vencimento).</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Kpi label="Documentos" value={String(rows.length)} />
        <Kpi label="Valor bruto" value={total} />
      </div>
      <DataTable
        headers={["Num. doc.", "Lançamento", "Categoria", "Cliente", "Dt. emiss.", "Valor bruto"]}
        rows={rows.map((r) => [r.numero || "—", r.lancamento || "—", r.categoria || "—", r.cliente || "—", formatDate(r.emissao), money(r.valor)])}
      />
    </>
  );
}
