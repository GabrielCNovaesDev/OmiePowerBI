import { PageHeader } from "@/components/shell";
import { Card, DataTable, Kpi } from "@/components/ui";
import { formatDate, money } from "@/lib/format";
import { getNfs } from "@/lib/dash";
import { readParams } from "@/lib/params";

export default async function NfsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { period } = await readParams(searchParams);
  const rows = await getNfs(period.from, period.to);
  const total = rows.reduce((s, r) => s + Number(r.valor), 0);

  return (
    <div className="space-y-4">
      <PageHeader kicker="Dashboards" title="NFs emitidas / recebidas" subtitle="Títulos Omie com número de documento fiscal preenchido." />
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi label="Documentos" value={String(rows.length)} />
        <Kpi label="Valor bruto" value={total} />
        <Card>
          <p className="text-sm text-mist">
            Entrada / saída como no print do Business Indicator. Sem NF na carga, a tabela fica vazia — o layout permanece.
          </p>
        </Card>
      </div>
      <DataTable
        headers={["Num. doc.", "Lançamento", "Categoria", "Cliente", "Dt. emiss.", "Valor bruto"]}
        rows={rows.map((r, i) => [r.numero || "—", r.lancamento || "—", r.categoria || "—", r.cliente || "—", formatDate(r.emissao), money(r.valor)])}
      />
    </div>
  );
}
