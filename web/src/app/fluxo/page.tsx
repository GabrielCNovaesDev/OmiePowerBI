import { ComboCashflow, ComboCashflowAtualPrevisto } from "@/components/charts";
import { FluxoDrilldown } from "@/components/fluxo-drill";
import { PageHeader } from "@/components/shell";
import { Card, DataTable, Signed } from "@/components/ui";
import { money } from "@/lib/format";
import {
  getFluxoDrilldown,
  getFluxoDrilldownHibrido,
  getFluxoMensalAtualPrevisto,
  getFluxoMensalCaixa,
  getFluxoMensalPrevisto,
  type MonthCash,
  type MonthCashCompare,
} from "@/lib/dash";
import { hrefWith, readParams } from "@/lib/params";
import { oneParam } from "@/lib/params-shared";
import { cashForecastTo, todayISO } from "@/lib/period";
import Link from "next/link";
import { cn } from "@/lib/format";

export default async function FluxoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { period, filter, raw, tenant } = await readParams(searchParams);
  const comPrevisto = !tenant.modulosDesativados.includes("fluxo_previsto");
  const modo = comPrevisto ? oneParam(raw, "modo") || "atual" : "atual";

  if (modo === "previsto") {
    const to = cashForecastTo(period);
    const [months, nodes] = await Promise.all([
      getFluxoMensalPrevisto(period.from, to, filter),
      getFluxoDrilldown(period.from, to, filter, "previsto"),
    ]);
    return (
      <div className="space-y-4">
        <PageHeader
          kicker="Dashboards"
          title="Fluxo de Caixa"
          subtitle={`${period.label} · títulos em aberto por vencimento (atrasados no mês corrente)`}
        />
        <ModeSwitch current="previsto" raw={raw} />
        <FluxoResumo title="Fluxo de Caixa Previsto" months={months} />
        <FluxoDrilldown
          months={months}
          nodes={nodes}
          hint="Valores em aberto. Clique na linha para abrir sub-grupo, categoria e fornecedor."
        />
      </div>
    );
  }

  if (modo === "ambos") {
    const to = cashForecastTo(period);
    const todayYm = todayISO().slice(0, 7);
    const [months, nodes] = await Promise.all([
      getFluxoMensalAtualPrevisto(period.from, to, filter),
      getFluxoDrilldownHibrido(period.from, to, filter, todayYm),
    ]);
    return (
      <div className="space-y-4">
        <PageHeader
          kicker="Dashboards"
          title="Fluxo de Caixa"
          subtitle={`${period.label} · realizado até hoje + títulos em aberto a vencer`}
        />
        <ModeSwitch current="ambos" raw={raw} />
        <FluxoComparado months={months} />
        <FluxoDrilldown
          months={months}
          nodes={nodes}
          hint="Até o mês corrente: extrato. Deste mês em diante: títulos em aberto (vencidos entram no mês atual)."
        />
      </div>
    );
  }

  const [months, nodes] = await Promise.all([
    getFluxoMensalCaixa(period.from, period.to, filter),
    getFluxoDrilldown(period.from, period.to, filter),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader kicker="Dashboards" title="Fluxo de Caixa" subtitle={`${period.label} · realizado de extrato/baixas Omie`} />
      {comPrevisto ? <ModeSwitch current="atual" raw={raw} /> : null}
      <FluxoResumo title="Fluxo de Caixa Atual" months={months} />
      <FluxoDrilldown months={months} nodes={nodes} />
    </div>
  );
}

