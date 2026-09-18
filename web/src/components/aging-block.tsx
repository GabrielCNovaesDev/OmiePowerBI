import { DonutChart, HBarChart } from "@/components/charts";
import { Card } from "@/components/ui";
import { compactMoney } from "@/lib/format";

export function AgingBlock({
  title,
  total,
  aging,
  categorias,
  pessoas,
  color,
  pessoaLabel = "Por cliente",
  banner = true,
}: {
  title: string;
  total: number;
  aging: Array<{ faixa: string; valor: number }>;
  categorias: Array<{ nome: string; valor: number }>;
  pessoas: Array<{ nome: string; valor: number }>;
  color: string;
  pessoaLabel?: string;
  banner?: boolean;
}) {
  return (
    <div>
      {banner ? (
        <div className="mb-3 rounded bg-cyan px-4 py-2 text-sm font-semibold text-white">{title}</div>
      ) : (
        <p className="mb-2 text-sm font-medium">{title}</p>
      )}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <p className="mb-2 text-sm font-semibold">Por intervalo de tempo (dias)</p>
          <DonutChart
            data={aging.map((a) => ({ name: a.faixa, value: Number(a.valor) }))}
            center={compactMoney(total)}
            colors={[color, "#f0b429", "#c05621", "#9b2c2c", "#4ea3d9"]}
          />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">Por categoria</p>
          <HBarChart data={categorias.map((c) => ({ name: c.nome, value: Number(c.valor) }))} color={color} />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">{pessoaLabel}</p>
          <HBarChart data={pessoas.map((c) => ({ name: c.nome, value: Number(c.valor) }))} color={color} />
        </Card>
      </div>
    </div>
  );
}
