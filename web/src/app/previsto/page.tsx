import { ComboCashflow, GaugePct } from "@/components/charts";
import { PageHeader } from "@/components/shell";
import { Card, Standby } from "@/components/ui";
import { compactMoney } from "@/lib/format";
import { getOrcamentoMensal, getResultadoMensal } from "@/lib/dash";
import { readParams } from "@/lib/params";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function PrevistoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { period, filter } = await readParams(searchParams);
  const year = Number(period.from.slice(0, 4));
  const [orc, real] = await Promise.all([getOrcamentoMensal(year, filter), getResultadoMensal(period.from, period.to, filter)]);

  if (!orc.length) {
    return (
      <div>
        <PageHeader kicker="Dashboards" title="Previsto × Realizado" />
        <Standby
          title="Sem orçamento de caixa na carga"
          reason="O layout existe; os pontos pretos de previsão vêm de fato.orcamento_caixa. Quando o sync do orçamento Omie popular a tabela, esta tela preenche sozinha."
        />
      </div>
    );
  }

  const recPrev = MONTHS.map((_, i) => Number(orc.find((o) => o.mes === i + 1 && o.tipo === "receita")?.previsto ?? 0));
  const recReal = MONTHS.map((_, i) => {
    const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
    return Number(real.find((r) => r.mes === ym)?.receita ?? orc.find((o) => o.mes === i + 1 && o.tipo === "receita")?.realizado ?? 0);
  });
  const gasPrev = MONTHS.map((_, i) => Number(orc.find((o) => o.mes === i + 1 && o.tipo === "gasto")?.previsto ?? 0));
  const gasReal = MONTHS.map((_, i) => {
    const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
    const row = real.find((r) => r.mes === ym);
    return row ? Number(row.custos) + Number(row.despesas) : Number(orc.find((o) => o.mes === i + 1 && o.tipo === "gasto")?.realizado ?? 0);
  });
  const resPrev = recPrev.map((v, i) => v - (gasPrev[i] ?? 0));
  const resReal = recReal.map((v, i) => v - (gasReal[i] ?? 0));
  const recTot = recReal.reduce((s, v) => s + v, 0);
  const gasTot = gasReal.reduce((s, v) => s + v, 0);
  const resTot = recTot - gasTot;

  return (
    <div className="space-y-4">
      <PageHeader kicker="Dashboards" title="Previsto × Realizado" subtitle={period.label} />
      <Card>
        <div className="grid gap-3 md:grid-cols-[160px_1fr]">
          <div>
            <GaugePct value={100} target={0} />
            <p className="text-center text-lg font-semibold">{compactMoney(recTot)}</p>
            <p className="text-center text-xs text-mist">Receita realizada</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Receita · Previsto × Realizado</p>
            <ComboCashflow labels={[...MONTHS]} entradas={recReal} saidas={recPrev} saldo={recPrev} height={200} />
          </div>
        </div>
      </Card>
      <Card>
        <div className="grid gap-3 md:grid-cols-[160px_1fr]">
          <div>
            <p className="text-center text-lg font-semibold text-pay">{compactMoney(-gasTot)}</p>
            <p className="text-center text-xs text-mist">Gastos realizados</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Gastos · Previsto × Realizado</p>
            <ComboCashflow labels={[...MONTHS]} entradas={gasPrev} saidas={gasReal} saldo={gasPrev} height={200} />
          </div>
        </div>
      </Card>
      <Card>
        <div className="grid gap-3 md:grid-cols-[160px_1fr]">
          <div>
            <p className="text-center text-lg font-semibold">{compactMoney(resTot)}</p>
            <p className="text-center text-xs text-mist">Resultado</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Resultado · Previsto × Realizado</p>
            <ComboCashflow labels={[...MONTHS]} entradas={resReal.map((v) => (v > 0 ? v : 0))} saidas={resReal.map((v) => (v < 0 ? Math.abs(v) : 0))} saldo={resPrev} height={200} />
          </div>
        </div>
      </Card>
    </div>
  );
}
