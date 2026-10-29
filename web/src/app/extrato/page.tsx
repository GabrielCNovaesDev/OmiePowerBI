import { PageHeader } from "@/components/shell";
import { Card, DataTable, Kpi } from "@/components/ui";
import { formatDate, money } from "@/lib/format";
import { getContas, getExtrato } from "@/lib/queries";
import { readParams } from "@/lib/params";
import { BancoNome } from "@/components/marca";

export default async function ExtratoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { filter } = await readParams(searchParams);
  const [contas, movimentos] = await Promise.all([getContas(filter), getExtrato(150, filter)]);
  const saldo = contas.reduce((s, c) => s + Number(c.saldo), 0);

  return (
    <div className="space-y-4">
      <PageHeader kicker="Relatórios" title="Extrato e contas correntes" subtitle="Saldos e lançamentos do ListarExtrato Omie." />
      <div className="grid gap-4 md:grid-cols-2">
        <Kpi label="Saldo consolidado" value={saldo} />
        <Kpi label="Contas ativas" value={String(contas.length)} />
      </div>
      <Card padded={false}>
        <p className="px-4 py-3 text-sm font-semibold">Contas</p>
        <DataTable
          headers={["Conta", "Banco", "Tipo", "Saldo", "Previsto"]}
          rows={contas.map((c) => [<BancoNome key={c.codigo_cc_omie} codigo={c.codigo_banco} nome={c.descricao} />, c.banco || "—", c.tipo || "—", money(c.saldo), money(c.previsto)])}
        />
      </Card>
      <Card padded={false}>
        <p className="px-4 py-3 text-sm font-semibold">Movimentos recentes</p>
        <DataTable
          headers={["Data", "Conta", "Descrição", "Categoria", "Situação", "Valor"]}
          rows={movimentos.map((m, i) => [formatDate(m.data_lancamento), <BancoNome key={`c${i}`} codigo={m.codigo_banco} nome={m.conta} />, m.descricao, m.categoria || "—", m.situacao || "—", money(m.valor)])}
        />
      </Card>
    </div>
  );
}
