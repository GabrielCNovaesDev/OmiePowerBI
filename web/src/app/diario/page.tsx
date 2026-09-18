import { DiarioCarteira } from "@/components/diario/page-carteira";
import { DiarioFluxo } from "@/components/diario/page-fluxo";
import { DiarioMovimentos } from "@/components/diario/page-movimentos";
import { DiarioNfs } from "@/components/diario/page-nfs";
import { DiarioQa } from "@/components/diario/page-qa";
import { DiarioResultado } from "@/components/diario/page-resultado";
import { DiarioSaldo } from "@/components/diario/page-saldo";
import { DiarioPager } from "@/components/diario/pager";
import { PageHeader } from "@/components/shell";
import { formatDate } from "@/lib/format";
import { hrefWith, readParams } from "@/lib/params";
import { startOfWeekISO, todayISO, yearStartISO } from "@/lib/period";
import { redirect } from "next/navigation";

export default async function DiarioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { filter, raw } = await readParams(searchParams);
  const parsed = Number(Array.isArray(raw.p) ? raw.p[0] : raw.p) || 1;
  const page = Number.isInteger(parsed) ? parsed : 1;
  if (page < 1 || page > 10) {
    redirect(hrefWith(raw, "/diario", { p: "1" }));
  }

  const today = todayISO();
  const rolling = new Date(`${today}T00:00:00`);
  rolling.setDate(rolling.getDate() - 6);
  const ctx = {
    today,
    weekFrom: startOfWeekISO(today),
    rollingFrom: rolling.toISOString().slice(0, 10),
    yearFrom: yearStartISO(),
    filter,
    raw,
  };

  return (
    <div className="space-y-4">
      <PageHeader kicker="Relatórios" title="Relatório Diário Financeiro" subtitle={`Data de referência: ${formatDate(today)}`} />
      <DiarioPager current={page} raw={raw} />
      {page === 1 ? <DiarioFluxo ctx={ctx} /> : null}
      {page === 2 ? <DiarioSaldo ctx={ctx} /> : null}
      {page === 3 ? <DiarioResultado ctx={ctx} /> : null}
      {page === 4 ? <DiarioMovimentos ctx={ctx} /> : null}
      {page === 5 ? <DiarioCarteira ctx={ctx} natureza="R" atrasado /> : null}
      {page === 6 ? <DiarioCarteira ctx={ctx} natureza="R" atrasado={false} /> : null}
      {page === 7 ? <DiarioCarteira ctx={ctx} natureza="P" atrasado /> : null}
      {page === 8 ? <DiarioCarteira ctx={ctx} natureza="P" atrasado={false} /> : null}
      {page === 9 ? <DiarioNfs ctx={ctx} /> : null}
      {page === 10 ? <DiarioQa ctx={ctx} /> : null}
    </div>
  );
}
