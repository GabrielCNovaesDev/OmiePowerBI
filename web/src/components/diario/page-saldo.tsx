import { ComboCashflow } from "@/components/charts";
import type { DiarioCtx } from "@/components/diario/ctx";
import { Card, DataTable, Signed } from "@/components/ui";
import { money } from "@/lib/format";
import { getSaldoEvolucaoMensal, getSaldoPorConta } from "@/lib/dash";
import { BancoNome } from "@/components/marca";

export async function DiarioSaldo({ ctx }: { ctx: DiarioCtx }) {
  const { yearFrom, today, filter } = ctx;
  const [contas, evolucao] = await Promise.all([
    getSaldoPorConta(filter),
    getSaldoEvolucaoMensal(yearFrom, today, filter),
  ]);
  const months = [...new Set(evolucao.map((e) => e.mes))].sort();
  const totalByMonth = months.map((mes) => evolucao.filter((e) => e.mes === mes).reduce((s, e) => s + Number(e.saldo), 0));
  const labels = months.map((m) => m.slice(5));
  const byConta = new Map<string, number[]>();
  const bancoDaConta = new Map<string, string | null>(contas.map((c) => [c.conta, c.codigo_banco]));
  for (const row of evolucao) {
    if (!bancoDaConta.has(row.conta)) bancoDaConta.set(row.conta, row.codigo_banco);
    const arr = byConta.get(row.conta) ?? months.map(() => 0);
    const idx = months.indexOf(row.mes);
    if (idx >= 0) arr[idx] = Number(row.saldo);
    byConta.set(row.conta, arr);
  }
  const total = contas.reduce((s, c) => s + Number(c.saldo), 0);

  return (
    <>
      <div className="rounded bg-cyan px-4 py-2 text-sm font-semibold text-white">Saldo e contas</div>
      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <Card>
          <p className="mb-3 text-sm font-semibold">Saldo total por conta corrente</p>
          <DataTable
            headers={["Conta", "Saldo"]}
            rows={contas.map((c) => [<BancoNome key={c.conta} codigo={c.codigo_banco} nome={c.conta} />, <Signed key={`s-${c.conta}`} value={Number(c.saldo)} />])}
            footer={["Total", <Signed key="t" value={total} />]}
          />
        </Card>
        <Card>
          <p className="mb-3 text-sm font-semibold">Evolução do saldo no ano corrente</p>
          <ComboCashflow
            labels={labels}
            entradas={totalByMonth.map((v) => (v > 0 ? v : 0))}
            saidas={totalByMonth.map((v) => (v < 0 ? Math.abs(v) : 0))}
            saldo={totalByMonth}
          />
        </Card>
      </div>
      <Card padded={false}>
        <p className="px-4 py-3 text-sm font-semibold">Evolução do saldo por conta corrente</p>
        <DataTable
          headers={["Conta corrente", ...labels, "Atual"]}
          rows={[...byConta.entries()].map(([conta, vals]) => [
            <BancoNome key={conta} codigo={bancoDaConta.get(conta)} nome={conta} />,
            ...vals.map((v, i) => <Signed key={`${conta}-${i}`} value={v} />),
            <Signed key={`${conta}-a`} value={vals[vals.length - 1] ?? 0} />,
          ])}
        />
      </Card>
      <Card>
        <p className="mb-3 text-sm font-semibold">Disponível (previsto + limite)</p>
        <DataTable
          headers={["Conta", "Saldo", "Previsto", "Disponível"]}
          rows={contas.map((c) => [<BancoNome key={c.conta} codigo={c.codigo_banco} nome={c.conta} />, money(c.saldo), money(c.previsto), money(c.disponivel)])}
        />
      </Card>
    </>
  );
}
