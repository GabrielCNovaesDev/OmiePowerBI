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
  const pctBruto = kpi.receita ? (kpi.bruto / kpi.receita) * 100 : 0;
  const pctDesp = kpi.receita ? (kpi.despesas / kpi.receita) * 100 : 0;
  const pctRes = kpi.receita ? (kpi.resultado / kpi.receita) * 100 : 0;

  return (
    <div className="space-y-4">
      <PageHeader kicker="Dashboards" title="Resultados" subtitle={`Visão gerencial de caixa · ${period.label}. Não é DRE contábil.`} />
      <div className="grid gap-4 xl:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          <Kpi label="Receita bruta" value={kpi.receita} hint="100%" compact />
          <Kpi label="Custos operacionais" value={-kpi.custos} tone="loss" hint={`${kpi.receita ? ((kpi.custos / kpi.receita) * 100).toFixed(1) : 0}%`} compact />
          <Kpi label="Resultado bruto" value={kpi.bruto} tone={kpi.bruto >= 0 ? "gain" : "loss"} compact />
          <Kpi label="Despesas" value={-kpi.despesas} tone="pay" compact />
          <Kpi label="Resultado do exercício" value={kpi.resultado} tone={kpi.resultado >= 0 ? "gain" : "loss"} compact />
        </div>
        <div className="grid gap-4">
          <Card>
            <div className="grid gap-3 md:grid-cols-[180px_1fr]">
              <GaugePct value={pctBruto} target={35} />
              <div>
                <p className="mb-2 text-sm font-semibold">Resultado bruto</p>
                <ComboCashflow
                  labels={labels}
                  entradas={monthly.map((m) => m.receita)}
                  saidas={monthly.map((m) => m.custos)}
                  saldo={monthly.map((m) => m.receita - m.custos)}
                  height={220}
                />
              </div>
            </div>
          </Card>
          <Card>
            <div className="grid gap-3 md:grid-cols-[180px_1fr]">
              <GaugePct value={pctDesp} target={10} />
              <div>
                <p className="mb-2 text-sm font-semibold">Despesas</p>
                <ComboCashflow labels={labels} entradas={monthly.map(() => 0)} saidas={monthly.map((m) => m.despesas)} saldo={monthly.map((m) => m.despesas)} height={180} />
              </div>
            </div>
          </Card>
          <Card>
            <div className="grid gap-3 md:grid-cols-[180px_1fr]">
              <GaugePct value={pctRes} target={15} />
              <div>
                <p className="mb-2 text-sm font-semibold">Resultado do exercício</p>
                <ComboCashflow
                  labels={labels}
                  entradas={monthly.map((m) => (m.resultado > 0 ? m.resultado : 0))}
                  saidas={monthly.map((m) => (m.resultado < 0 ? Math.abs(m.resultado) : 0))}
                  saldo={monthly.map((m) => m.resultado)}
                  height={180}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
