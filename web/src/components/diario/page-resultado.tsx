import { Waterfall } from "@/components/charts";
import type { DiarioCtx } from "@/components/diario/ctx";
import { Card, DataTable, Kpi, Signed } from "@/components/ui";
import { money } from "@/lib/format";
import { getResultado } from "@/lib/dash";

function pct(part: number, total: number) {
  if (!total) return "—";
  return `${((part / total) * 100).toFixed(1)}%`;
}

export async function DiarioResultado({ ctx }: { ctx: DiarioCtx }) {
  const kpi = await getResultado(ctx.today, ctx.today, ctx.filter);
  const hasMovimento = kpi.receita !== 0 || kpi.custos !== 0 || kpi.despesas !== 0;

  return (
    <>
      <div className="rounded bg-cyan px-4 py-2 text-sm font-semibold text-white">Resultado do dia</div>
      <p className="text-sm text-mist">Baixas de caixa na data de referência. Sem movimento o dia aparece zerado.</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Receita bruta" value={kpi.receita} />
        <Kpi label="Resultado bruto" value={kpi.bruto} tone={kpi.bruto >= 0 ? "gain" : "loss"} />
        <Kpi label="Despesas" value={kpi.despesas} tone="pay" />
        <Kpi label="Resultado do exercício" value={kpi.resultado} tone={kpi.resultado >= 0 ? "gain" : "loss"} />
        <Kpi label="Margem bruta" value={kpi.receita ? `${((kpi.bruto / kpi.receita) * 100).toFixed(1)}%` : "0%"} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <p className="mb-2 text-sm font-semibold">Análise vertical (caixa do dia)</p>
          <DataTable
            headers={["Linha", "Valor", "% AV"]}
            rows={[
              ["(+) Receita bruta", money(kpi.receita), "100%"],
              ["(=) Custos", money(-kpi.custos), pct(kpi.custos, kpi.receita)],
              ["(=) Resultado bruto", money(kpi.bruto), pct(kpi.bruto, kpi.receita)],
              ["(=) Despesas", money(-kpi.despesas), pct(kpi.despesas, kpi.receita)],
              ["(=) Resultado", money(kpi.resultado), pct(kpi.resultado, kpi.receita)],
            ]}
          />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">DRE (caixa do dia)</p>
          {hasMovimento ? (
            <Waterfall labels={["Receita", "Custos", "Despesas", "Resultado"]} values={[kpi.receita, -kpi.custos, -kpi.despesas, kpi.resultado]} />
          ) : (
            <p className="py-8 text-center text-sm text-mist">Nenhuma baixa nesta data.</p>
          )}
        </Card>
      </div>
    </>
  );
}
