import { ScatterOutliers } from "@/components/charts";
import { PageHeader } from "@/components/shell";
import { Card, DataTable, Dot, Kpi, Standby } from "@/components/ui";
import { cn, formatDate, money } from "@/lib/format";
import { getAnaliseDesvios, getBlankDocs, getCheckPanel, getSaldoAtual, getSaldoPorConta } from "@/lib/dash";
import { getResumo } from "@/lib/queries";
import { hrefWith, readParams, type DimFilter } from "@/lib/params";
import Link from "next/link";

const TABS = [
  { id: "status", label: "Status" },
  { id: "branco", label: "Valores em branco" },
  { id: "duplicadas", label: "Contas duplicadas" },
  { id: "dre", label: "DRE" },
  { id: "caixa", label: "Fluxo de Caixa & CC" },
  { id: "rateio", label: "Rateio" },
  { id: "outliers", label: "Análise de desvios" },
];

export default async function CheckPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { period, filter, raw } = await readParams(searchParams);
  const tab = (Array.isArray(raw.tab) ? raw.tab[0] : raw.tab) || "status";
  const blank = (Array.isArray(raw.blank) ? raw.blank[0] : raw.blank) || "projetos";
  const items = await getCheckPanel(period.from, period.to, filter);

  return (
    <div className="space-y-4">
      <PageHeader kicker="Relatórios" title="Check Panel" subtitle="Diagnóstico de cadastro e desvios entre Omie e o BI." />
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={hrefWith(raw, "/check", { tab: t.id })}
            className={cn("rounded-full border px-3 py-1 text-sm", tab === t.id ? "border-cyan bg-cyan text-white" : "border-line bg-card")}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "status" ? (
        <Card>
          <p className="mb-4 text-sm text-mist">Clique na categoria para detalhar. Verde = sem ocorrência, amarelo = há valores em branco.</p>
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between rounded bg-paper px-3 py-2">
                <span>
                  {item.label}
                  {item.count ? <span className="ml-2 text-xs text-mist">{item.count} docs</span> : null}
                </span>
                <Dot tone={item.tone} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {tab === "branco" ? (
        <BlankTab periodFrom={period.from} periodTo={period.to} field={blank} filter={filter} raw={raw} />
      ) : null}

      {tab === "duplicadas" ? (
        <Card>
          <p className="py-8 text-center text-gain">No período selecionado a checagem de contas duplicadas ainda é simplificada — sem pares óbvios de CC duplicada na dimensão.</p>
        </Card>
      ) : null}

      {tab === "dre" ? (
        <Card>
          <p className="text-sm text-mist">Categorias sem `codigo_dre` não entram no demonstrativo. Ajuste no Omie em Configurações → Categorias.</p>
          <p className="mt-3 text-lg font-semibold">{items.find((i) => i.id === "dre")?.count ?? 0} categorias sem vínculo</p>
        </Card>
      ) : null}

      {tab === "caixa" ? <CaixaCheck filter={filter} /> : null}

      {tab === "rateio" ? (
        <Card>
          <p className={items.find((i) => i.id === "rateio")?.count ? "text-warn" : "text-gain"}>
            {items.find((i) => i.id === "rateio")?.count
              ? `${items.find((i) => i.id === "rateio")?.count} títulos com rateio diferente de 100%.`
              : "No período selecionado não há rateios diferentes de 100%."}
          </p>
        </Card>
      ) : null}

      {tab === "outliers" ? (
        <OutliersTab periodFrom={period.from} periodTo={period.to} filter={filter} raw={raw} />
      ) : null}
    </div>
  );
}

