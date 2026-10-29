"use client";

import { Fragment, useMemo, useState } from "react";
import { cn } from "@/lib/format";
import type { FclColuna, FclLinha, FluxoLivre } from "@/lib/fluxo-livre";

type Sub = "real" | "prev" | "proj";

const SUB_ROTULO: Record<Sub, string> = { real: "Realizado", prev: "A realizar", proj: "Projetado" };

function fmt(v: number | null, emMil: boolean): string {
  if (v === null || Math.abs(v) < 0.005) return v === null ? "" : "0";
  const x = emMil ? v / 1000 : v;
  const s = Math.abs(x).toLocaleString("pt-BR", { minimumFractionDigits: emMil ? 1 : 0, maximumFractionDigits: emMil ? 1 : 0 });
  return x < 0 ? `(${s})` : s;
}

function valorDe(l: FclLinha, c: FclColuna, sub: Sub): number | null {
  const v = l.valores[c.id];
  if (!v) return null;
  if (sub === "real") return v.real;
  if (sub === "prev") return v.prev;
  // saldos já vêm projetados em "prev"; nas demais linhas projetado = realizado + a realizar
  if (l.tipo === "saldo") return v.prev;
  if (v.real === null && v.prev === null) return null;
  return (v.real ?? 0) + (v.prev ?? 0);
}

// Quais subcolunas cada coluna mostra: o vencido só tem "a realizar"; os meses
// futuros não têm realizado; os meses fechados não têm a realizar (o atrasado
// está em "Vencido").
function subsDa(c: FclColuna, ativos: Sub[]): Sub[] {
  if (c.tipo === "venc") return ["prev"];
  if (c.tipo === "mes" && !c.fechado && !c.atual) return ativos.filter((s) => s !== "real");
  if (c.tipo === "mes" && c.fechado) return ativos.filter((s) => s !== "prev");
  return ativos;
}

