import { ComboCashflow } from "@/components/charts";
import { PageHeader } from "@/components/shell";
import { Card, DataTable, Signed, Standby } from "@/components/ui";
import { money } from "@/lib/format";
import { getFluxoMensalCaixa } from "@/lib/dash";
import { hrefWith, readParams } from "@/lib/params";
import Link from "next/link";
import { cn } from "@/lib/format";

export default async function FluxoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { period, filter, raw } = await readParams(searchParams);
  const modo = Array.isArray(raw.modo) ? raw.modo[0] : raw.modo;
  if (modo === "previsto" || modo === "ambos") {
    return (
      <div>
        <PageHeader kicker="Dashboards" title="Fluxo de Caixa" />
        <ModeSwitch current={modo} raw={raw} />
        <Standby
          title={modo === "previsto" ? "Fluxo previsto" : "Atual + Previsto"}
          reason="Os prints documentam o modo Atual com tabela mensal. Previsto e Atual+Previsto ficam em standby."
        />
      </div>
    );
  }

  const months = await getFluxoMensalCaixa(period.from, period.to, filter);

  return (
    <div className="space-y-4">
      <PageHeader kicker="Dashboards" title="Fluxo de Caixa" subtitle={`${period.label} · realizado de extrato/baixas Omie`} />
      <ModeSwitch current="atual" raw={raw} />
      <Card>
        <p className="mb-2 text-sm font-semibold">Fluxo de Caixa Atual</p>
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
          ["Saldo acumulado", ...months.map((m) => <Signed key={`a${m.mes}`} value={m.saldoAcumulado} />), months.length ? <Signed key="last" value={months[months.length - 1]!.saldoAcumulado} /> : ""],
        ]}
      />
    </div>
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
