import Link from "next/link";
import { Flash } from "@/components/admin-ui";
import { PageHeader } from "@/components/shell";
import { Card } from "@/components/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { listUsuarios } from "@/lib/admin-data";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const users = await listUsuarios();

  return (
    <div>
      <PageHeader
        kicker="Administração"
        title="Usuários e permissões"
        subtitle="Admin e interno veem todas as empresas. Cliente vê só as que você marcar."
      />
      <Flash
        ok={typeof sp.ok === "string" ? sp.ok : undefined}
        error={typeof sp.error === "string" ? sp.error : undefined}
      />
      <div className="mb-4">
        <Link href="/admin/usuarios/novo" className="rounded bg-cyan px-4 py-2 text-sm font-semibold text-white">
          Novo usuário
        </Link>
      </div>
      <Card padded={false}>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper text-[11px] uppercase tracking-wide text-mist">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">E-mail</th>
              <th className="px-4 py-2">Papel</th>
              <th className="px-4 py-2">Empresas</th>
              <th className="px-4 py-2">Ativo</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2 font-medium">{u.nome}</td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">{u.papel}</td>
                <td className="px-4 py-2 text-mist">
                  {u.papel === "cliente"
                    ? (Array.isArray(u.empresas) ? u.empresas : []).join(", ") || "—"
                    : "Todas"}
                </td>
                <td className="px-4 py-2">{u.ativo ? "sim" : "não"}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/admin/usuarios/${u.id}`} className="text-cyan-2 hover:underline">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
