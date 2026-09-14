import KindPage from "@/components/kind-page";

export default function CustosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <KindPage kind="custo" searchParams={searchParams} />;
}
