import { DonutChart, HBarChart } from "@/components/charts";
import { PageHeader } from "@/components/shell";
import { Card, DataTable, Kpi, StatusPill } from "@/components/ui";
import { compactMoney, formatDate, money } from "@/lib/format";
import { getAgingBi, getAgingByDim } from "@/lib/dash";
import { getStatusBreakdown, getTitulos } from "@/lib/queries";

export default async function PagarPage() {
  const [atrasado, aVencer, catAtraso, fornAtraso, catVencer, fornVencer, titulos, status] = await Promise.all([
    getAgingBi("P", true),
    getAgingBi("P", false),
    getAgingByDim("P", true, "categoria"),
    getAgingByDim("P", true, "cliente"),
    getAgingByDim("P", false, "categoria"),
    getAgingByDim("P", false, "cliente"),
    getTitulos("P"),
    getStatusBreakdown("P"),
  ]);
  const totAtraso = atrasado.reduce((s, x) => s + Number(x.valor), 0);
  const totVencer = aVencer.reduce((s, x) => s + Number(x.valor), 0);

  return (
    <div className="space-y-6">
      <PageHeader kicker="Obrigações" title="Contas a pagar" subtitle="Gastos atrasados e a vencer, no layout do Business Indicator." />
      <section className="grid gap-4 md:grid-cols-2">
        <Kpi label="Gastos atrasados" value={totAtraso} tone="loss" />
        <Kpi label="Gastos a vencer" value={totVencer} tone="pay" />
      </section>
      <AgingBlock title="4.1 Gastos atrasados" total={totAtraso} aging={atrasado} categorias={catAtraso} pessoas={fornAtraso} color="#e07a3a" />
      <AgingBlock title="4.2 Gastos a vencer" total={totVencer} aging={aVencer} categorias={catVencer} pessoas={fornVencer} color="#e06a6a" />
      <Card>
        <p className="mb-3 text-sm font-semibold">Por status</p>
        <DataTable
          headers={["Status", "Qtd", "Valor aberto"]}
          rows={status.map((s) => [<StatusPill key={s.status} status={s.status} />, String(s.qtd), money(s.valor)])}
        />
      </Card>
      <Card padded={false}>
        <p className="px-4 py-3 text-sm font-semibold">Títulos</p>
        <DataTable
          headers={["Vencimento", "Fornecedor", "Documento", "Categoria", "Status", "Valor", "Aberto"]}
          rows={titulos.map((t) => [
            formatDate(t.data_vencimento),
            t.razao_social || "—",
            t.numero_titulo || t.codigo_titulo_omie,
            t.descricao_categoria || "—",
            <StatusPill key={t.codigo_titulo_omie} status={t.status} />,
            money(t.valor_titulo),
            money(t.valor_aberto),
          ])}
        />
      </Card>
    </div>
  );
}

function AgingBlock({
  title,
  total,
  aging,
  categorias,
  pessoas,
  color,
}: {
  title: string;
  total: number;
  aging: Array<{ faixa: string; valor: number }>;
  categorias: Array<{ nome: string; valor: number }>;
  pessoas: Array<{ nome: string; valor: number }>;
  color: string;
}) {
  return (
    <div>
      <div className="mb-3 rounded bg-cyan px-4 py-2 text-sm font-semibold text-white">{title}</div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <p className="mb-2 text-sm font-semibold">Por intervalo de tempo (dias)</p>
          <DonutChart data={aging.map((a) => ({ name: a.faixa, value: Number(a.valor) }))} center={compactMoney(total)} colors={[color, "#f0b429", "#c05621", "#9b2c2c"]} />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">Por categoria</p>
          <HBarChart data={categorias.map((c) => ({ name: c.nome, value: Number(c.valor) }))} color={color} />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">Por fornecedor</p>
          <HBarChart data={pessoas.map((c) => ({ name: c.nome, value: Number(c.valor) }))} color={color} />
        </Card>
      </div>
    </div>
  );
}
