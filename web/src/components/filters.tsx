"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PERIODO_OPTIONS } from "@/lib/period";

export type FilterOption = { codigo: string; descricao: string };
export type FilterOptions = {
  categorias: FilterOption[];
  contas: FilterOption[];
  clientes: FilterOption[];
  departamentos: FilterOption[];
  empresas?: FilterOption[];
  canPickEmpresa?: boolean;
};

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
    const q = sp.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  return (
    <label className="block text-[11px] text-white/70">
      {label}
      <select
        className="mt-1 w-full max-w-full rounded border border-white/15 bg-header px-2 py-1.5 text-sm text-white"
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

function withTodos(rows: FilterOption[]): Array<{ value: string; label: string }> {
  return [{ value: "todos", label: "Todos" }, ...rows.map((r) => ({ value: r.codigo, label: r.descricao }))];
}

export function FilterRail({ options }: { options?: FilterOptions | null }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const periodo = params.get("periodo") ?? "ano_corrente";
  const base = params.get("base") ?? "caixa";
  const empresa = params.get("empresa") ?? "todas";
  const cliente = params.get("cliente") ?? "todos";
  const categoria = params.get("categoria") ?? "todos";
  const conta = params.get("conta") ?? "todos";
  const departamento = params.get("departamento") ?? "todos";
  const hasDim =
    params.has("cliente") || params.has("categoria") || params.has("conta") || params.has("departamento");

  function clearDims() {
    const sp = new URLSearchParams(params.toString());
    sp.delete("cliente");
    sp.delete("categoria");
    sp.delete("conta");
    sp.delete("departamento");
    const q = sp.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  return (
    <div className="space-y-3">
      <p className="px-1 text-[10px] uppercase tracking-[0.16em] text-white/40">Filtros</p>
      <Select label="Período" name="periodo" value={periodo} options={PERIODO_OPTIONS} />
      {options?.canPickEmpresa && (options.empresas?.length ?? 0) > 0 ? (
        <Select
          label="Empresa"
          name="empresa"
          value={empresa}
          options={[
            { value: "todas", label: "Todas as empresas" },
            ...(options.empresas ?? []).map((e) => ({ value: e.codigo, label: e.descricao })),
          ]}
        />
      ) : null}
      <Select
        label="Analisar"
        name="base"
        value={base}
        options={[
          { value: "caixa", label: "Caixa" },
          { value: "comp", label: "Competência" },
        ]}
      />
      <Select label="Cliente / Fornecedor" name="cliente" value={cliente} options={withTodos(options?.clientes ?? [])} />
      <Select label="Categoria" name="categoria" value={categoria} options={withTodos(options?.categorias ?? [])} />
      <Select label="Conta corrente" name="conta" value={conta} options={withTodos(options?.contas ?? [])} />
      <Select
        label="Departamento"
        name="departamento"
        value={departamento}
        options={withTodos(options?.departamentos ?? [])}
      />
      {hasDim ? (
        <button type="button" onClick={clearDims} className="text-[11px] text-cyan hover:underline">
          Limpar dimensões
        </button>
      ) : null}
    </div>
  );
}
