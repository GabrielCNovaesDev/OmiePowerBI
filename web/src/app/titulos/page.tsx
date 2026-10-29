import Link from "next/link";
import { PageHeader } from "@/components/shell";
import { Card, DataTable, Kpi, StatusPill } from "@/components/ui";
import { formatDate, money } from "@/lib/format";
import { cn } from "@/lib/format";
import { hrefWith, readParams } from "@/lib/params";
import { getTitulosDrill, type TituloRecorte } from "@/lib/queries";

const NATS = [
  { id: "", label: "Receber e pagar" },
  { id: "R", label: "A receber" },
  { id: "P", label: "A pagar" },
];

const RECORTES: Array<{ id: string; label: string }> = [
  { id: "aberto", label: "Em aberto" },
  { id: "hoje", label: "Vence hoje" },
  { id: "atraso", label: "Atrasados" },
  { id: "vencer", label: "A vencer" },
  { id: "todos", label: "Todos" },
];

function asRecorte(v: string | undefined): TituloRecorte | undefined {
  if (v === "hoje" || v === "atraso" || v === "vencer" || v === "aberto") return v;
  return undefined;
}

export default async function TitulosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { filter, raw } = await readParams(searchParams);
  const natRaw = Array.isArray(raw.nat) ? raw.nat[0] : raw.nat;
  const natureza = natRaw === "R" || natRaw === "P" ? natRaw : undefined;
  const recorteParam = Array.isArray(raw.recorte) ? raw.recorte[0] : raw.recorte;
  const status = Array.isArray(raw.status) ? raw.status[0] : raw.status;
  const recorte =
    recorteParam === "todos" ? undefined : asRecorte(recorteParam) ?? (status ? undefined : "aberto");
  const data = await getTitulosDrill({
    natureza,
    recorte: status ? undefined : recorte,
    status,
    filter,
    limit: 200,
  });

  const title =
    natureza === "R" ? "Lançamentos a receber" : natureza === "P" ? "Lançamentos a pagar" : "Lançamentos";

  return (
    <div className="space-y-4">
      <PageHeader
        kicker="Drill-through"
        title={title}
        subtitle="Detalhe dos títulos Omie a partir dos KPIs e das carteiras. Os valores vêm da carga, não dos prints de referência."
      />
      <div className="flex flex-wrap gap-2">
        {NATS.map((item) => (
          <Link
            key={item.id || "all"}
            href={hrefWith(raw, "/titulos", { nat: item.id || undefined })}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              (natureza ?? "") === item.id ? "border-cyan bg-cyan text-white" : "border-line bg-card"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {RECORTES.map((item) => (
          <Link
            key={item.id || "todos"}
            href={hrefWith(raw, "/titulos", { recorte: item.id, status: undefined })}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              !status && (recorteParam ?? "aberto") === item.id ? "border-cyan bg-cyan text-white" : "border-line bg-card"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Kpi label="Títulos neste recorte" value={String(data.total)} />
        <Kpi label="Valor em aberto" value={data.valorAberto} tone={natureza === "P" ? "pay" : "receive"} />
      </div>
      <Card padded={false}>
        <p className="px-4 py-3 text-sm font-semibold">
          Amostra de {data.rows.length} de {data.total} títulos
        </p>
        <DataTable
          headers={["Previsão", "Vencimento", "Cliente / Fornecedor", "Documento", "NF", "Categoria", "Conta", "Status", "Valor", "Aberto"]}
          rows={data.rows.map((t) => [
            formatDate(t.data_previsao ?? t.data_vencimento),
            formatDate(t.data_vencimento),
            t.razao_social || "—",
            t.numero_titulo || t.codigo_titulo_omie,
            t.nf || "—",
            t.descricao_categoria || "—",
            t.conta || "—",
            <StatusPill key={t.codigo_titulo_omie} status={t.status} />,
            money(t.valor_titulo),
            money(t.valor_aberto),
          ])}
        />
      </Card>
    </div>
  );
}
