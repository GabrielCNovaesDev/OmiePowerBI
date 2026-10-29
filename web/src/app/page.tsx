import Link from "next/link";
import { DailyCashflow, DonutChart, HBarChart } from "@/components/charts";
import { Card, DataTable, Signed, ToneCard } from "@/components/ui";
import { compactMoney, formatDate, money } from "@/lib/format";
import {
  getAgingBi,
  getAgingByDim,
  getFluxoDiarioMes,
  getKpisPeriodo,
  getSaldoAtual,
  getTitulosVencendo,
  getTotaisEmAberto,
  saldoPrevistoHoje,
  type AgingSlice,
  type DailyPoint,
  type NamedValue,
  type TituloHoje,
} from "@/lib/dash";
import { hrefWith, readParams } from "@/lib/params";
import { barrasComLogo } from "@/lib/marcas";
import { ClienteNome } from "@/components/marca";
import {
  endOfMonthISO,
  endOfWeekISO,
  startOfMonthISO,
  startOfWeekISO,
  todayISO,
} from "@/lib/period";
import { cn } from "@/lib/format";

const VIEWS = [
  { id: "hoje", label: "Hoje" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "atrasados", label: "Atrasados" },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

function asView(value: string): ViewId {
  return VIEWS.some((v) => v.id === value) ? (value as ViewId) : "hoje";
}

const FAIXAS = ["Menor que 30", "Entre 30 a 60", "Entre 60 a 90", "Entre 90 a 180", "Maior que 180"];

function sortAging(rows: AgingSlice[]) {
  return [...rows].sort((a, b) => FAIXAS.indexOf(a.faixa) - FAIXAS.indexOf(b.faixa));
}

function formatLongDate(iso: string) {
  return new Date(`${iso}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function formatMonthLabel(iso: string) {
  return new Date(`${iso}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function chartLabel(dia: string, view: ViewId) {
  const day = dia.slice(8, 10);
  if (view === "semana") return `${day}/${dia.slice(5, 7)}`;
  return day;
}

export default async function ResumoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { view: rawView, filter, raw } = await readParams(searchParams);
  const view = asView(rawView);
  if (view === "atrasados") {
    return <AtrasadosView raw={raw} filter={filter} />;
  }

  const today = todayISO();
  const weekStart = startOfWeekISO(today);
  const weekEnd = endOfWeekISO(today);
  const monthStart = startOfMonthISO(today);
  const monthEnd = endOfMonthISO(today);

  const chartFrom = view === "semana" ? weekStart : monthStart;
  const chartTo = view === "hoje" ? today : view === "semana" ? weekEnd : monthEnd;
  const titlesTo = view === "hoje" ? today : view === "semana" ? weekEnd : monthEnd;

  const [saldo, kpis, receber, pagar, diario, totais] = await Promise.all([
    getSaldoAtual(filter),
    view === "hoje" ? getKpisPeriodo("hoje", "hoje", filter) : getKpisPeriodo(today, titlesTo, filter),
    view === "hoje"
      ? getTitulosVencendo("R", filter, { mode: "hoje" })
      : getTitulosVencendo("R", filter, { mode: "periodo", from: today, to: titlesTo }),
    view === "hoje"
      ? getTitulosVencendo("P", filter, { mode: "hoje" })
      : getTitulosVencendo("P", filter, { mode: "periodo", from: today, to: titlesTo }),
    getFluxoDiarioMes(chartFrom, chartTo, filter),
    getTotaisEmAberto(filter),
  ]);
  const previsto = saldoPrevistoHoje(saldo.saldo, kpis);
  const previstoSerie = diario.at(-1)?.saldo ?? previsto;

  const heroLabel =
    view === "hoje"
      ? formatLongDate(today)
      : view === "semana"
        ? `${formatLongDate(weekStart)} — ${formatLongDate(weekEnd)}`
        : formatMonthLabel(today);

  const chartTitle =
    view === "hoje"
      ? "Fluxo de caixa diário (Atual + Previsto) · mês corrente"
      : view === "semana"
        ? "Fluxo de caixa diário (Atual + Previsto) · semana corrente"
        : "Fluxo de caixa diário (Atual + Previsto) · mês corrente";

  const receberLabel = view === "hoje" ? "Receber hoje" : view === "semana" ? "Receber na semana" : "Receber no mês";
  const pagarLabel = view === "hoje" ? "Pagar hoje" : view === "semana" ? "Pagar na semana" : "Pagar no mês";
  const receberHint =
    view === "hoje"
      ? "Pela previsão de recebimento/pagamento, como no Omie · clique para detalhar"
      : "Títulos em aberto com vencimento daqui até o fim deste recorte · clique para detalhar";
  const previstoLabel = view === "hoje" ? "Saldo previsto hoje" : view === "semana" ? "Saldo previsto no fim da semana" : "Saldo previsto no fim do mês";
  const recorteTitulos = view === "hoje" ? "hoje" : "vencer";

  return (
    <div className="space-y-4">
      <ViewSwitch current={view} raw={raw} />
      <HeroCashflow
        heroLabel={heroLabel}
        saldo={saldo.saldo}
        chartTitle={chartTitle}
        diario={diario}
        view={view}
      />
      <CarteiraPanel
        tone="receive"
        label={receberLabel}
        hint={receberHint}
        valor={kpis.receberHoje}
        qtd={kpis.qtdReceber}
        href={hrefWith(raw, "/titulos", { nat: "R", recorte: recorteTitulos })}
        headers={["Categoria / Cliente / NF", "Previsão", "Qtd", "Valor"]}
        rows={receber}
      />
      <CarteiraPanel
        tone="pay"
        label={pagarLabel}
        hint={receberHint}
        valor={kpis.pagarHoje}
        qtd={kpis.qtdPagar}
        href={hrefWith(raw, "/titulos", { nat: "P", recorte: recorteTitulos })}
        headers={["Categoria / Fornecedor / NF", "Previsão", "Qtd", "Valor"]}
        rows={pagar}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <ToneCard
          label="Total a receber em aberto"
          value={totais.receber}
          hint={`${totais.qtdReceber} contas · atrasadas + a vencer · clique para detalhar`}
          tone="receive"
          href={hrefWith(raw, "/titulos", { nat: "R", recorte: "aberto" })}
        />
        <ToneCard
          label="Total a pagar em aberto"
          value={totais.pagar}
          hint={`${totais.qtdPagar} contas · atrasadas + a vencer · clique para detalhar`}
          tone="pay"
          href={hrefWith(raw, "/titulos", { nat: "P", recorte: "aberto" })}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <ToneCard
          label="Recebimentos vencidos"
          value={kpis.receberAtraso}
          hint={`${kpis.qtdReceberAtraso} contas · clique para detalhar`}
          tone="receive"
          href={hrefWith(raw, "/titulos", { nat: "R", recorte: "atraso" })}
        />
        <ToneCard
          label="Pagamentos atrasados"
          value={kpis.pagarAtraso}
          hint={`${kpis.qtdPagarAtraso} contas · clique para detalhar`}
          tone="pay"
          href={hrefWith(raw, "/titulos", { nat: "P", recorte: "atraso" })}
        />
        <Card>
          <p className="text-[11px] uppercase tracking-wide text-mist">{previstoLabel}</p>
          <p className="mt-1 text-2xl font-semibold">
            <Signed value={view === "hoje" ? previsto : previstoSerie} />
          </p>
          {view !== "hoje" ? (
            <p className="mt-1 text-xs text-mist">Saldo em conta projetado no último dia do recorte (atual + previsto).</p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

async function AtrasadosView({
  raw,
  filter,
}: {
  raw: Record<string, string | string[] | undefined>;
  filter: Awaited<ReturnType<typeof readParams>>["filter"];
}) {
  const [kpis, receber, pagar, agingR, agingP, catR, cliR, catP, fornP] = await Promise.all([
    getKpisPeriodo("hoje", "hoje", filter),
    getTitulosVencendo("R", filter, { mode: "atrasado" }),
    getTitulosVencendo("P", filter, { mode: "atrasado" }),
    getAgingBi("R", true, filter),
    getAgingBi("P", true, filter),
    getAgingByDim("R", true, "categoria", filter),
    getAgingByDim("R", true, "cliente", filter),
    getAgingByDim("P", true, "categoria", filter),
    getAgingByDim("P", true, "cliente", filter),
  ]);
  const impacto = kpis.receberAtraso - kpis.pagarAtraso;

  return (
    <div className="space-y-4">
      <ViewSwitch current="atrasados" raw={raw} />
      <div className="grid gap-3 md:grid-cols-3">
        <ToneCard
          label="Recebimentos vencidos"
          value={kpis.receberAtraso}
          hint={`${kpis.qtdReceberAtraso} contas · clique para detalhar`}
          tone="receive"
          href={hrefWith(raw, "/titulos", { nat: "R", recorte: "atraso" })}
        />
        <ToneCard
          label="Pagamentos atrasados"
          value={kpis.pagarAtraso}
          hint={`${kpis.qtdPagarAtraso} contas · clique para detalhar`}
          tone="pay"
          href={hrefWith(raw, "/titulos", { nat: "P", recorte: "atraso" })}
        />
        <div className={cn("rounded-md p-4 text-white shadow-sm", impacto >= 0 ? "bg-gain" : "bg-pay")}>
          <p className="text-[11px] uppercase tracking-wide text-white/80">Impacto líquido no caixa</p>
          <p className="mt-1 text-2xl font-semibold">{money(impacto)}</p>
          <p className="mt-1 text-xs text-white/80">A receber atrasado − a pagar atrasado</p>
        </div>
      </div>

      <AgingResumo
        title="Receitas atrasadas"
        total={kpis.receberAtraso}
        aging={sortAging(agingR)}
        categorias={catR}
        pessoas={cliR}
        color="#4ea3d9"
        pessoaLabel="Por cliente"
      />
      <AgingResumo
        title="Despesas atrasadas"
        total={kpis.pagarAtraso}
        aging={sortAging(agingP)}
        categorias={catP}
        pessoas={fornP}
        color="#e06a6a"
        pessoaLabel="Por fornecedor"
      />

      <CarteiraPanel
        tone="receive"
        label="Receber atrasado"
        hint="Títulos com a previsão vencida · clique para detalhar"
        valor={kpis.receberAtraso}
        qtd={kpis.qtdReceberAtraso}
        href={hrefWith(raw, "/titulos", { nat: "R", recorte: "atraso" })}
        headers={["Categoria / Cliente / NF", "Previsão", "Qtd", "Valor"]}
        rows={receber}
      />
      <CarteiraPanel
        tone="pay"
        label="Pagar atrasado"
        hint="Títulos com a previsão vencida · clique para detalhar"
        valor={kpis.pagarAtraso}
        qtd={kpis.qtdPagarAtraso}
        href={hrefWith(raw, "/titulos", { nat: "P", recorte: "atraso" })}
        headers={["Categoria / Fornecedor / NF", "Previsão", "Qtd", "Valor"]}
        rows={pagar}
      />
    </div>
  );
}

function HeroCashflow({
  heroLabel,
  saldo,
  chartTitle,
  diario,
  view,
}: {
  heroLabel: string;
  saldo: number;
  chartTitle: string;
  diario: DailyPoint[];
  view: ViewId;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <div className={cn("rounded-md p-5 text-white shadow-sm", saldo >= 0 ? "bg-gain" : "bg-pay")}>
        <p className="text-sm capitalize text-white/80">{heroLabel}</p>
        <p className="mt-6 text-xs uppercase tracking-[0.14em] text-white/70">Saldo em conta(s)</p>
        <p className="mt-2 text-4xl font-semibold">{money(saldo)}</p>
      </div>
      <Card>
        <p className="mb-2 text-sm font-semibold">{chartTitle}</p>
        <DailyCashflow
          labels={diario.map((d) => chartLabel(d.dia, view))}
          entradas={diario.map((d) => d.entrada + d.previstoEntrada)}
          saidas={diario.map((d) => d.saida + d.previstoSaida)}
          saldo={diario.map((d) => d.saldo)}
        />
      </Card>
    </div>
  );
}

function CarteiraPanel({
  tone,
  label,
  hint,
  valor,
  qtd,
  href,
  headers,
  rows,
}: {
  tone: "receive" | "pay";
  label: string;
  hint: string;
  valor: number;
  qtd: number;
  href: string;
  headers: string[];
  rows: TituloHoje[];
}) {
  return (
    <div className={cn("overflow-hidden rounded-md text-white", tone === "receive" ? "bg-receive" : "bg-pay")}>
      <div className="grid gap-4 p-4 md:grid-cols-[240px_1fr]">
        <Link href={href} className="block hover:opacity-90">
          <p className="text-xs uppercase tracking-wide text-white/80">{label}</p>
          <p className="text-[11px] text-white/70">{hint}</p>
          <p className="mt-3 text-3xl font-semibold">{compactMoney(valor)}</p>
          <p className="text-sm text-white/80">{qtd} contas</p>
        </Link>
        <DataTable
          headers={headers}
          rows={rows.map((r, i) => [
            <span key={`c${i}`} className="inline-flex min-w-0 flex-wrap items-center gap-x-1">
              <span>{r.categoria} ·</span>
              <ClienteNome cnpj={r.cnpj} nome={r.cliente ?? "(sem cadastro)"} />
              {r.nf ? <span>· {r.nf}</span> : null}
            </span>,
            formatDate(r.vencimento),
            String(r.qtd),
            money(r.valor),
          ])}
        />
      </div>
    </div>
  );
}

function AgingResumo({
  title,
  total,
  aging,
  categorias,
  pessoas,
  color,
  pessoaLabel,
}: {
  title: string;
  total: number;
  aging: AgingSlice[];
  categorias: NamedValue[];
  pessoas: NamedValue[];
  color: string;
  pessoaLabel: string;
}) {
  return (
    <div>
      <div className="mb-3 rounded bg-cyan px-4 py-2 text-sm font-semibold text-white">{title}</div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <p className="mb-2 text-sm font-semibold">Por intervalo de tempo (dias)</p>
          <DonutChart
            data={aging.map((a) => ({ name: a.faixa, value: Number(a.valor) }))}
            center={compactMoney(total)}
            colors={[color, "#f0b429", "#c05621", "#9b2c2c", "#6b7787"]}
          />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">Por categoria</p>
          <HBarChart data={categorias.map((c) => ({ name: c.nome, value: Number(c.valor) }))} color={color} />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">{pessoaLabel}</p>
          <HBarChart data={barrasComLogo(pessoas)} color={color} />
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