function FluxoResumo({ title, months }: { title: string; months: MonthCash[] }) {
  return (
    <>
      <Card>
        <p className="mb-2 text-sm font-semibold">{title}</p>
        <ComboCashflow
          labels={months.map((m) => m.label)}
          entradas={months.map((m) => m.entrada)}
          saidas={months.map((m) => m.saida)}
          saldo={months.map((m) => m.saldoAcumulado)}
          height={360}
        />
      </Card>
      <DataTable
        headers={["", ...months.map((m) => m.label), "Total"]}
        rows={[
          ["Saldo inicial", ...months.map((m) => <Signed key={`i${m.mes}`} value={m.saldoInicial} />), ""],
          ["Transf & Ajustes", ...months.map((m) => <Signed key={`t${m.mes}`} value={m.transf} />), money(months.reduce((s, m) => s + m.transf, 0))],
          ["Entrada", ...months.map((m) => money(m.entrada)), money(months.reduce((s, m) => s + m.entrada, 0))],
          ["Saída", ...months.map((m) => money(m.saida)), money(months.reduce((s, m) => s + m.saida, 0))],
          ["Resultado", ...months.map((m) => <Signed key={`r${m.mes}`} value={m.resultado} />), ""],
          [
            "Saldo acumulado",
            ...months.map((m) => <Signed key={`a${m.mes}`} value={m.saldoAcumulado} />),
            months.length ? <Signed key="last" value={months[months.length - 1]!.saldoAcumulado} /> : "",
          ],
        ]}
      />
    </>
  );
}

function FluxoComparado({ months }: { months: MonthCashCompare[] }) {
  return (
    <>
      <Card>
        <p className="mb-2 text-sm font-semibold">Atual × Previsto</p>
        <ComboCashflowAtualPrevisto
          labels={months.map((m) => m.label)}
          entradaAtual={months.map((m) => m.entradaAtual)}
          saidaAtual={months.map((m) => m.saidaAtual)}
          entradaPrev={months.map((m) => m.entradaPrev)}
          saidaPrev={months.map((m) => m.saidaPrev)}
          saldoAtual={months.map((m) => m.saldoAtualAcumulado)}
          saldoPrevisto={months.map((m) => m.saldoAcumulado)}
          height={380}
        />
      </Card>
      <DataTable
        headers={["", ...months.map((m) => m.label), "Total"]}
        rows={[
          ["Saldo inicial", ...months.map((m) => <Signed key={`i${m.mes}`} value={m.saldoInicial} />), ""],
          [
            "Transf & Ajustes",
            ...months.map((m) => <Signed key={`t${m.mes}`} value={m.transfAtual} />),
            money(months.reduce((s, m) => s + m.transfAtual, 0)),
          ],
          ["Entrada atual", ...months.map((m) => money(m.entradaAtual)), money(months.reduce((s, m) => s + m.entradaAtual, 0))],
          ["Entrada prevista", ...months.map((m) => money(m.entradaPrev)), money(months.reduce((s, m) => s + m.entradaPrev, 0))],
          ["Saída atual", ...months.map((m) => money(m.saidaAtual)), money(months.reduce((s, m) => s + m.saidaAtual, 0))],
          ["Saída prevista", ...months.map((m) => money(m.saidaPrev)), money(months.reduce((s, m) => s + m.saidaPrev, 0))],
          ["Resultado atual", ...months.map((m) => <Signed key={`ra${m.mes}`} value={m.resultadoAtual} />), ""],
          ["Resultado (atual + previsto)", ...months.map((m) => <Signed key={`r${m.mes}`} value={m.resultado} />), ""],
          [
            "Saldo previsto acumulado",
            ...months.map((m) => <Signed key={`a${m.mes}`} value={m.saldoAcumulado} />),
            months.length ? <Signed key="last" value={months[months.length - 1]!.saldoAcumulado} /> : "",
          ],
        ]}
      />
    </>
  );
}

function ModeSwitch({ current, raw }: { current: string; raw: Record<string, string | string[] | undefined> }) {
  const items = [
    { id: "atual", label: "Atual" },
    { id: "previsto", label: "Previsto" },
    { id: "ambos", label: "Atual + Previsto" },
  ];
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.id}
          href={hrefWith(raw, "/fluxo", { modo: item.id })}
          className={cn(
            "rounded border px-4 py-1.5 text-sm",
            current === item.id ? "border-cyan bg-cyan text-white" : "border-line bg-card hover:border-cyan"
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
