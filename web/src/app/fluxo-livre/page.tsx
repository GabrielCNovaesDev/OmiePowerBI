import { FluxoLivreTabela } from "@/components/fluxo-livre-tabela";
import { PageHeader } from "@/components/shell";
import { cn } from "@/lib/format";
import { getFluxoLivre } from "@/lib/fluxo-livre";
import { hrefWith, readParams } from "@/lib/params";
import { oneParam } from "@/lib/params-shared";
import { todayISO } from "@/lib/period";
import Link from "next/link";

export default async function FluxoLivrePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { filter, raw } = await readParams(searchParams);
  const anoAtual = Number(todayISO().slice(0, 4));
  const pedido = Number(oneParam(raw, "ano"));
  const ano = pedido >= 2000 && pedido <= anoAtual + 1 ? pedido : anoAtual;
  const dados = await getFluxoLivre(ano, filter);

  return (
    <div className="space-y-4">
      <PageHeader
        kicker="Dashboards"
        title="Fluxo de Caixa Livre"
        subtitle={`${ano} · realizado do extrato + a realizar dos títulos em aberto pela previsão`}
      />
      <div className="flex flex-wrap gap-2">
        {[anoAtual - 1, anoAtual, anoAtual + 1].map((a) => (
          <Link
            key={a}
            href={hrefWith(raw, "/fluxo-livre", { ano: String(a) })}
            className={cn(
              "rounded border px-4 py-1.5 text-sm",
              a === ano ? "border-cyan bg-cyan text-white" : "border-line bg-card hover:border-cyan"
            )}
          >
            {a}
          </Link>
        ))}
      </div>
      {dados.semDepara ? (
        <p className="rounded-md border border-gold bg-card px-3 py-2 text-sm">
          Esta empresa ainda não tem o de/para de categorias do FCL. Tudo aparece como Não classificado.
        </p>
      ) : null}
      {dados.naoClassificadas.length ? (
        <p className="rounded-md border border-line bg-card px-3 py-2 text-sm text-mist">
          Categorias com movimento sem de/para: {dados.naoClassificadas.join(" · ")}
        </p>
      ) : null}
      <FluxoLivreTabela dados={dados} />
    </div>
  );
}
