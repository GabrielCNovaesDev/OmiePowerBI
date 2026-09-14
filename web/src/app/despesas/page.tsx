import KindPage from "@/components/kind-page";

export default function DespesasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <KindPage kind="despesa" searchParams={searchParams} />;
}
