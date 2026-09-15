import { PageHeader } from "@/components/shell";
import { DataTable, Kpi } from "@/components/ui";
import { formatDateTime, money, n } from "@/lib/format";
import { getSyncHealth } from "@/lib/queries";
import { readParams } from "@/lib/params";

export default async function SyncPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { filter } = await readParams(searchParams);
  const { logs, rec, counts } = await getSyncHealth(filter);
  const divergencias = rec.filter((r) => r.toleravel === false);

  return (
    <div className="space-y-4">
      <PageHeader kicker="Relatórios" title="Qualidade e sync" subtitle="Conferência entre o Resumo Omie e os fatos no Postgres." />
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Clientes" value={String(n(counts.clientes))} compact />
        <Kpi label="Categorias" value={String(n(counts.categorias))} compact />
        <Kpi label="Contas" value={String(n(counts.contas))} compact />
        <Kpi label="Títulos" value={String(n(counts.titulos))} compact />
        <Kpi label="Baixas" value={String(n(counts.baixas))} compact />
        <Kpi label="Extrato" value={String(n(counts.extrato))} compact />
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Reconciliação</h2>
        <p className="mb-3 text-sm text-mist">
          {divergencias.length
            ? `${divergencias.length} métrica(s) fora da tolerância de R$ 0,01.`
            : "Nenhuma divergência acima de R$ 0,01 — ou a carga ainda não rodou o passo de conferência."}
        </p>
        <DataTable
          headers={["Métrica", "Omie", "BI", "Diferença", "Ok"]}
          rows={rec.map((r) => [String(r.metrica), money(n(r.valor_omie)), money(n(r.valor_bi)), money(n(r.diferenca)), r.toleravel ? "sim" : "não"])}
        />
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Log de sincronização</h2>
        <DataTable
          headers={["Método", "Status", "Registros", "Páginas", "Duração", "Fim", "Erro"]}
          rows={logs.map((l) => [
            String(l.metodo),
            String(l.status),
            String(l.registros_total ?? "—"),
            String(l.paginas_total ?? "—"),
            l.duracao_ms != null ? `${Math.round(Number(l.duracao_ms) / 1000)}s` : "—",
            formatDateTime(l.finished_at ? String(l.finished_at) : null),
            l.erro_mensagem ? String(l.erro_mensagem).slice(0, 80) : "—",
          ])}
        />
      </section>
    </div>
  );
}
