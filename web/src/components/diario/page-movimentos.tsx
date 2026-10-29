import { barrasComLogo } from "@/lib/marcas";
import { HBarChart } from "@/components/charts";
import type { DiarioCtx } from "@/components/diario/ctx";
import { Card } from "@/components/ui";
import { getEntradasSaidas } from "@/lib/dash";

export async function DiarioMovimentos({ ctx }: { ctx: DiarioCtx }) {
  const recCat = await getEntradasSaidas(ctx.today, ctx.today, ctx.filter);

  return (
    <>
      <div className="rounded bg-cyan px-4 py-2 text-sm font-semibold text-white">Entradas e saídas do dia</div>
      <p className="text-sm text-mist">Valores liquidados (baixas) na data de referência, não títulos a vencer.</p>
      <div className="grid gap-4 xl:grid-cols-4">
        <Card>
          <p className="mb-2 text-sm font-semibold">Recebido por categoria</p>
          <HBarChart data={recCat.recCat.map((x) => ({ name: x.nome, value: Number(x.valor) }))} />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">Recebido por cliente</p>
          <HBarChart data={barrasComLogo(recCat.recCli)} />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">Pago por categoria</p>
          <HBarChart data={recCat.pagCat.map((x) => ({ name: x.nome, value: Number(x.valor) }))} color="#e06a6a" />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">Pago por fornecedor</p>
          <HBarChart data={barrasComLogo(recCat.pagForn)} color="#e06a6a" />
        </Card>
      </div>
    </>
  );
}
