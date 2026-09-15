import { PageHeader } from "@/components/shell";
import { Card, Kpi } from "@/components/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { listAplicativos, listUsuarios, listSyncJobs } from "@/lib/admin-data";
import { githubSyncConfigured } from "@/lib/github-sync";
import Link from "next/link";

export default async function AdminHome() {
  await requireAdmin();
  const [apps, users, jobs] = await Promise.all([listAplicativos(), listUsuarios(), listSyncJobs(5)]);
  const github = githubSyncConfigured();

  return (
    <div className="space-y-5">
      <PageHeader
        kicker="Administração"
        title="Painel da plataforma"
        subtitle="Cadastre empresas Omie, usuários e dispare atualizações por aqui. Sem terminal."
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Empresas" value={String(apps.length)} compact href="/admin/aplicativos" />
        <Kpi label="Usuários" value={String(users.length)} compact href="/admin/usuarios" />
        <Kpi label="Carga GitHub" value={github ? "ligada" : "pendente"} compact href="/admin/sync" />
      </section>
      <Card>
        <h2 className="font-semibold">Começar</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-mist">
          <li>
            <Link href="/admin/aplicativos/novo" className="text-cyan-2 hover:underline">
              Cadastrar a empresa Omie
            </Link>{" "}
            com App Key e App Secret.
          </li>
          <li>Na tela Atualização, rode a primeira carga dessa empresa.</li>
          <li>
            <Link href="/admin/usuarios/novo" className="text-cyan-2 hover:underline">
              Criar usuários
            </Link>
            : interno (Costa Novaes, vê tudo) ou cliente (só as empresas marcadas).
          </li>
        </ol>
      </Card>
      {jobs.length ? (
        <Card>
          <h2 className="mb-2 font-semibold">Últimas cargas pedidas</h2>
          <ul className="space-y-1 text-sm">
            {jobs.map((j) => (
              <li key={j.id}>
                {j.apelido || j.app_key || "todas"} · {j.status} · {j.origem}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
