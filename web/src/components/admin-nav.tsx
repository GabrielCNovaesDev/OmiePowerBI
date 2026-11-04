"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";

const LINKS = [
  { href: "/admin", label: "Painel" },
  { href: "/admin/aplicativos", label: "Empresas Omie" },
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/sync", label: "Atualização" },
];

// Client-side so the highlight follows navigation: the root layout doesn't re-render on route changes.
function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname() || "";
  return (
    <nav className="flex flex-wrap gap-1">
      {LINKS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-full border px-3 py-1 text-xs",
            isActive(pathname, item.href)
              ? "border-cyan bg-cyan text-white"
              : "border-white/20 text-white/80 hover:bg-white/10"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
