import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFclDetalhe } from "@/lib/fluxo-livre";
import { readParams } from "@/lib/params";

export const dynamic = "force-dynamic";

// Lançamentos de uma célula do Fluxo de Caixa Livre.
//   ?ano=2026&col=2026-03|VENC|ANO&campo=real|prev|proj&cod=<app_key|codigo>&cod=...
//   + os filtros globais da tela (empresa, conta, cliente...).
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const sp: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of url.searchParams) if (k !== "cod") sp[k] = v;
  const { filter, tenant } = await readParams(sp);
  if (tenant.modulosDesativados.includes("fluxo_livre")) return NextResponse.json({ error: "not found" }, { status: 404 });

  const ano = Number(url.searchParams.get("ano"));
  const col = url.searchParams.get("col") ?? "";
  const campo = url.searchParams.get("campo");
  const codigos = url.searchParams.getAll("cod").filter((c) => c.includes("|")).slice(0, 500);
  if (!(ano >= 2000 && ano <= 2100) || !/^(VENC|ANO|\d{4}-\d{2})$/.test(col) || (campo !== "real" && campo !== "prev" && campo !== "proj") || !codigos.length) {
    return NextResponse.json({ error: "parâmetros inválidos" }, { status: 400 });
  }

  const dados = await getFclDetalhe(ano, filter, codigos, col, campo);
  return NextResponse.json(dados, { headers: { "Cache-Control": "private, no-store" } });
}
