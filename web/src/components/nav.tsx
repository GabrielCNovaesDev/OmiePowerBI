"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/format";
import { globalQuery } from "@/lib/params";

export const DASHBOARDS = [
  { href: "/", label: "Resumo" },
  { href: "/saldo", label: "Saldo" },
  { href: "/fluxo", label: "F. Caixa" },
  { href: "/resultado", label: "Resultados" },
  { href: "/dre", label: "DRE" },
  { href: "/previsto", label: "Prev. x Real." },
  { href: "/receitas", label: "Receitas" },
  { href: "/custos", label: "Custos" },
  { href: "/despesas", label: "Despesas" },
  { href: "/nfs", label: "NFs" },
  { href: "/qa", label: "Q&A" },
];

export const RELATORIOS = [
  { href: "/validacao", label: "Validação Omie" },
  { href: "/check", label: "Check Panel" },
  { href: "/diario", label: "Relatório Diário" },
  { href: "/mensal", label: "Relatório Mensal" },
  { href: "/receber", label: "Contas a receber" },
  { href: "/pagar", label: "Contas a pagar" },
  { href: "/extrato", label: "Extrato" },
  { href: "/sync", label: "Qualidade & Sync" },
];

function hrefKeepFilters(path: string, search: URLSearchParams) {
  const q = globalQuery(search);
  return q ? `${path}?${q}` : path;
}

export function DashTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {DASHBOARDS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={hrefKeepFilters(item.href, searchParams)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              active ? "border-cyan bg-cyan text-white" : "border-white/20 text-white/80 hover:bg-white/10"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ReportNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <div>
      <p className="mb-2 px-1 text-[10px] uppercase tracking-[0.16em] text-white/40">Relatórios</p>
      <nav className="flex flex-col gap-0.5">
        {RELATORIOS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={hrefKeepFilters(item.href, searchParams)}
              className={cn(
                "rounded px-2 py-1.5 text-sm",
                active ? "bg-white/10 text-cyan" : "text-white/80 hover:bg-white/5"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
