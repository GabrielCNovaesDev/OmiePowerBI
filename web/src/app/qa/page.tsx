import { barrasComLogo } from "@/lib/marcas";
import { ClienteNome } from "@/components/marca";
import { HBarChart } from "@/components/charts";
import { PageHeader } from "@/components/shell";
import { Card } from "@/components/ui";
import { money } from "@/lib/format";
import { getQaClientes } from "@/lib/dash";
import { readParams } from "@/lib/params";

export default async function QaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { period, filter } = await readParams(searchParams);
  const qa = await getQaClientes(period.from, period.to, filter);

  return (
    <div className="space-y-4">
      <PageHeader kicker="Dashboards" title="Q&A" subtitle="Maiores e menores receitas por cliente, e variação contra o mesmo período do ano anterior." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <p className="mb-2 text-sm font-semibold text-gain">Fatores positivos · maiores receitas</p>
          <HBarChart data={barrasComLogo(qa.top)} color="#2f9e6b" />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold text-loss">Fatores negativos · menores receitas</p>
          <HBarChart data={barrasComLogo(qa.bottom)} color="#e06a6a" />
        </Card>
        <Card>
          <p className="mb-3 text-sm font-semibold">Maiores crescimentos vs ano anterior</p>
          <ul className="space-y-1 text-sm">
            {qa.growthTop.map((x) => (
              <li key={x.nome} className="flex justify-between gap-3 border-b border-line py-1">
                <ClienteNome cnpj={x.cnpj} nome={x.nome} />
                <span className="text-gain">
                  {money(x.valor)} · {x.growth.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <p className="mb-3 text-sm font-semibold">Menores crescimentos vs ano anterior</p>
          <ul className="space-y-1 text-sm">
            {qa.growthBottom.map((x) => (
              <li key={x.nome} className="flex justify-between gap-3 border-b border-line py-1">
                <ClienteNome cnpj={x.cnpj} nome={x.nome} />
                <span className="text-loss">
                  {money(x.valor)} · {x.growth.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
