import { Flash } from "@/components/admin-ui";
import { PageHeader } from "@/components/shell";
import { Card } from "@/components/ui";
import { requestSync } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin-auth";
import { listAplicativos, listSyncJobs } from "@/lib/admin-data";
import { githubSyncConfigured } from "@/lib/github-sync";
import { formatDateTime } from "@/lib/format";

export default async function SyncAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const [apps, jobs] = await Promise.all([listAplicativos(), listSyncJobs(40)]);
  const github = githubSyncConfigured();

  return (
    <div className="space-y-5">
      <PageHeader
        kicker="Administração"
        title="Atualização dos dados"
        subtitle="A madrugada (03:00 de Brasília) atualiza todas as empresas com sync ligado. Por aqui você dispara na hora."
      />
      <Flash
        ok={typeof sp.ok === "string" ? sp.ok : undefined}
        error={typeof sp.error === "string" ? sp.error : undefined}
      />
      <Card>
        <p className="text-sm text-mist">
          {github
            ? "A carga roda no GitHub Actions (pode levar vários minutos). Acompanhe em Actions no repositório."
            : "Falta o token GitHub na Vercel (SYNC_GITHUB_TOKEN). Sem ele, o botão só registra o pedido. A carga da madrugada também usa o Action do repositório, com os secrets DATABASE_URL e APP_ENCRYPTION_KEY."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={requestSync}>
            <button type="submit" className="rounded bg-cyan px-4 py-2 text-sm font-semibold text-white">
              Atualizar todas agora
            </button>
          </form>
          {apps
            .filter((a) => a.ativo)
            .map((a) => (
              <form action={requestSync} key={a.id}>
                <input type="hidden" name="app_key" value={a.app_key} />
                <button type="submit" className="rounded border border-line px-3 py-2 text-sm hover:border-cyan">
                  Atualizar {a.apelido}
                </button>
              </form>
            ))}
        </div>
      </Card>
      <Card padded={false}>
        <h2 className="border-b border-line px-4 py-3 font-semibold">Pedidos recentes</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper text-[11px] uppercase tracking-wide text-mist">
            <tr>
              <th className="px-4 py-2">Quando</th>
              <th className="px-4 py-2">Empresa</th>
              <th className="px-4 py-2">Origem</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Quem</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2">{formatDateTime(j.created_at)}</td>
                <td className="px-4 py-2">{j.apelido || j.app_key || "Todas"}</td>
                <td className="px-4 py-2">{j.origem}</td>
                <td className="px-4 py-2">{j.status}{j.erro ? ` — ${j.erro.slice(0, 80)}` : ""}</td>
                <td className="px-4 py-2 text-mist">{j.email || "—"}</td>
              </tr>
            ))}
            {!jobs.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-mist">
                  Nenhum pedido ainda.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
