import { PageHeader } from "@/components/shell";
import { DataTable, Kpi } from "@/components/ui";
import { formatDate, money } from "@/lib/format";
import { getNfs } from "@/lib/dash";
import { readParams } from "@/lib/params";

export default async function NfsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { period, filter } = await readParams(searchParams);
  const rows = await getNfs(period.from, period.to, filter);
  const total = rows.reduce((s, r) => s + Number(r.valor), 0);

  return (
    <div className="space-y-4">
      <PageHeader kicker="Dashboards" title="NFs emitidas / recebidas" subtitle="Títulos Omie com número de documento fiscal preenchido." />
      <div className="grid gap-4 md:grid-cols-2">
        <Kpi label="Documentos" value={String(rows.length)} />
        <Kpi label="Valor bruto" value={total} />
      </div>
      <DataTable
        headers={["Num. doc.", "Lançamento", "Categoria", "Cliente", "Dt. emiss.", "Valor bruto"]}
        rows={rows.map((r, i) => [r.numero || "—", r.lancamento || "—", r.categoria || "—", r.cliente || "—", formatDate(r.emissao), money(r.valor)])}
      />
    </div>
  );
}
