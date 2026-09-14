import { ComboCashflow } from "@/components/charts";
import { PageHeader } from "@/components/shell";
import { Card, DataTable, Signed } from "@/components/ui";
import { money } from "@/lib/format";
import { getSaldoEvolucaoMensal, getSaldoPorConta } from "@/lib/dash";
import { readParams } from "@/lib/params";

export default async function SaldoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { period, filter } = await readParams(searchParams);
  const [contas, evolucao] = await Promise.all([
    getSaldoPorConta(filter),
    getSaldoEvolucaoMensal(period.from, period.to, filter),
  ]);

  const months = [...new Set(evolucao.map((e) => e.mes))].sort();
  const totalByMonth = months.map((mes) => evolucao.filter((e) => e.mes === mes).reduce((s, e) => s + Number(e.saldo), 0));
  const labels = months.map((m) => m.slice(5));
  const byConta = new Map<string, number[]>();
  for (const row of evolucao) {
    const arr = byConta.get(row.conta) ?? months.map(() => 0);
    const idx = months.indexOf(row.mes);
    if (idx >= 0) arr[idx] = Number(row.saldo);
    byConta.set(row.conta, arr);
  }

  return (
    <div className="space-y-4">
      <PageHeader kicker="Dashboards" title="Saldo" subtitle={`Evolução das contas correntes · ${period.label}`} />
      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <Card>
          <p className="mb-3 text-sm font-semibold">Saldo total por conta corrente</p>
          <DataTable
            headers={["Conta", "Saldo"]}
            rows={contas.map((c) => [c.conta, <Signed key={c.conta} value={Number(c.saldo)} />])}
            footer={["Total", <Signed key="t" value={contas.reduce((s, c) => s + Number(c.saldo), 0)} />]}
          />
        </Card>
        <Card>
          <p className="mb-3 text-sm font-semibold">Evolução do saldo total em conta(s)</p>
          <ComboCashflow labels={labels} entradas={totalByMonth.map((v) => (v > 0 ? v : 0))} saidas={totalByMonth.map((v) => (v < 0 ? Math.abs(v) : 0))} saldo={totalByMonth} />
        </Card>
      </div>
      <Card padded={false}>
        <p className="px-4 py-3 text-sm font-semibold">Evolução do saldo total por conta corrente</p>
        <DataTable
          headers={["Conta corrente", ...labels, "Atual"]}
          rows={[...byConta.entries()].map(([conta, vals]) => [
            conta,
            ...vals.map((v, i) => <Signed key={`${conta}-${i}`} value={v} />),
            <Signed key={`${conta}-a`} value={vals[vals.length - 1] ?? 0} />,
          ])}
        />
      </Card>
      <Card>
        <p className="mb-3 text-sm font-semibold">Disponível (previsto + limite)</p>
        <DataTable
          headers={["Conta", "Saldo", "Previsto", "Disponível"]}
          rows={contas.map((c) => [c.conta, money(c.saldo), money(c.previsto), money(c.disponivel)])}
        />
      </Card>
    </div>
  );
}