export function FluxoLivreTabela({ dados }: { dados: FluxoLivre }) {
  const [ativos, setAtivos] = useState<Sub[]>(["real", "prev", "proj"]);
  const [emMil, setEmMil] = useState(false);
  const [fechados, setFechados] = useState<Record<string, boolean>>(() => {
    const f: Record<string, boolean> = {};
    for (const l of dados.linhas) if (l.tipo === "subgrupo") f[l.id] = true;
    return f;
  });

  const filhos = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of dados.linhas) if (l.pai) m.set(l.pai, (m.get(l.pai) ?? 0) + 1);
    return m;
  }, [dados.linhas]);
  const porId = useMemo(() => new Map(dados.linhas.map((l) => [l.id, l])), [dados.linhas]);

  const visivel = (l: FclLinha) => {
    let p = l.pai;
    while (p) {
      if (fechados[p]) return false;
      p = porId.get(p)?.pai;
    }
    return true;
  };

  const nivel = (n: number) => {
    const f: Record<string, boolean> = {};
    for (const l of dados.linhas) if (filhos.get(l.id) && l.nivel >= n) f[l.id] = true;
    setFechados(f);
  };
  const alternar = (s: Sub) =>
    setAtivos((a) => (a.includes(s) ? (a.length > 1 ? a.filter((x) => x !== s) : a) : (["real", "prev", "proj"] as Sub[]).filter((x) => x === s || a.includes(x))));

  const cols = dados.colunas.map((c) => ({ c, subs: subsDa(c, ativos) })).filter((x) => x.subs.length);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-card px-3 py-2 text-sm">
        <span className="text-[11px] uppercase tracking-[0.14em] text-mist">Exibição</span>
        {(["real", "prev", "proj"] as Sub[]).map((s) => (
          <label key={s} className="flex items-center gap-1.5 rounded border border-line px-2 py-1">
            <input type="checkbox" checked={ativos.includes(s)} onChange={() => alternar(s)} />
            {SUB_ROTULO[s]}
          </label>
        ))}
        <label className="flex items-center gap-1.5 rounded border border-line px-2 py-1">
          <input type="checkbox" checked={emMil} onChange={() => setEmMil((v) => !v)} />
          R$ mil
        </label>
        <span className="ml-2 text-[11px] uppercase tracking-[0.14em] text-mist">Abrir</span>
        <button type="button" onClick={() => nivel(0)} className="rounded border border-line px-2 py-1 hover:border-cyan">
          Só grupos
        </button>
        <button type="button" onClick={() => nivel(1)} className="rounded border border-line px-2 py-1 hover:border-cyan">
          Subgrupos
        </button>
        <button type="button" onClick={() => setFechados({})} className="rounded border border-line px-2 py-1 hover:border-cyan">
          Tudo
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border border-line bg-card">
        <table className="min-w-full border-collapse text-[12px] tabular-nums">
          <thead>
            <tr className="bg-header text-white">
              <th rowSpan={2} className="sticky left-0 z-10 min-w-[260px] bg-header px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.08em]">
                Fluxo de caixa livre
              </th>
              {cols.map(({ c, subs }) => (
                <th
                  key={c.id}
                  colSpan={subs.length}
                  className={cn("border-l border-white/15 px-2 py-1.5 text-center text-[11px] font-medium", c.atual && "bg-cyan-2")}
                >
                  {c.rotulo}
                  {c.atual ? <span className="block text-[10px] font-normal text-white/80">mês atual</span> : null}
                </th>
              ))}
            </tr>
            <tr className="bg-paper text-mist">
              {cols.flatMap(({ c, subs }) =>
                subs.map((s, i) => (
                  <th key={`${c.id}-${s}`} className={cn("px-2 py-1 text-right text-[10px] font-medium", i === 0 && "border-l border-line")}>
                    {c.tipo === "venc" ? "A realizar" : SUB_ROTULO[s]}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {dados.linhas.filter(visivel).map((l) => {
              const temFilhos = (filhos.get(l.id) ?? 0) > 0;
              const estilo =
                l.tipo === "saldo"
                  ? "bg-header text-white font-semibold"
                  : l.tipo === "total"
                    ? "bg-[#e3f1ea] font-semibold"
                    : l.tipo === "grupo"
                      ? "bg-paper font-semibold"
                      : l.tipo === "subgrupo"
                        ? "font-medium"
                        : "text-ink/90";
              return (
                <tr key={l.id} className={cn("border-t border-line", estilo)}>
                  <td
                    className={cn("sticky left-0 z-[1] whitespace-nowrap px-3 py-1.5", l.tipo === "saldo" ? "bg-header" : l.tipo === "total" ? "bg-[#e3f1ea]" : l.tipo === "grupo" ? "bg-paper" : "bg-card")}
                    style={{ paddingLeft: 12 + l.nivel * 18 }}
                  >
                    {temFilhos ? (
                      <button
                        type="button"
                        onClick={() => setFechados((f) => ({ ...f, [l.id]: !f[l.id] }))}
                        className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded border border-current text-[10px] leading-none opacity-70 hover:opacity-100"
                        aria-label={fechados[l.id] ? `Abrir ${l.rotulo}` : `Fechar ${l.rotulo}`}
                        aria-expanded={!fechados[l.id]}
                      >
                        {fechados[l.id] ? "+" : "−"}
                      </button>
                    ) : null}
                    {l.rotulo}
                  </td>
                  {cols.map(({ c, subs }) => (
                    <Fragment key={c.id}>
                      {subs.map((s, i) => {
                        const v = valorDe(l, c, s);
                        const neg = v !== null && v < -0.005;
                        return (
                          <td
                            key={s}
                            className={cn(
                              "whitespace-nowrap px-2 py-1.5 text-right",
                              i === 0 && "border-l border-line",
                              s === "proj" && l.tipo !== "saldo" && "bg-black/[0.02]",
                              neg && l.tipo !== "saldo" && "text-loss",
                              neg && l.tipo === "saldo" && "text-[#ffb4b4]"
                            )}
                          >
                            {fmt(v, emMil)}
                          </td>
                        );
                      })}
                    </Fragment>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
