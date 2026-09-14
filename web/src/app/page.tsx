import { AgingChart, CashflowChart } from "@/components/charts";
import { PageHeader } from "@/components/shell";
import { Kpi } from "@/components/ui";
import { money } from "@/lib/format";
import { getAging, getFluxoMensal, getHomeKpis } from "@/lib/queries";

export default async function HomePage() {
  const [kpis, agingR, agingP, monthly] = await Promise.all([
    getHomeKpis(),
    getAging("R"),
    getAging("P"),
    getFluxoMensal(12),
  ]);

  const saldo = kpis.resumo?.cc_saldo_total ?? 0;
  const liquido30 = kpis.receber30 - kpis.pagar30;

  return (
    <div>
      <PageHeader
        kicker="Visão executiva"
        title="Caixa, a receber e a pagar"
        subtitle={
          kpis.empresa
            ? `${kpis.empresa.razao_social} · o que a diretoria abre todo dia.`
            : "Conectado ao Postgres. Quando a carga Omie terminar, os KPIs aparecem aqui."
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Saldo em contas" value={saldo} tone="gold" hint="Snapshot Omie + extrato" />
        <Kpi label="A receber aberto" value={kpis.arAberto} tone="gain" hint={`${kpis.resumo?.ar_qtd_titulos ?? "—"} títulos no resumo Omie`} />
        <Kpi label="A pagar aberto" value={kpis.apAberto} tone="loss" hint={`${kpis.resumo?.ap_qtd_titulos ?? "—"} títulos no resumo Omie`} />
        <Kpi
          label="Vencidos"
          value={kpis.arAtraso + kpis.apAtraso}
          tone="loss"
          hint={`Receber ${money(kpis.arAtraso)} · Pagar ${money(kpis.apAtraso)}`}
        />
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-3">
        <Kpi label="Entra em 7 dias" value={kpis.receber7} hint="Títulos a receber com vencimento na semana" />
        <Kpi label="Sai em 7 dias" value={kpis.pagar7} hint="Obrigações da semana" />
        <Kpi
          label="Saldo projetado 30 dias"
          value={liquido30}
          tone={liquido30 >= 0 ? "gain" : "loss"}
          hint={`Receber ${money(kpis.receber30)} − pagar ${money(kpis.pagar30)}`}
        />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-5">
          <h2 className="font-serif text-xl">Realizado — últimos 12 meses</h2>
          <p className="mb-4 mt-1 text-xs text-mist">Baixas de títulos (recebido × pago)</p>
          <CashflowChart data={monthly} />
        </div>
        <div className="rounded-xl border border-line bg-panel p-5">
          <h2 className="font-serif text-xl">Aging a receber</h2>
          <p className="mb-4 mt-1 text-xs text-mist">Carteira aberta por faixa de atraso</p>
          <AgingChart data={agingR.map((r) => ({ faixa: r.faixa, valor: Number(r.valor) }))} />
        </div>
      </section>

      {agingP.length > 0 ? (
        <section className="mt-6 rounded-xl border border-line bg-panel p-5">
          <h2 className="font-serif text-xl">Aging a pagar</h2>
          <AgingChart data={agingP.map((r) => ({ faixa: r.faixa, valor: Number(r.valor) }))} />
        </section>
      ) : null}
    </div>
  );
}
