import { ComboCashflow, HBarChart } from "@/components/charts";
import { PageHeader } from "@/components/shell";
import { Card, DataTable, Signed, Standby, ToneCard } from "@/components/ui";
import { formatDate, money } from "@/lib/format";
import { getFluxoDiarioMes, getKpisDia, getSaldoAtual, getSaldoPorConta, getTitulosHoje } from "@/lib/dash";
import { hrefWith, readParams } from "@/lib/params";
import { todayISO } from "@/lib/period";
import { cn } from "@/lib/format";
import Link from "next/link";

export default async function DiarioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { filter, raw } = await readParams(searchParams);
  const page = Number(Array.isArray(raw.p) ? raw.p[0] : raw.p) || 1;
  if (page !== 1) {
    return (
      <div>
        <PageHeader kicker="Relatórios" title="Relatório Diário Financeiro" />
        <Pager current={page} raw={raw} />
        <Standby title={`Página ${page} de 10`} reason="Só a página 1 (Fluxo de Caixa do dia) está documentada nos prints. As demais ficam em standby." />
      </div>
    );
  }

  const today = todayISO();
  const weekAgo = new Date(`${today}T00:00:00`);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekFrom = weekAgo.toISOString().slice(0, 10);
  const [saldo, kpis, contas, receber, pagar, semana] = await Promise.all([
    getSaldoAtual(filter),
    getKpisDia(filter),
    getSaldoPorConta(filter),
    getTitulosHoje("R", filter),
    getTitulosHoje("P", filter),
    getFluxoDiarioMes(weekFrom, today, filter),
  ]);
  const resultado = kpis.receberHoje - kpis.pagarHoje;
  const previsto = saldo.saldo + resultado;

  return (
    <div className="space-y-4">
      <PageHeader kicker="Relatórios" title="Relatório Diário Financeiro" subtitle={`Data de referência: ${formatDate(today)}`} />
      <Pager current={1} raw={raw} />
      <div className="rounded bg-cyan px-4 py-2 text-sm font-semibold text-white">Fluxo de Caixa</div>
      <div className="grid gap-3 md:grid-cols-5">
        <ToneCard label="Saldo inicial (hoje)" value={saldo.saldo} tone={saldo.saldo >= 0 ? "gain" : "loss"} />
        <ToneCard label="Receber (hoje)" value={kpis.receberHoje} hint={`Atrasado ${money(kpis.receberAtraso)}`} tone="receive" />
        <ToneCard label="Pagar (hoje)" value={kpis.pagarHoje} hint={`Atrasado ${money(kpis.pagarAtraso)}`} tone="pay" />
        <ToneCard label="Resultado (receber − pagar)" value={resultado} tone={resultado >= 0 ? "gain" : "loss"} />
        <ToneCard label="Saldo previsto (hoje)" value={previsto} tone={previsto >= 0 ? "gain" : "loss"} hint={`Atrasados ${money(kpis.receberAtraso - kpis.pagarAtraso)}`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card padded={false}>
          <p className="px-4 py-3 text-sm font-semibold">Saldo por conta corrente</p>
          <DataTable
            headers={["Conta", "Saldo", "Previsto", "Disponível"]}
            rows={contas.map((c) => [c.conta, <Signed key={c.conta} value={Number(c.saldo)} />, money(c.previsto), money(c.disponivel)])}
          />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">Fluxo de caixa (atual + previsto) · semana corrente</p>
          <ComboCashflow
            labels={semana.map((d) => d.dia.slice(8, 10) + "/" + d.dia.slice(5, 7))}
            entradas={semana.map((d) => d.entrada + d.previstoEntrada)}
            saidas={semana.map((d) => d.saida + d.previstoSaida)}
            saldo={semana.map((d) => d.saldo)}
            height={260}
          />
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="mb-2 text-sm font-semibold">Receber hoje por categoria</p>
          <HBarChart data={receber.map((r) => ({ name: r.categoria || "—", value: r.valor }))} />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">Receber hoje por cliente</p>
          <HBarChart data={receber.map((r) => ({ name: r.cliente || "—", value: r.valor }))} />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">Pagar hoje por categoria</p>
          <HBarChart data={pagar.map((r) => ({ name: r.categoria || "—", value: r.valor }))} color="#e06a6a" />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">Pagar hoje por fornecedor</p>
          <HBarChart data={pagar.map((r) => ({ name: r.cliente || "—", value: r.valor }))} color="#e06a6a" />
        </Card>
      </div>
    </div>
  );
}

function Pager({ current, raw }: { current: number; raw: Record<string, string | string[] | undefined> }) {
  return (
    <div className="flex items-center gap-2 text-sm text-mist">
      <span>
        Página {current}/10
      </span>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
        <Link
          key={p}
          href={hrefWith(raw, "/diario", { p: String(p) })}
          className={cn("rounded px-2 py-0.5", current === p ? "bg-cyan text-white" : "hover:bg-paper")}
        >
          {p}
        </Link>
      ))}
    </div>
  );
}
