"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FilterOption } from "./filters";

export function EmpresaPicker({
  empresas,
  canPick,
  fallbackLabel,
}: {
  empresas: FilterOption[];
  canPick: boolean;
  fallbackLabel?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get("empresa") ?? "todas";

  if (!canPick || empresas.length < 2) {
    return <p className="text-white/80">{fallbackLabel || "Omie"}</p>;
  }

  function onChange(next: string) {
    const sp = new URLSearchParams(params.toString());
    if (!next || next === "todas") sp.delete("empresa");
    else sp.set("empresa", next);
    sp.delete("cliente");
    sp.delete("categoria");
    sp.delete("tipo_conta");
    sp.delete("conta");
    sp.delete("departamento");
    const q = sp.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  return (
    <label className="block text-right">
      <span className="sr-only">Empresa</span>
      <select
        className="max-w-[240px] cursor-pointer appearance-none rounded border border-white/20 bg-transparent py-0.5 pl-2 pr-6 text-right text-[13px] font-medium text-white outline-none hover:border-cyan focus:border-cyan"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M3 4.5 6 8l3-3.5'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 6px center",
        }}
        value={empresas.some((e) => e.codigo === value) ? value : "todas"}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Selecionar empresa"
      >
        <option value="todas" className="bg-header text-white">
          Consolidado ({empresas.length})
        </option>
        {empresas.map((e) => (
          <option key={e.codigo} value={e.codigo} className="bg-header text-white">
            {e.descricao}
          </option>
        ))}
      </select>
    </label>
  );
}
