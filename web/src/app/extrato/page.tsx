import { PageHeader } from "@/components/shell";
import { DataTable, Kpi } from "@/components/ui";
import { formatDate, money } from "@/lib/format";
import { getContas, getExtrato } from "@/lib/queries";

export default async function ExtratoPage() {
  const [contas, movimentos] = await Promise.all([getContas(), getExtrato(150)]);
  const saldo = contas.reduce((s, c) => s + Number(c.saldo), 0);

  return (
    <div>
      <PageHeader
        kicker="Bancos"
        title="Extrato e contas correntes"
        subtitle="Saldos por conta e os últimos lançamentos do ListarExtrato."
      />
      <section className="grid gap-4 md:grid-cols-2">
        <Kpi label="Saldo consolidado (última foto)" value={saldo} tone="gold" />
        <Kpi label="Contas ativas" value={String(contas.length)} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-serif text-xl">Contas</h2>
        <DataTable
          headers={["Conta", "Banco", "Tipo", "Saldo", "Previsto"]}
          rows={contas.map((c) => [c.descricao, c.banco || "—", c.tipo || "—", money(c.saldo), money(c.previsto)])}
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-serif text-xl">Movimentos recentes</h2>
        <DataTable
          headers={["Data", "Conta", "Descrição", "Categoria", "Situação", "Valor"]}
          rows={movimentos.map((m) => [
            formatDate(m.data_lancamento),
            m.conta,
            m.descricao,
            m.categoria || "—",
            m.situacao || "—",
            money(m.valor),
          ])}
        />
      </section>
    </div>
  );
}
