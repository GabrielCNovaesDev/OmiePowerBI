import { ComboCashflow } from "@/components/charts";
import { PageHeader } from "@/components/shell";
import { Card } from "@/components/ui";
import { getFluxoMensalCaixa } from "@/lib/dash";
import { hrefWith, readParams } from "@/lib/params";
import Link from "next/link";
import { cn } from "@/lib/format";

export default async function ValidacaoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { period, filter, raw } = await readParams(searchParams);
  const tipo = (Array.isArray(raw.tipo) ? raw.tipo[0] : raw.tipo) || "fluxo";
  const months = await getFluxoMensalCaixa(period.from, period.to, filter);

  return (
    <div className="space-y-5">
      <PageHeader
        kicker="Relatórios"
        title="Validação Omie & Nexo BI"
        subtitle="Conferir os totais do ERP com o que o BI calculou a partir da API. Os valores são da sua empresa, não dos prints."
      />
      <div className="flex gap-2">
        <Link href={hrefWith(raw, "/validacao", { tipo: "fluxo" })} className={cn("rounded px-5 py-2 text-sm font-semibold", tipo === "fluxo" ? "bg-cyan text-white" : "bg-paper")}>
          Fluxo de Caixa
        </Link>
        <Link href={hrefWith(raw, "/validacao", { tipo: "dre" })} className={cn("rounded px-5 py-2 text-sm font-semibold", tipo === "dre" ? "bg-cyan text-white" : "bg-paper")}>
          DRE
        </Link>
      </div>
      <Card>
        <p className="text-sm font-semibold text-cyan-2">1. ERP Omie</p>
        <p className="mt-2 text-sm text-mist">
          {tipo === "dre"
            ? "Omie → Finanças → Relatórios → DRE → Por data de emissão → Mensal → data final até o último mês."
            : "Omie → Finanças → Relatórios → Fluxo de Caixa → Por Categoria → Mensal → data final até o último mês."}
        </p>
      </Card>
      <Card>
        <p className="mb-3 text-sm font-semibold text-cyan-2">2. Nexo BI · compare com o relatório acima</p>
        {tipo === "fluxo" ? (
          <ComboCashflow
            labels={months.map((m) => m.label)}
            entradas={months.map((m) => m.entrada)}
            saidas={months.map((m) => m.saida)}
            saldo={months.map((m) => m.saldoAcumulado)}
            height={360}
          />
        ) : (
          <p className="text-sm text-mist">
            Abra a aba <Link className="text-cyan-2 underline" href="/dre">DRE</Link> e compare linha a linha com o demonstrativo do Omie.
          </p>
        )}
      </Card>
    </div>
  );
}
