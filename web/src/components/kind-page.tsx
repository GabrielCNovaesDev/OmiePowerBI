import { BreakdownGrid } from "@/components/breakdown";
import { PageHeader } from "@/components/shell";
import { getBreakdown, type Kind } from "@/lib/dash";
import { readParams } from "@/lib/params";
import { compactMoney } from "@/lib/format";

const COPY: Record<Kind, { title: string; pessoa: string }> = {
  receita: { title: "Receitas", pessoa: "Receita bruta por cliente" },
  custo: { title: "Custos", pessoa: "Custos por fornecedor" },
  despesa: { title: "Despesas", pessoa: "Despesas por fornecedor" },
};

export default async function KindPage({
  kind,
  searchParams,
}: {
  kind: Kind;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { period, base, filter } = await readParams(searchParams);
  const data = await getBreakdown(kind, period.from, period.to, base, filter);
  const copy = COPY[kind];
  return (
    <div className="space-y-4">
      <PageHeader
        kicker="Dashboards"
        title={copy.title}
        subtitle={`${compactMoney(data.total)} · ${period.label} · base ${base === "caixa" ? "caixa" : "competência"}`}
      />
      <BreakdownGrid
        total={data.total}
        cnpj={data.cnpj}
        status={data.status}
        uf={data.uf}
        pessoas={data.clientes}
        categorias={data.categorias}
        projetos={data.projetos}
        pessoaLabel={copy.pessoa}
      />
    </div>
  );
}
