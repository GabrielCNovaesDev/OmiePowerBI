import { DonutChart, HBarChart } from "@/components/charts";
import { Card, DataTable } from "@/components/ui";
import { compactMoney, money } from "@/lib/format";
import type { NamedValue } from "@/lib/dash";

export function BreakdownGrid({
  total,
  cnpj,
  status,
  uf,
  pessoas,
  categorias,
  projetos,
  pessoaLabel,
}: {
  total: number;
  cnpj: NamedValue[];
  status: NamedValue[];
  uf: NamedValue[];
  pessoas: NamedValue[];
  categorias: NamedValue[];
  projetos: NamedValue[];
  pessoaLabel: string;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card>
        <p className="mb-2 text-sm font-semibold">Por CNPJ</p>
        <DonutChart data={cnpj.map((x) => ({ name: x.nome, value: Number(x.valor) }))} center={compactMoney(total)} />
      </Card>
      <Card>
        <p className="mb-2 text-sm font-semibold">Por status</p>
        <DonutChart
          data={status.map((x) => ({ name: x.nome, value: Number(x.valor) }))}
          colors={["#2f9e6b", "#e3b341", "#e06a6a", "#4ea3d9"]}
        />
      </Card>
      <Card>
        <p className="mb-2 text-sm font-semibold">Por estado</p>
        <DataTable
          headers={["Estado", "Valor", "%"]}
          rows={uf.map((x) => [
            x.nome,
            money(x.valor),
            total ? `${((Number(x.valor) / total) * 100).toFixed(2)}%` : "—",
          ])}
          footer={["Total", money(total), "100%"]}
        />
      </Card>
      <Card>
        <p className="mb-2 text-sm font-semibold">{pessoaLabel}</p>
        <HBarChart data={pessoas.map((x) => ({ name: x.nome, value: Number(x.valor) }))} color="#4a5568" />
      </Card>
      <Card>
        <p className="mb-2 text-sm font-semibold">Por categoria</p>
        <HBarChart data={categorias.map((x) => ({ name: x.nome, value: Number(x.valor) }))} color="#4a5568" />
      </Card>
      <Card>
        <p className="mb-2 text-sm font-semibold">Por projeto</p>
        <HBarChart data={projetos.map((x) => ({ name: x.nome, value: Number(x.valor) }))} color="#a0aec0" />
      </Card>
    </div>
  );
}
