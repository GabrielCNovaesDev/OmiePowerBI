"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PERIODO_OPTIONS } from "@/lib/period";

function Select({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(next: string) {
    const sp = new URLSearchParams(params.toString());
    if (!next || next === "todos") sp.delete(name);
    else sp.set(name, next);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <label className="block text-[11px] text-white/70">
      {label}
      <select
        className="mt-1 w-full rounded border border-white/15 bg-header px-2 py-1.5 text-sm text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterRail() {
  const params = useSearchParams();
  const periodo = params.get("periodo") ?? "ano_corrente";
  const base = params.get("base") ?? "caixa";

  return (
    <div className="space-y-3">
      <p className="px-1 text-[10px] uppercase tracking-[0.16em] text-white/40">Filtros</p>
      <Select label="Período" name="periodo" value={periodo} options={PERIODO_OPTIONS} />
      <Select
        label="Analisar"
        name="base"
        value={base}
        options={[
          { value: "caixa", label: "Caixa" },
          { value: "comp", label: "Competência" },
        ]}
      />
      <p className="px-1 text-[11px] leading-relaxed text-white/40">
        Cliente, categoria, conta e departamento entram na próxima iteração. O recorte de período já altera todas as telas.
      </p>
    </div>
  );
}
