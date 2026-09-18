import { ComboCashflow, GaugePct } from "@/components/charts";
import { PageHeader } from "@/components/shell";
import { Card, Kpi } from "@/components/ui";
import { getResultado, getResultadoMensal } from "@/lib/dash";
import { readParams } from "@/lib/params";

export default async function ResultadoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { period, filter } = await readParams(searchParams);
  const [kpi, monthly] = await Promise.all([getResultado(period.from, period.to, filter), getResultadoMensal(period.from, period.to, filter)]);
  const labels = monthly.map((m) => m.mes.slice(5));
  const pct = (part: number) => (kpi.receita ? (part / kpi.receita) * 100 : 0);
  const zeros = monthly.map(() => 0);
  const charts = [
    {
      title: "Receita bruta",
      value: pct(kpi.receita),
      target: 100,
      entradas: monthly.map((m) => m.receita),
      saidas: zeros,
      saldo: monthly.map((m) => m.receita),
    },
    {
      title: "Custos operacionais",
      value: pct(kpi.custos),
      target: 30,
      entradas: zeros,
      saidas: monthly.map((m) => m.custos),
      saldo: monthly.map((m) => m.custos),
    },
    {
      title: "Resultado bruto",
      value: pct(kpi.bruto),
      target: 35,
      entradas: monthly.map((m) => m.receita),
      saidas: monthly.map((m) => m.custos),
      saldo: monthly.map((m) => m.receita - m.custos),
    },
    {
      title: "Despesas",
      value: pct(kpi.despesas),
      target: 10,
      entradas: zeros,
      saidas: monthly.map((m) => m.despesas),
      saldo: monthly.map((m) => m.despesas),
    },
    {
      title: "Resultado do exercício",
      value: pct(kpi.resultado),
      target: 15,
      entradas: monthly.map((m) => (m.resultado > 0 ? m.resultado : 0)),
      saidas: monthly.map((m) => (m.resultado < 0 ? Math.abs(m.resultado) : 0)),
      saldo: monthly.map((m) => m.resultado),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader kicker="Dashboards" title="Resultados" subtitle={`Visão gerencial de caixa · ${period.label}. Não é DRE contábil.`} />
      <div className="grid gap-4 xl:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          <Kpi label="Receita bruta" value={kpi.receita} hint="100%" compact />
          <Kpi label="Custos operacionais" value={-kpi.custos} tone="loss" hint={`${pct(kpi.custos).toFixed(1)}%`} compact />
          <Kpi label="Resultado bruto" value={kpi.bruto} tone={kpi.bruto >= 0 ? "gain" : "loss"} compact />
          <Kpi label="Despesas" value={-kpi.despesas} tone="pay" compact />
          <Kpi label="Resultado do exercício" value={kpi.resultado} tone={kpi.resultado >= 0 ? "gain" : "loss"} compact />
        </div>
        <div className="grid gap-4">
          {charts.map((chart) => (
            <Card key={chart.title}>
              <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                <GaugePct value={chart.value} target={chart.target} />
                <div>
                  <p className="mb-2 text-sm font-semibold">{chart.title}</p>
                  <ComboCashflow labels={labels} entradas={chart.entradas} saidas={chart.saidas} saldo={chart.saldo} height={180} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
