import { requireAdmin } from "@/lib/admin-auth";
import { listAplicativos } from "@/lib/admin-data";
import { UsuarioForm } from "../usuario-form";

export default async function NovoUsuarioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const apps = await listAplicativos();
  const sp = await searchParams;
  return <UsuarioForm apps={apps} error={typeof sp.error === "string" ? sp.error : undefined} />;
}
