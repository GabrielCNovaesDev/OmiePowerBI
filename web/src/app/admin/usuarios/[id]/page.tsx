import { requireAdmin } from "@/lib/admin-auth";
import { getUsuario, listAplicativos } from "@/lib/admin-data";
import { notFound } from "next/navigation";
import { UsuarioForm } from "../usuario-form";

export default async function EditarUsuarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { id } = await params;
  const existing = await getUsuario(id);
  if (!existing) notFound();
  const apps = await listAplicativos();
  const sp = await searchParams;
  return <UsuarioForm existing={existing} apps={apps} error={typeof sp.error === "string" ? sp.error : undefined} />;
}
