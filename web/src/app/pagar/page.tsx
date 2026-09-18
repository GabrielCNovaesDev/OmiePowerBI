import Link from "next/link";
import { AgingBlock } from "@/components/aging-block";
import { PageHeader } from "@/components/shell";
import { Card, DataTable, Kpi, StatusPill } from "@/components/ui";
import { formatDate, money } from "@/lib/format";
import { getAgingBi, getAgingByDim } from "@/lib/dash";
import { getStatusBreakdown, getTitulos } from "@/lib/queries";
import { hrefWith, readParams } from "@/lib/params";

export default async function PagarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { filter, raw } = await readParams(searchParams);
  const [atrasado, aVencer, catAtraso, fornAtraso, catVencer, fornVencer, titulos, status] = await Promise.all([
    getAgingBi("P", true, filter),
    getAgingBi("P", false, filter),
    getAgingByDim("P", true, "categoria", filter),
    getAgingByDim("P", true, "cliente", filter),
    getAgingByDim("P", false, "categoria", filter),
    getAgingByDim("P", false, "cliente", filter),
    getTitulos("P", 80, filter),
    getStatusBreakdown("P", filter),
  ]);
  const totAtraso = atrasado.reduce((s, x) => s + Number(x.valor), 0);
  const totVencer = aVencer.reduce((s, x) => s + Number(x.valor), 0);

  return (
    <div className="space-y-6">
      <PageHeader kicker="Obrigações" title="Contas a pagar" subtitle="Gastos atrasados e a vencer, no layout do Business Indicator." />
      <section className="grid gap-4 md:grid-cols-2">
        <Kpi label="Gastos atrasados" value={totAtraso} tone="loss" href={hrefWith(raw, "/titulos", { nat: "P", recorte: "atraso" })} />
        <Kpi label="Gastos a vencer" value={totVencer} tone="pay" href={hrefWith(raw, "/titulos", { nat: "P", recorte: "vencer" })} />
      </section>
      <AgingBlock title="4.1 Gastos atrasados" total={totAtraso} aging={atrasado} categorias={catAtraso} pessoas={fornAtraso} color="#e07a3a" pessoaLabel="Por fornecedor" />
      <AgingBlock title="4.2 Gastos a vencer" total={totVencer} aging={aVencer} categorias={catVencer} pessoas={fornVencer} color="#e06a6a" pessoaLabel="Por fornecedor" />
      <Card>
        <p className="mb-3 text-sm font-semibold">Por status</p>
        <DataTable
          headers={["Status", "Qtd", "Valor aberto"]}
          rows={status.map((s) => [
            <Link key={s.status} href={hrefWith(raw, "/titulos", { nat: "P", recorte: "todos", status: s.status })} className="hover:underline">
              <StatusPill status={s.status} />
            </Link>,
            String(s.qtd),
            money(s.valor),
          ])}
        />
      </Card>
      <Card padded={false}>
        <p className="px-4 py-3 text-sm font-semibold">
          Títulos{" "}
          <Link href={hrefWith(raw, "/titulos", { nat: "P", recorte: "aberto" })} className="ml-2 text-xs font-normal text-cyan hover:underline">
            ver lançamentos
          </Link>
        </p>
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
