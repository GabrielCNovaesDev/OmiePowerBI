import { requireAdmin } from "@/lib/admin-auth";
import { AplicativoForm } from "../aplicativo-form";

export default async function NovoAplicativoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  return <AplicativoForm error={typeof sp.error === "string" ? sp.error : undefined} />;
}
