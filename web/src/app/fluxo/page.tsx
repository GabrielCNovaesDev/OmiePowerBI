import { CashflowChart, ProjectionChart } from "@/components/charts";
import { PageHeader } from "@/components/shell";
import { DataTable, Kpi } from "@/components/ui";
import { formatDate, money } from "@/lib/format";
import { getFluxoMensal, getFluxoPorCategoria, getFluxoProjetado } from "@/lib/queries";

export default async function FluxoPage() {
  const [monthly, projetado, categorias] = await Promise.all([
    getFluxoMensal(12),
    getFluxoProjetado(),
    getFluxoPorCategoria(),
  ]);

  const byDay = new Map<string, { dia: string; receber: number; pagar: number }>();
  for (const row of projetado) {
    const key = row.data.slice(0, 10);
    const current = byDay.get(key) || { dia: formatDate(row.data), receber: 0, pagar: 0 };
    if (row.natureza === "R") current.receber += Number(row.valor);
    if (row.natureza === "P") current.pagar += Number(row.valor);
    byDay.set(key, current);
  }
  const projection = [...byDay.values()].slice(0, 45);
  const rec30 = projection.reduce((s, d) => s + d.receber, 0);
  const pag30 = projection.reduce((s, d) => s + d.pagar, 0);

  return (
    <div>
      <PageHeader
        kicker="Fluxo de caixa"
        title="Realizado e projetado"
        subtitle="Baixas no passado, títulos em aberto no futuro, quebrado por categoria Omie."
      />
      <section className="grid gap-4 md:grid-cols-3">
        <Kpi label="Projetado a entrar (45d)" value={rec30} tone="gain" />
        <Kpi label="Projetado a sair (45d)" value={pag30} tone="loss" />
        <Kpi label="Líquido projetado" value={rec30 - pag30} tone={rec30 - pag30 >= 0 ? "gain" : "loss"} />
      </section>

      <section className="mt-8 rounded-xl border border-line bg-panel p-5">
        <h2 className="mb-3 font-serif text-xl">Realizado por mês</h2>
        <CashflowChart data={monthly} />
      </section>

      <section className="mt-8 rounded-xl border border-line bg-panel p-5">
        <h2 className="mb-3 font-serif text-xl">Projeção por dia</h2>
        <ProjectionChart data={projection} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-serif text-xl">Aberto por categoria</h2>
        <DataTable
          headers={["Categoria", "A receber", "A pagar"]}
          rows={categorias.map((c) => [`${c.codigo} · ${c.descricao}`, money(c.receber), money(c.pagar)])}
        />
      </section>
    </div>
  );
}
