import Link from "next/link";
import { PageHeader } from "@/components/shell";
import { Flash } from "@/components/admin-ui";
import { Card } from "@/components/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { listAplicativos } from "@/lib/admin-data";
import { formatDateTime } from "@/lib/format";

export default async function AplicativosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const apps = await listAplicativos();
  const ok = typeof sp.ok === "string" ? sp.ok : undefined;
  const error = typeof sp.error === "string" ? sp.error : undefined;

  return (
    <div>
      <PageHeader
        kicker="Administração"
        title="Empresas Omie"
        subtitle="Cada App Key é uma empresa. O secret nunca aparece de novo depois de salvo."
      />
      <Flash ok={ok} error={error} />
      <div className="mb-4">
        <Link href="/admin/aplicativos/novo" className="rounded bg-cyan px-4 py-2 text-sm font-semibold text-white">
          Nova empresa
        </Link>
      </div>
      <Card padded={false}>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper text-[11px] uppercase tracking-wide text-mist">
            <tr>
              <th className="px-4 py-2">Apelido</th>
              <th className="px-4 py-2">Razão social</th>
              <th className="px-4 py-2">Ativa</th>
              <th className="px-4 py-2">Sync</th>
              <th className="px-4 py-2">Última carga</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2 font-medium">{a.apelido}</td>
                <td className="px-4 py-2 text-mist">{a.razao_social_cache || "—"}</td>
                <td className="px-4 py-2">{a.ativo ? "sim" : "não"}</td>
                <td className="px-4 py-2">{a.sync_habilitado ? "ligado" : "off"}</td>
                <td className="px-4 py-2 text-mist">{formatDateTime(a.ultima_sync_at)}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/admin/aplicativos/${a.id}`} className="text-cyan-2 hover:underline">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {!apps.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-mist">
                  Nenhuma empresa ainda. Clique em Nova empresa e cole as chaves da Omie.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
