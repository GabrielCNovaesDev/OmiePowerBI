"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TIPO_CONTA_OPTIONS } from "@/lib/params-shared";
import { PERIODO_OPTIONS } from "@/lib/period";

export type FilterOption = { codigo: string; descricao: string; tipo?: string | null; considerada?: boolean };
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

function uniqueByCodigo(rows: FilterOption[]): FilterOption[] {
  const seen = new Set<string>();
  const unique: FilterOption[] = [];
  for (const row of rows) {
    if (!row.codigo || seen.has(row.codigo)) continue;
    seen.add(row.codigo);
    unique.push(row);
  }
  return unique;
}

function withTodos(rows: FilterOption[]): Array<{ value: string; label: string }> {
  return [
    { value: "todos", label: "Todos" },
    ...uniqueByCodigo(rows).map((r) => ({ value: r.codigo, label: r.descricao })),
  ];
}

function parseCsv(value: string | null): string[] {
  if (!value || value === "todos" || value === "all" || value === "todas") return [];
  return [...new Set(value.split(",").map((s) => s.trim()).filter(Boolean))];
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

function MultiCheck({
  options,
  padraoIds,
  mode,
  selected,
  onChange,
}: {
  options: FilterOption[];
  padraoIds: string[];
  mode: "padrao" | "todas" | "ids";
  selected: string[];
  onChange: (next: { mode: "padrao" | "todas" | "ids"; ids?: string[] }) => void;
}) {
  const unique = uniqueByCodigo(options);
  const visibleSelected =
    mode === "todas" ? unique.map((o) => o.codigo) : mode === "padrao" ? padraoIds : selected;
  const summary =
    mode === "todas"
      ? "Todas as contas"
      : visibleSelected.length === 1
        ? unique.find((o) => o.codigo === visibleSelected[0])?.descricao ?? "1 conta"
        : `${visibleSelected.length} contas`;

  function applyIds(ids: string[]) {
    if (!ids.length) {
      onChange({ mode: "padrao" });
      return;
    }
    const allIds = unique.map((o) => o.codigo);
    if (sameIds(ids, allIds)) {
      onChange({ mode: "todas" });
      return;
    }
    if (sameIds(ids, padraoIds)) {
      onChange({ mode: "padrao" });
      return;
    }
    onChange({ mode: "ids", ids });
  }

  function toggle(codigo: string, checked: boolean) {
    const current = new Set(visibleSelected);
    if (checked) current.add(codigo);
    else current.delete(codigo);
    applyIds([...current]);
  }

  return (
    <div className="block text-[11px] text-white/70">
      Conta corrente
      <details className="relative mt-1">
        <summary className="cursor-pointer list-none rounded border border-white/15 bg-header px-2 py-1.5 text-sm text-white [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate">{summary}</span>
            <span className="text-[10px] text-white/40">▾</span>
          </span>
        </summary>
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded border border-white/15 bg-header py-1 shadow-lg">
          <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm text-white hover:bg-white/10">
            <input type="checkbox" checked={mode === "padrao"} onChange={() => onChange({ mode: "padrao" })} />
            Padrão (resumo e fluxo)
          </label>
          <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm text-white hover:bg-white/10">
            <input type="checkbox" checked={mode === "todas"} onChange={() => onChange({ mode: "todas" })} />
            Todas as contas
          </label>
          {unique.map((row) => (
            <label
              key={row.codigo}
              className="flex cursor-pointer items-start gap-2 px-2 py-1.5 text-sm text-white hover:bg-white/10"
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={visibleSelected.includes(row.codigo)}
                onChange={(e) => toggle(row.codigo, e.target.checked)}
              />
              <span className="leading-snug">
                {row.descricao}
                {row.considerada ? "" : <span className="ml-1 text-[10px] text-white/40">fora do padrão</span>}
              </span>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

export function FilterRail({ options }: { options?: FilterOptions | null }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const empresa = params.get("empresa") ?? "todas";
  const [dims, setDims] = useState<FilterOptions | null>(null);
  const [dimsEmpresa, setDimsEmpresa] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const q = new URLSearchParams();
    if (empresa && empresa !== "todas") q.set("empresa", empresa);
    fetch(`/api/filtros?${q.toString()}`, { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: FilterOptions) => {
        setDims(data);
        setDimsEmpresa(empresa);
      })
      .catch(() => {
        if (!ac.signal.aborted) {
          setDims(null);
          setDimsEmpresa(empresa);
        }
      });
    return () => ac.abort();
  }, [empresa]);

  const liveOptions =
    dimsEmpresa === empresa
      ? {
          categorias: dims?.categorias ?? [],
          contas: dims?.contas ?? [],
          clientes: dims?.clientes ?? [],
          departamentos: dims?.departamentos ?? [],
          empresas: options?.empresas,
          canPickEmpresa: options?.canPickEmpresa,
        }
      : {
          categorias: [],
          contas: [],
          clientes: [],
          departamentos: [],
          empresas: options?.empresas,
          canPickEmpresa: options?.canPickEmpresa,
        };
  const periodo = params.get("periodo") ?? "ano_corrente";
  const base = params.get("base") ?? "caixa";
  const cliente = params.get("cliente") ?? "todos";
  const categoria = params.get("categoria") ?? "todos";
  const tipoConta = params.get("tipo_conta") ?? "todos";
  const contaRaw = params.get("conta");
  const contasTodas = contaRaw === "all" || contaRaw === "todas";
  const selectedContas = parseCsv(contaRaw);
  const departamento = params.get("departamento") ?? "todos";
  const hasDim =
    params.has("cliente") ||
    params.has("categoria") ||
    params.has("tipo_conta") ||
    params.has("conta") ||
    params.has("departamento");
  const allContas = uniqueByCodigo(liveOptions?.contas ?? []);
  const contas =
    tipoConta && tipoConta !== "todos" ? allContas.filter((c) => (c.tipo ?? "") === tipoConta) : allContas;
  const padraoIds = contas.filter((c) => c.considerada).map((c) => c.codigo);
  const contaMode: "padrao" | "todas" | "ids" = contasTodas ? "todas" : selectedContas.length ? "ids" : "padrao";

  function pushParams(sp: URLSearchParams) {
    const q = sp.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  function writeConta(sp: URLSearchParams, next: { mode: "padrao" | "todas" | "ids"; ids?: string[] }) {
    if (next.mode === "padrao") sp.delete("conta");
    else if (next.mode === "todas") sp.set("conta", "all");
    else if (next.ids?.length) sp.set("conta", next.ids.join(","));
    else sp.delete("conta");
  }

  function setContaMode(next: { mode: "padrao" | "todas" | "ids"; ids?: string[] }) {
    const sp = new URLSearchParams(params.toString());
    writeConta(sp, next);
    pushParams(sp);
  }

  function clearDims() {
    const sp = new URLSearchParams(params.toString());
    sp.delete("cliente");
    sp.delete("categoria");
    sp.delete("tipo_conta");
    sp.delete("conta");
    sp.delete("departamento");
    pushParams(sp);
  }

  function onTipoContaChange(next: string) {
    const sp = new URLSearchParams(params.toString());
    if (!next || next === "todos") sp.delete("tipo_conta");
    else sp.set("tipo_conta", next);
    const nextList =
      next && next !== "todos" ? allContas.filter((c) => (c.tipo ?? "") === next) : allContas;
    if (contaMode === "ids") {
      const allowed = new Set(nextList.map((c) => c.codigo));
      const kept = selectedContas.filter((id) => allowed.has(id));
      writeConta(sp, kept.length ? { mode: "ids", ids: kept } : { mode: "padrao" });
    }
    pushParams(sp);
  }

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
      <Select label="Cliente / Fornecedor" name="cliente" value={cliente} options={withTodos(liveOptions?.clientes ?? [])} />
      <Select label="Categoria" name="categoria" value={categoria} options={withTodos(liveOptions?.categorias ?? [])} />
      <label className="block text-[11px] text-white/70">
        Tipo de conta
        <select
          className="mt-1 w-full max-w-full rounded border border-white/15 bg-header px-2 py-1.5 text-sm text-white"
          value={tipoConta}
          onChange={(e) => onTipoContaChange(e.target.value)}
        >
          <option value="todos">Todos</option>
          {TIPO_CONTA_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <MultiCheck
        options={contas}
        padraoIds={padraoIds}
        mode={contaMode}
        selected={selectedContas}
        onChange={setContaMode}
      />
      <Select
        label="Departamento"
        name="departamento"
        value={departamento}
        options={withTodos(liveOptions?.departamentos ?? [])}
      />
      {hasDim ? (
        <button type="button" onClick={clearDims} className="text-[11px] text-cyan hover:underline">
          Limpar dimensões
        </button>
      ) : null}
    </div>
  );
}
