import { PageHeader } from "@/components/shell";
import { Card, DataTable, Dot, Standby } from "@/components/ui";
import { money } from "@/lib/format";
import { getBlankDocs, getCheckPanel, getSaldoAtual, getSaldoPorConta } from "@/lib/dash";
import { getResumo } from "@/lib/queries";
import { readParams } from "@/lib/params";
import { cn } from "@/lib/format";
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
  const { period } = await readParams(searchParams);
  const sp = await searchParams;
  const tab = (Array.isArray(sp.tab) ? sp.tab[0] : sp.tab) || "status";
  const blank = (Array.isArray(sp.blank) ? sp.blank[0] : sp.blank) || "projetos";
  const items = await getCheckPanel(period.from, period.to);

  return (
    <div className="space-y-4">
      <PageHeader kicker="Relatórios" title="Check Panel" subtitle="Diagnóstico de cadastro e desvios entre Omie e o BI." />
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/check?tab=${t.id}`}
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
        <BlankTab periodFrom={period.from} periodTo={period.to} field={blank} />
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

      {tab === "caixa" ? <CaixaCheck /> : null}

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
        <Standby title="Análise de desvios (outliers)" reason="O print mostra o scatter por categoria, mas não o critério estatístico. Fica em standby até fecharmos a regra (z-score / IQR)." />
      ) : null}
    </div>
  );
}

async function BlankTab({
  periodFrom,
  periodTo,
  field,
}: {
  periodFrom: string;
  periodTo: string;
  field: string;
}) {
  const key = ["projetos", "clientes", "categorias", "departamentos", "nfs"].includes(field)
    ? (field as "projetos" | "clientes" | "categorias" | "departamentos" | "nfs")
    : "projetos";
  const rows = await getBlankDocs(periodFrom, periodTo, key);
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
          <Link key={p.id} href={`/check?tab=branco&blank=${p.id}`} className={cn("rounded-full border px-3 py-1 text-sm", key === p.id ? "border-cyan bg-cyan text-white" : "border-line bg-card")}>
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

async function CaixaCheck() {
  const [omie, contas, saldo] = await Promise.all([getResumo(), getSaldoPorConta(), getSaldoAtual()]);
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
          <p className="text-xs text-mist">Valor em conta (Nexo BI)</p>
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
