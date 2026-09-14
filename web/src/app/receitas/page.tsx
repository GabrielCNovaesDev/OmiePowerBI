import KindPage from "@/components/kind-page";

export default function ReceitasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <KindPage kind="receita" searchParams={searchParams} />;
}
