import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { formatDateTime } from "@/lib/format";
import { getEmpresa } from "@/lib/queries";
import { getFilterOptions } from "@/lib/dash";
import { query } from "@/lib/db";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

export const metadata: Metadata = {
  title: "Nexo BI",
  description: "Dashboards financeiros Omie no formato Business Indicator.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let company: string | null = null;
  let lastSync: string | null = null;
  let filterOptions = null;
  try {
    const empresa = await getEmpresa();
    company = empresa?.nome_fantasia || empresa?.razao_social || null;
    const rows = await query<{ ts: string; status: string; metodo: string }>(
      `SELECT COALESCE(finished_at, started_at)::text AS ts, status::text, metodo
       FROM ops.sync_log ORDER BY started_at DESC LIMIT 1`
    );
    const last = rows[0];
    if (last?.status === "running") lastSync = `Carga em andamento (${last.metodo})`;
    else if (last?.ts) lastSync = formatDateTime(last.ts);
    filterOptions = await getFilterOptions();
  } catch {
    company = company || "Banco ainda não conectado";
  }

  return (
    <html lang="pt-BR">
      <body className={`${geist.variable} font-sans antialiased`}>
        <Suspense fallback={null}>
          <Shell company={company} lastSync={lastSync} filterOptions={filterOptions}>
            {children}
          </Shell>
        </Suspense>
      </body>
    </html>
  );
}
