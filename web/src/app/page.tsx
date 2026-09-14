import Link from "next/link";
import { DailyCashflow } from "@/components/charts";
import { Card, DataTable, Signed, Standby, ToneCard } from "@/components/ui";
import { compactMoney, formatDate, money } from "@/lib/format";
import { getFluxoDiarioMes, getKpisDia, getSaldoAtual, getTitulosHoje } from "@/lib/dash";
import { hrefWith, readParams } from "@/lib/params";
import { todayISO } from "@/lib/period";
import { cn } from "@/lib/format";

const VIEWS = [
  { id: "hoje", label: "Hoje" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "atrasados", label: "Atrasados" },
];

export default async function ResumoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { view, filter, raw } = await readParams(searchParams);
  if (view !== "hoje") {
    return (
      <div>
        <ViewSwitch current={view} raw={raw} />
        <Standby
          title={`Resumo · ${VIEWS.find((v) => v.id === view)?.label}`}
          reason="Essa visualização não está nos prints de referência. Fica em standby até chegarem os screenshots de Semana, Mês e Atrasados."
        />
      </div>
    );
  }

  const today = todayISO();
  const monthStart = `${today.slice(0, 7)}-01`;
  const [saldo, kpis, receber, pagar, diario] = await Promise.all([
    getSaldoAtual(filter),
    getKpisDia(filter),
    getTitulosHoje("R", filter),
    getTitulosHoje("P", filter),
    getFluxoDiarioMes(monthStart, today, filter),
  ]);
  const previsto = saldo.saldo + kpis.receberHoje - kpis.pagarHoje;
  const dateLabel = new Date(`${today}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });

  return (
    <div className="space-y-4">
      <ViewSwitch current="hoje" raw={raw} />
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <div className={cn("rounded-md p-5 text-white shadow-sm", saldo.saldo >= 0 ? "bg-gain" : "bg-pay")}>
          <p className="text-sm capitalize text-white/80">{dateLabel}</p>
          <p className="mt-6 text-xs uppercase tracking-[0.14em] text-white/70">Saldo em conta(s)</p>
          <p className="mt-2 text-4xl font-semibold">{money(saldo.saldo)}</p>
        </div>
        <Card>
          <p className="mb-2 text-sm font-semibold">Fluxo de caixa diário (Atual + Previsto) · mês corrente</p>
          <DailyCashflow
            labels={diario.map((d) => d.dia.slice(8, 10))}
            entradas={diario.map((d) => d.entrada + d.previstoEntrada)}
            saidas={diario.map((d) => d.saida + d.previstoSaida)}
            saldo={diario.map((d) => d.saldo)}
          />
        </Card>
      </div>

      <div className="overflow-hidden rounded-md bg-receive text-white">
        <div className="grid gap-4 p-4 md:grid-cols-[240px_1fr]">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/80">Receber hoje</p>
            <p className="text-[11px] text-white/70">Considerando a data de vencimento</p>
            <p className="mt-3 text-3xl font-semibold">{compactMoney(kpis.receberHoje)}</p>
            <p className="text-sm text-white/80">{kpis.qtdReceber} contas</p>
          </div>
          <DataTable
            headers={["Categoria / Cliente / NF", "Vencimento", "Qtd", "Valor"]}
            rows={receber.map((r) => [
              `${r.categoria} · ${r.cliente}${r.nf ? ` · ${r.nf}` : ""}`,
              formatDate(r.vencimento),
              String(r.qtd),
              money(r.valor),
            ])}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-md bg-pay text-white">
        <div className="grid gap-4 p-4 md:grid-cols-[240px_1fr]">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/80">Pagar hoje</p>
            <p className="text-[11px] text-white/70">Considerando a data de vencimento</p>
            <p className="mt-3 text-3xl font-semibold">{compactMoney(kpis.pagarHoje)}</p>
            <p className="text-sm text-white/80">{kpis.qtdPagar} contas</p>
          </div>
          <DataTable
            headers={["Categoria / Fornecedor / NF", "Vencimento", "Qtd", "Valor"]}
            rows={pagar.map((r) => [
              `${r.categoria} · ${r.cliente}${r.nf ? ` · ${r.nf}` : ""}`,
              formatDate(r.vencimento),
              String(r.qtd),
              money(r.valor),
            ])}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <ToneCard label="Receber hoje" value={kpis.receberHoje} hint={`Atraso ${money(kpis.receberAtraso)}`} tone="receive" />
        <ToneCard label="Pagar hoje" value={kpis.pagarHoje} hint={`Atraso ${money(kpis.pagarAtraso)}`} tone="pay" />
        <Card>
          <p className="text-[11px] uppercase tracking-wide text-mist">Saldo previsto hoje</p>
          <p className="mt-1 text-2xl font-semibold">
            <Signed value={previsto} />
          </p>
        </Card>
      </div>
    </div>
  );
}

function ViewSwitch({ current, raw }: { current: string; raw: Record<string, string | string[] | undefined> }) {
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {VIEWS.map((v) => (
        <Link
          key={v.id}
          href={hrefWith(raw, "/", { view: v.id })}
          className={cn(
            "rounded border px-3 py-1 text-xs uppercase tracking-wide",
            current === v.id ? "border-cyan bg-cyan text-white" : "border-line bg-card text-mist hover:border-cyan"
          )}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );
}