async function BlankTab({
  periodFrom,
  periodTo,
  field,
  filter,
  raw,
}: {
  periodFrom: string;
  periodTo: string;
  field: string;
  filter?: DimFilter;
  raw: Record<string, string | string[] | undefined>;
}) {
  const key = ["projetos", "clientes", "categorias", "departamentos", "nfs"].includes(field)
    ? (field as "projetos" | "clientes" | "categorias" | "departamentos" | "nfs")
    : "projetos";
  const rows = await getBlankDocs(periodFrom, periodTo, key, filter);
  const pills = [
    { id: "clientes", label: "Clientes" },
    { id: "projetos", label: "Projetos" },
    { id: "categorias", label: "Categorias" },
    { id: "departamentos", label: "Departamentos" },
    { id: "nfs", label: "Notas Fiscais" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {pills.map((p) => (
          <Link key={p.id} href={hrefWith(raw, "/check", { tab: "branco", blank: p.id })} className={cn("rounded-full border px-3 py-1 text-sm", key === p.id ? "border-cyan bg-cyan text-white" : "border-line bg-card")}>
            {p.label}
          </Link>
        ))}
      </div>
      <p className="text-sm">
        No período selecionado há <strong>{rows.length}</strong> documentos listados com {key} em branco (amostra de até 80).
      </p>
      <DataTable
        headers={["CNPJ", "NF", "Num. doc.", "Cliente", "Categoria", "Observação", "Valor"]}
        rows={rows.map((r) => [r.cnpj || "—", r.nf || "—", r.numero || "—", r.cliente || "—", r.categoria || "—", r.obs || "—", money(r.valor)])}
      />
    </div>
  );
}

async function OutliersTab({
  periodFrom,
  periodTo,
  filter,
  raw,
}: {
  periodFrom: string;
  periodTo: string;
  filter?: DimFilter;
  raw: Record<string, string | string[] | undefined>;
}) {
  const regraRaw = Array.isArray(raw.regra) ? raw.regra[0] : raw.regra;
  const metodo = regraRaw === "z" ? "z" : "iqr";
  const natRaw = Array.isArray(raw.nat) ? raw.nat[0] : raw.nat;
  const natureza = natRaw === "R" || natRaw === "P" ? natRaw : undefined;
  const data = await getAnaliseDesvios(periodFrom, periodTo, filter, metodo, natureza);
  const regras = [
    { id: "iqr", label: "IQR (Tukey 1,5)" },
    { id: "z", label: "Z-score (|z| ≥ 2,5)" },
  ];
  const nats = [
    { id: undefined, label: "Todas" },
    { id: "R", label: "A receber" },
    { id: "P", label: "A pagar" },
  ] as const;
  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm text-mist">
          Cada ponto é um título no período. A regra vale <strong>dentro da categoria</strong>, só em grupos com pelo menos 8 documentos.
          {metodo === "iqr"
            ? " IQR: desvio se o valor sai de Q1 − 1,5×IQR ou Q3 + 1,5×IQR. Melhor padrão para valores financeiros assimétricos."
            : " Z-score: desvio se o valor dista 2,5 desvios-padrão da média da categoria. Mais sensível a um único título grande."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {regras.map((r) => (
            <Link
              key={r.id}
              href={hrefWith(raw, "/check", { tab: "outliers", regra: r.id })}
              className={cn("rounded-full border px-3 py-1 text-sm", metodo === r.id ? "border-cyan bg-cyan text-white" : "border-line bg-card")}
            >
              {r.label}
            </Link>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {nats.map((n) => (
            <Link
              key={n.label}
              href={hrefWith(raw, "/check", { tab: "outliers", nat: n.id })}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                (natureza ?? "") === (n.id ?? "") ? "border-cyan bg-cyan text-white" : "border-line bg-card"
              )}
            >
              {n.label}
            </Link>
          ))}
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi label="Títulos analisados" value={String(data.docs)} hint="Categorias com n ≥ 8" />
        <Kpi label="Categorias" value={String(data.categorias)} />
        <Kpi label="Desvios" value={String(data.outliers)} tone={data.outliers ? "loss" : "gain"} />
      </div>
      <Card>
        <p className="mb-2 text-sm font-semibold">Scatter por categoria</p>
        <ScatterOutliers points={data.pontos} />
      </Card>
      <DataTable
        headers={["Categoria", "Cliente", "Doc.", "NF", "Natureza", "Venc.", "Valor", metodo === "z" ? "Z-score" : "Faixa IQR"]}
        rows={data.rows.map((r) => [
          r.categoria,
          r.cliente,
          r.numero || "—",
          r.nf || "—",
          r.natureza === "R" ? "Receber" : "Pagar",
          formatDate(r.vencimento),
          money(r.valor),
          metodo === "z"
            ? r.zscore.toFixed(2)
            : `${money(r.limInf)} – ${money(r.limSup)}`,
        ])}
      />
    </div>
  );
}

async function CaixaCheck({ filter }: { filter?: DimFilter }) {
  const [omie, contas, saldo] = await Promise.all([getResumo(), getSaldoPorConta(filter), getSaldoAtual(filter)]);
  const omieSaldo = omie?.cc_saldo_total ?? 0;
  const ok = Math.abs(omieSaldo - saldo.saldo) < 0.05;
  return (
    <Card>
      <p className="mb-4 text-sm font-semibold">Check List Fluxo Caixa / Conta Corrente</p>
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs text-mist">Valor em conta (Omie / resumo)</p>
          <p className="text-2xl font-semibold">{money(omieSaldo)}</p>
        </div>
        <div>
          <p className="text-xs text-mist">Valor em conta (Costa Novaes BI)</p>
          <p className="text-2xl font-semibold">{money(saldo.saldo)}</p>
        </div>
      </div>
      <p className={ok ? "mb-3 text-gain" : "mb-3 text-loss"}>Diferença: {money(omieSaldo - saldo.saldo)}</p>
      <DataTable
        headers={["Conta", "Saldo BI", "Previsto"]}
        rows={contas.map((c) => [c.conta, money(c.saldo), money(c.previsto)])}
      />
    </Card>
  );
}
