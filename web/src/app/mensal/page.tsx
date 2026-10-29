import { barrasComLogo } from "@/lib/marcas";
import { AgingBlock } from "@/components/aging-block";
import { ComboCashflow, HBarChart, Spark, Waterfall } from "@/components/charts";
import { PageHeader } from "@/components/shell";
import { Card, DataTable, Kpi, Signed } from "@/components/ui";
import { money } from "@/lib/format";
import {
  getAgingBi,
  getAgingByDim,
  getEntradasSaidas,
  getFluxoMensalCaixa,
  getInadimplenciaMensal,
  getResultado,
  getResultadoMensal,
} from "@/lib/dash";
import { readParams } from "@/lib/params";

export default async function MensalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { period, filter } = await readParams(searchParams);
  const [kpi, monthly, fluxo, recCat, inad, recAtrasoCat, recAtrasoCli, recVencerCat, recVencerCli, pagAtrasoCat, pagAtrasoCli, pagVencerCat, pagVencerCli, atrasadoR, vencerR, atrasadoP, vencerP] =
    await Promise.all([
      getResultado(period.from, period.to, filter),
      getResultadoMensal(period.from, period.to, filter),
      getFluxoMensalCaixa(period.from, period.to, filter),
      getEntradasSaidas(period.from, period.to, filter),
      getInadimplenciaMensal(filter),
      getAgingByDim("R", true, "categoria", filter),
      getAgingByDim("R", true, "cliente", filter),
      getAgingByDim("R", false, "categoria", filter),
      getAgingByDim("R", false, "cliente", filter),
      getAgingByDim("P", true, "categoria", filter),
      getAgingByDim("P", true, "cliente", filter),
      getAgingByDim("P", false, "categoria", filter),
      getAgingByDim("P", false, "cliente", filter),
      getAgingBi("R", true, filter),
      getAgingBi("R", false, filter),
      getAgingBi("P", true, filter),
      getAgingBi("P", false, filter),
    ]);

  const spark = (key: "receita" | "resultado") => monthly.map((m) => (key === "receita" ? m.receita : m.resultado));
  const totAtrasoR = atrasadoR.reduce((s, x) => s + Number(x.valor), 0);
  const totVencerR = vencerR.reduce((s, x) => s + Number(x.valor), 0);
  const totAtrasoP = atrasadoP.reduce((s, x) => s + Number(x.valor), 0);
  const totVencerP = vencerP.reduce((s, x) => s + Number(x.valor), 0);
  const taxaMes = inad.at(-1)?.taxa ?? 0;
  const taxaAno = inad.length ? inad.reduce((s, x) => s + Number(x.taxa), 0) / inad.length : 0;

  return (
    <div className="space-y-8">
      <PageHeader kicker="Relatórios" title="Relatório Financeiro Resumido" subtitle={`${period.label} · de ${period.from} até ${period.to}`} />

      <section>
        <div className="mb-3 rounded bg-cyan px-4 py-2 text-sm font-semibold text-white">1. Resultados</div>
        <p className="mb-3 text-sm font-medium">1.1 Demonstrativo de Resultados</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Kpi label="Receita bruta" value={kpi.receita} />
          <Kpi label="Resultado bruto" value={kpi.bruto} tone={kpi.bruto >= 0 ? "gain" : "loss"} />
          <Kpi label="Despesas" value={kpi.despesas} tone="pay" />
          <Kpi label="Resultado do exercício" value={kpi.resultado} tone={kpi.resultado >= 0 ? "gain" : "loss"} />
          <Kpi label="Margem bruta" value={`${kpi.receita ? ((kpi.bruto / kpi.receita) * 100).toFixed(1) : "0"}%`} />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          {["Receita bruta", "Resultado bruto", "Despesas", "Resultado", "Margem"].map((label, i) => (
            <Card key={label} className="overflow-hidden">
              <p className="text-[11px] text-mist">{label}</p>
              <Spark data={i === 4 ? monthly.map((m) => (m.receita ? (m.resultado / m.receita) * 100 : 0)) : spark(i === 0 ? "receita" : "resultado")} color="#00c2d4" />
            </Card>
          ))}
        </div>
        <Card className="mt-4">
          <p className="mb-2 text-sm font-semibold">Evolução do resultado do exercício acumulado (caixa)</p>
          <ComboCashflow
            labels={fluxo.map((m) => m.label)}
            entradas={fluxo.map((m) => m.entrada)}
            saidas={fluxo.map((m) => m.saida)}
            saldo={fluxo.map((m) => m.saldoAcumulado)}
          />
        </Card>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card>
            <p className="mb-2 text-sm font-semibold">Análise vertical e horizontal (caixa)</p>
            <DataTable
              headers={["Linha", "Período", "% AV"]}
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
            <p className="mb-2 text-sm font-semibold">DRE (caixa)</p>
            <Waterfall labels={["Receita", "Custos", "Despesas", "Resultado"]} values={[kpi.receita, -kpi.custos, -kpi.despesas, kpi.resultado]} />
          </Card>
        </div>
      </section>

      <section>
        <div className="mb-3 rounded bg-cyan px-4 py-2 text-sm font-semibold text-white">1.2 Entradas e saídas</div>
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
      </section>

      <section>
        <div className="mb-3 rounded bg-cyan px-4 py-2 text-sm font-semibold text-white">2. Fluxo de caixa</div>
        <Card>
          <ComboCashflow labels={fluxo.map((m) => m.label)} entradas={fluxo.map((m) => m.entrada)} saidas={fluxo.map((m) => m.saida)} saldo={fluxo.map((m) => m.saldoAcumulado)} height={340} />
          <div className="mt-3">
            <DataTable
              headers={["", ...fluxo.map((m) => m.label)]}
              rows={[
                ["Saldo inicial", ...fluxo.map((m) => <Signed key={`i${m.mes}`} value={m.saldoInicial} />)],
                ["Entrada", ...fluxo.map((m) => money(m.entrada))],
                ["Saída", ...fluxo.map((m) => money(m.saida))],
                ["Saldo acumulado", ...fluxo.map((m) => <Signed key={`a${m.mes}`} value={m.saldoAcumulado} />)],
              ]}
            />
          </div>
        </Card>
      </section>

      <section>
        <div className="mb-3 rounded bg-cyan px-4 py-2 text-sm font-semibold text-white">3. Contas a receber</div>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <Kpi label="Inadimplência anual (média)" value={`${(taxaAno * 100).toFixed(2)}%`} />
          <Kpi label="Inadimplência mensal" value={`${(Number(taxaMes) * 100).toFixed(2)}%`} tone="loss" />
          <Card>
            <p className="text-sm font-semibold">Evolução anual da inadimplência</p>
            <ComboCashflow
              labels={inad.map((i) => i.mes.slice(5))}
              entradas={inad.map((i) => Number(i.taxa) * 100)}
              saidas={inad.map(() => 0)}
              saldo={inad.map((i) => Number(i.taxa) * 100)}
              height={160}
            />
          </Card>
        </div>
        <div className="mb-4">
          <AgingBlock title="Receitas atrasadas" total={totAtrasoR} aging={atrasadoR} categorias={recAtrasoCat} pessoas={recAtrasoCli} color="#e07a3a" banner={false} />
        </div>
        <AgingBlock title="Receitas a vencer" total={totVencerR} aging={vencerR} categorias={recVencerCat} pessoas={recVencerCli} color="#4ea3d9" banner={false} />
      </section>

      <section>
        <div className="mb-3 rounded bg-cyan px-4 py-2 text-sm font-semibold text-white">4. Contas a pagar</div>
        <div className="mb-4">
          <AgingBlock title="Gastos atrasados" total={totAtrasoP} aging={atrasadoP} categorias={pagAtrasoCat} pessoas={pagAtrasoCli} color="#e07a3a" pessoaLabel="Por fornecedor" banner={false} />
        </div>
        <AgingBlock title="Gastos a vencer" total={totVencerP} aging={vencerP} categorias={pagVencerCat} pessoas={pagVencerCli} color="#e06a6a" pessoaLabel="Por fornecedor" banner={false} />
      </section>
    </div>
  );
}

function pct(part: number, total: number) {
  if (!total) return "—";
  return `${((part / total) * 100).toFixed(1)}%`;
}
