import Link from "next/link";
import { AgingBlock } from "@/components/aging-block";
import type { DiarioCtx } from "@/components/diario/ctx";
import { Card, DataTable, Kpi, StatusPill } from "@/components/ui";
import { formatDate, money } from "@/lib/format";
import { getAgingBi, getAgingByDim } from "@/lib/dash";
import { hrefWith } from "@/lib/params";
import { getTitulosDrill } from "@/lib/queries";

export async function DiarioCarteira({
  ctx,
  natureza,
  atrasado,
}: {
  ctx: DiarioCtx;
  natureza: "R" | "P";
  atrasado: boolean;
}) {
  const recorte = atrasado ? "atraso" : "vencer";
  const pessoaLabel = natureza === "R" ? "Por cliente" : "Por fornecedor";
  const title =
    natureza === "R"
      ? atrasado
        ? "Receitas atrasadas"
        : "Receitas a vencer"
      : atrasado
        ? "Gastos atrasados"
        : "Gastos a vencer";
  const color = atrasado ? "#e07a3a" : natureza === "R" ? "#4ea3d9" : "#e06a6a";
  const tone = atrasado ? "loss" : natureza === "R" ? "receive" : "pay";

  const [aging, cat, pes, drill] = await Promise.all([
    getAgingBi(natureza, atrasado, ctx.filter),
    getAgingByDim(natureza, atrasado, "categoria", ctx.filter),
    getAgingByDim(natureza, atrasado, "cliente", ctx.filter),
    getTitulosDrill({ natureza, recorte, filter: ctx.filter, limit: 40 }),
  ]);
  const total = aging.reduce((s, x) => s + Number(x.valor), 0);

  return (
    <>
      <Kpi label={title} value={total} tone={tone} href={hrefWith(ctx.raw, "/titulos", { nat: natureza, recorte })} />
      <AgingBlock title={title} total={total} aging={aging} categorias={cat} pessoas={pes} color={color} pessoaLabel={pessoaLabel} />
      <Card padded={false}>
        <p className="px-4 py-3 text-sm font-semibold">
          Títulos{" "}
          <Link href={hrefWith(ctx.raw, "/titulos", { nat: natureza, recorte })} className="ml-2 text-xs font-normal text-cyan hover:underline">
            ver lançamentos
          </Link>
        </p>
        <DataTable
          headers={["Previsão", "Vencimento", natureza === "R" ? "Cliente" : "Fornecedor", "Documento", "Categoria", "Status", "Aberto"]}
          rows={drill.rows.map((t) => [
            formatDate(t.data_previsao ?? t.data_vencimento),
            formatDate(t.data_vencimento),
            t.razao_social || "—",
            t.numero_titulo || t.codigo_titulo_omie,
            t.descricao_categoria || "—",
            <StatusPill key={t.codigo_titulo_omie} status={t.status} />,
            money(t.valor_aberto),
          ])}
        />
      </Card>
    </>
  );
}
