import { Waterfall } from "@/components/charts";
import { PageHeader } from "@/components/shell";
import { Card, DataTable, Signed } from "@/components/ui";
import { getDreLinhas, getResultado } from "@/lib/dash";
import { readParams } from "@/lib/params";

export default async function DrePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { period, filter } = await readParams(searchParams);
  const [linhas, kpi] = await Promise.all([getDreLinhas(period.from, period.to, filter), getResultado(period.from, period.to, filter)]);
  const waterfallLabels = ["(+) Receita", "(=) Custos", "(=) Despesas", "(=) Resultado"];
  const waterfallValues = [kpi.receita, -kpi.custos, -kpi.despesas, kpi.resultado];

  return (
    <div className="space-y-4">
      <PageHeader kicker="Dashboards" title="DRE" subtitle={`Demonstrativo gerencial de caixa · ${period.label}`} />
      <Card>
        <p className="mb-2 text-sm font-semibold">DRE (caixa)</p>
        <Waterfall labels={waterfallLabels} values={waterfallValues} />
      </Card>
      <DataTable
        headers={["Código", "Conta DRE", "Nível", "Valor"]}
        rows={linhas.map((l) => [l.codigo, l.descricao, String(l.nivel), <Signed key={l.codigo} value={Number(l.valor)} />])}
        footer={["", "Resultado do exercício", "", <Signed key="r" value={kpi.resultado} />]}
      />
    </div>
  );
}
