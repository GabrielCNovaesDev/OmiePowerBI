import type { Metadata } from "next";
import { Geist, Montserrat } from "next/font/google";
import { Suspense } from "react";
import { headers } from "next/headers";
import { AdminShell } from "@/components/admin-ui";
import { Shell } from "@/components/shell";
import { formatDateTime } from "@/lib/format";
import { query } from "@/lib/db";
import { auth } from "@/auth";
import { empresaFromHeaders, resolveTenant, tenantLabel } from "@/lib/tenant";
import { Binder, dimSql } from "@/lib/params";
import { ROTA_DESENVOLVEDOR, rotasOcultas } from "@/lib/modulos";
import type { FilterOptions } from "@/components/filters";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const brand = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Costa Novaes BI",
  description: "Dashboards financeiros Omie da Costa Novaes Consultoria Empresarial.",
};

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const bodyClass = `${geist.variable} ${brand.variable} font-sans antialiased`;

  if (!session?.user) {
    return (
      <html lang="pt-BR">
        <body className={bodyClass}>{children}</body>
      </html>
    );
  }

  const headerList = await headers();
  let pathname = "";
  try {
    pathname = new URL(headerList.get("x-url") || "http://local.invalid/").pathname;
  } catch {
    pathname = "";
  }
  const isAdminPath = pathname.startsWith("/admin");

  let company: string | null = null;
  let lastSync: string | null = null;
  let filterOptions: FilterOptions | null = null;
  let tenantName = session.user.name || session.user.email || "";
  let papel = session.user.papel;
  let hiddenRoutes: string[] = papel === "desenvolvedor" ? [] : [ROTA_DESENVOLVEDOR];
  let hiddenPorEmpresa: Record<string, string[]> = {};
  let lastSyncPorEmpresa: Record<string, string> = {};

  if (isAdminPath) {
    return (
      <html lang="pt-BR">
        <body className={bodyClass}>
          <AdminShell userName={tenantName} papel={papel}>
            {children}
          </AdminShell>
        </body>
      </html>
    );
  }

  try {
    const tenant = await resolveTenant(session, empresaFromHeaders(headerList.get("x-url")));
    tenantName = tenant.nome;
    papel = tenant.papel;
    company = tenantLabel(tenant);
    // O layout raiz não re-renderiza quando só muda ?empresa=, então o menu recebe
    // as rotas ocultas de cada empresa e do consolidado e escolhe no cliente.
    const dev = tenant.papel === "desenvolvedor";
    hiddenRoutes = rotasOcultas([...new Set(tenant.empresas.flatMap((e) => e.modulos_desativados ?? []))], dev);
    hiddenPorEmpresa = Object.fromEntries(
      tenant.empresas.map((e) => [e.app_key, rotasOcultas(e.modulos_desativados ?? [], dev)])
    );
    // Última carga de cada empresa; o consolidado mostra a mais recente delas.
    const filter = { appKeys: tenant.allowedKeys };
    const b = new Binder();
    const rows = await query<{ app_key: string; ts: string; status: string; metodo: string }>(
      `SELECT DISTINCT ON (app_key) app_key, COALESCE(finished_at, started_at)::text AS ts, status::text, metodo
       FROM ops.sync_log
       WHERE TRUE ${dimSql(b, filter, { appKey: "app_key" })}
       ORDER BY app_key, started_at DESC`,
      b.values
    );
    const texto = (r: (typeof rows)[number]) =>
      r.status === "running" ? `Carga em andamento (${r.metodo})` : r.ts ? formatDateTime(r.ts) : null;
    lastSyncPorEmpresa = Object.fromEntries(rows.flatMap((r) => (texto(r) ? [[r.app_key, texto(r)!]] : [])));
    const consolidado = rows.find((r) => r.status === "running") ?? [...rows].sort((x, y) => y.ts.localeCompare(x.ts))[0];
    if (consolidado) lastSync = texto(consolidado);
    filterOptions = {
      categorias: [],
      contas: [],
      clientes: [],
      departamentos: [],
      empresas: tenant.empresas.map((e) => ({
        codigo: e.app_key,
        descricao: e.apelido || e.razao_social || e.app_key,
      })),
      canPickEmpresa: tenant.canPickEmpresa,
    };
  } catch {
    company = company || "Banco ainda não conectado";
  }

  return (
    <html lang="pt-BR">
      <body className={bodyClass}>
        <Suspense fallback={null}>
          <Shell
            company={company}
            lastSync={lastSync}
            lastSyncPorEmpresa={lastSyncPorEmpresa}
            filterOptions={filterOptions}
            userName={tenantName}
            papel={papel}
            hiddenRoutes={hiddenRoutes}
            hiddenPorEmpresa={hiddenPorEmpresa}
          >
            {children}
          </Shell>
        </Suspense>
      </body>
    </html>
  );
}
