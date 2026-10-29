import Link from "next/link";
import { AgingBlock } from "@/components/aging-block";
import { PageHeader } from "@/components/shell";
import { Card, DataTable, Kpi, StatusPill } from "@/components/ui";
import { formatDate, money } from "@/lib/format";
import { getAgingBi, getAgingByDim } from "@/lib/dash";
import { getStatusBreakdown, getTitulos } from "@/lib/queries";
import { hrefWith, readParams } from "@/lib/params";

export default async function ReceberPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { filter, raw } = await readParams(searchParams);
  const [atrasado, aVencer, catAtraso, cliAtraso, catVencer, cliVencer, titulos, status] = await Promise.all([
    getAgingBi("R", true, filter),
    getAgingBi("R", false, filter),
    getAgingByDim("R", true, "categoria", filter),
    getAgingByDim("R", true, "cliente", filter),
    getAgingByDim("R", false, "categoria", filter),
    getAgingByDim("R", false, "cliente", filter),
    getTitulos("R", 80, filter),
    getStatusBreakdown("R", filter),
  ]);
  const totAtraso = atrasado.reduce((s, x) => s + Number(x.valor), 0);
  const totVencer = aVencer.reduce((s, x) => s + Number(x.valor), 0);

  return (
    <div className="space-y-6">
      <PageHeader kicker="Carteira" title="Contas a receber" subtitle="Aging no recorte do Business Indicator, com dados da sua base Omie." />
      <section className="grid gap-4 md:grid-cols-2">
        <Kpi label="Receitas atrasadas" value={totAtraso} tone="loss" href={hrefWith(raw, "/titulos", { nat: "R", recorte: "atraso" })} />
        <Kpi label="Receitas a vencer" value={totVencer} tone="receive" href={hrefWith(raw, "/titulos", { nat: "R", recorte: "vencer" })} />
      </section>

      <AgingBlock
        title="3.1 Receitas atrasadas"
        total={totAtraso}
        aging={atrasado}
        categorias={catAtraso}
        pessoas={cliAtraso}
        color="#e07a3a"
      />
      <AgingBlock
        title="3.2 Receitas a vencer"
        total={totVencer}
        aging={aVencer}
        categorias={catVencer}
        pessoas={cliVencer}
        color="#4ea3d9"
      />

      <Card>
        <p className="mb-3 text-sm font-semibold">Por status</p>
        <DataTable
          headers={["Status", "Qtd", "Valor aberto"]}
          rows={status.map((s) => [
            <Link key={s.status} href={hrefWith(raw, "/titulos", { nat: "R", recorte: "todos", status: s.status })} className="hover:underline">
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
          <Link href={hrefWith(raw, "/titulos", { nat: "R", recorte: "aberto" })} className="ml-2 text-xs font-normal text-cyan hover:underline">
            ver lançamentos
          </Link>
        </p>
        <DataTable
          headers={["Previsão", "Vencimento", "Cliente", "Documento", "Categoria", "Status", "Valor", "Aberto"]}
          rows={titulos.map((t) => [
            formatDate(t.data_previsao ?? t.data_vencimento),
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
