import { requireAdmin } from "@/lib/admin-auth";
import { getAplicativo } from "@/lib/admin-data";
import { notFound } from "next/navigation";
import { AplicativoForm } from "../aplicativo-form";

export default async function EditarAplicativoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { id } = await params;
  const existing = await getAplicativo(id);
  if (!existing) notFound();
  const sp = await searchParams;
  return (
    <AplicativoForm
      existing={existing}
      error={typeof sp.error === "string" ? sp.error : undefined}
      ok={typeof sp.ok === "string" ? sp.ok : undefined}
    />
  );
}
