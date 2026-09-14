import type { Metadata } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import { Shell } from "@/components/shell";
import { formatDateTime } from "@/lib/format";
import { getEmpresa } from "@/lib/queries";
import { query } from "@/lib/db";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  title: "Nexo Financeiro",
  description: "BI de caixa, contas a receber e a pagar a partir do Omie.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let company: string | null = null;
  let lastSync: string | null = null;
  try {
    const empresa = await getEmpresa();
    company = empresa?.nome_fantasia || empresa?.razao_social || null;
    const rows = await query<{ ts: string; status: string; metodo: string }>(
      `SELECT COALESCE(finished_at, started_at)::text AS ts, status::text, metodo
       FROM ops.sync_log ORDER BY started_at DESC LIMIT 1`
    );
    const last = rows[0];
    if (last?.status === "running") {
      lastSync = `Carga em andamento (${last.metodo})`;
    } else if (last?.ts) {
      lastSync = formatDateTime(last.ts);
    }
  } catch {
    company = "Banco ainda não conectado";
  }

  return (
    <html lang="pt-BR">
      <body className={`${geist.variable} ${instrument.variable} font-sans antialiased`}>
        <Shell company={company} lastSync={lastSync}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
