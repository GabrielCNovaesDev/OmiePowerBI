"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Home", hint: "Caixa do dia" },
  { href: "/receber", label: "A receber", hint: "Carteira e aging" },
  { href: "/pagar", label: "A pagar", hint: "Obrigações" },
  { href: "/fluxo", label: "Fluxo", hint: "Realizado e projetado" },
  { href: "/extrato", label: "Extrato", hint: "Contas e movimentos" },
  { href: "/sync", label: "Qualidade", hint: "Sync e conferência" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "rounded-md bg-panel px-3 py-2 border-l-2 border-gold"
                : "rounded-md px-3 py-2 border-l-2 border-transparent hover:bg-panel/60"
            }
          >
            <span className="block text-sm text-paper">{item.label}</span>
            <span className="block text-[11px] text-mist">{item.hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}
