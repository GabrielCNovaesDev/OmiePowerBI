import { AgingChart } from "@/components/charts";
import { PageHeader } from "@/components/shell";
import { DataTable, Kpi, StatusPill } from "@/components/ui";
import { formatDate, money } from "@/lib/format";
import { getAging, getRanking, getStatusBreakdown, getTitulos } from "@/lib/queries";

export default async function ReceberPage() {
  const [aging, ranking, titulos, status] = await Promise.all([
    getAging("R"),
    getRanking("R"),
    getTitulos("R"),
    getStatusBreakdown("R"),
  ]);
  const aberto = aging.reduce((s, r) => s + Number(r.valor), 0);
  const atrasado = aging.filter((a) => a.faixa !== "0_a_vencer").reduce((s, r) => s + Number(r.valor), 0);

  return (
    <div>
      <PageHeader
        kicker="Contas a receber"
        title="Carteira de clientes"
        subtitle="Aging, ranking de inadimplência e detalhe dos títulos puxados do Omie."
      />
      <section className="grid gap-4 md:grid-cols-3">
        <Kpi label="Carteira aberta" value={aberto} tone="gain" />
        <Kpi label="Em atraso" value={atrasado} tone="loss" />
        <Kpi label="Títulos listados" value={String(titulos.length)} />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-5">
          <h2 className="mb-3 font-serif text-xl">Aging</h2>
          <AgingChart data={aging.map((r) => ({ faixa: r.faixa, valor: Number(r.valor) }))} />
        </div>
        <div>
          <h2 className="mb-3 font-serif text-xl">Ranking de clientes</h2>
          <DataTable
            headers={["Cliente", "Títulos", "Aberto"]}
            rows={ranking.map((r) => [r.razao_social, String(r.qtd), money(r.valor)])}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-serif text-xl">Por status</h2>
        <DataTable
          headers={["Status", "Qtd", "Valor aberto"]}
          rows={status.map((s) => [<StatusPill key={s.status} status={s.status} />, String(s.qtd), money(s.valor)])}
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-serif text-xl">Títulos</h2>
        <DataTable
          headers={["Vencimento", "Cliente", "Documento", "Categoria", "Status", "Valor", "Aberto"]}
          rows={titulos.map((t) => [
            formatDate(t.data_vencimento),
            t.razao_social || "—",
            t.numero_titulo || t.codigo_titulo_omie,
            t.descricao_categoria || t.codigo_categoria || "—",
            <StatusPill key={t.codigo_titulo_omie} status={t.status} />,
            money(t.valor_titulo),
            money(t.valor_aberto),
          ])}
        />
      </section>
    </div>
  );
}
