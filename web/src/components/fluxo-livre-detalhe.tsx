"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn, money } from "@/lib/format";
import type { FclDetalhe } from "@/lib/fluxo-livre";

export type FclCelula = {
  linha: string;
  coluna: string;
  campo: "real" | "prev" | "proj";
  valorQuadro: number | null;
  query: string;
};

const CAMPO_ROTULO = { real: "Realizado", prev: "A realizar", proj: "Projetado" } as const;

const dataBr = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return d && m && a ? `${d}/${m}/${a}` : iso;
};

export function FluxoLivreDetalhe({ celula, onFechar }: { celula: FclCelula; onFechar: () => void }) {
  const [estado, setEstado] = useState<{ dados?: FclDetalhe; erro?: string }>({});

  useEffect(() => {
    const ctl = new AbortController();
    setEstado({});
    fetch(`/api/fluxo-livre/detalhe?${celula.query}`, { signal: ctl.signal })
      .then(async (r) => {
        if (r.status === 401 || (r.redirected && new URL(r.url).pathname === "/login")) throw new Error("Sessão expirada. Entre de novo.");
        if (!r.ok || !r.headers.get("content-type")?.includes("json")) throw new Error("Não foi possível carregar os lançamentos.");
        return (await r.json()) as FclDetalhe;
      })
      .then((dados) => setEstado({ dados }))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setEstado({ erro: e.message });
      });
    return () => ctl.abort();
  }, [celula.query]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  const { dados, erro } = estado;
  const mostraOrigem = celula.campo === "proj";
  const variasCategorias = dados ? new Set(dados.linhas.map((l) => l.categoria)).size > 1 : false;
  const cortado = dados ? dados.linhas.length < dados.qtd : false;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 sm:p-8" onClick={onFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Lançamentos de ${celula.linha}`}
        className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-md border border-line bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-mist">
              {celula.coluna} · {CAMPO_ROTULO[celula.campo]}
            </p>
            <p className="text-base font-semibold">{celula.linha}</p>
          </div>
          <div className="flex items-start gap-4">
            {dados ? (
              <div className="text-right text-sm">
                <p className={cn("font-semibold tabular-nums", dados.total < 0 && "text-loss")}>{money(dados.total)}</p>
                <p className="text-[11px] text-mist">
                  {dados.qtd} {dados.qtd === 1 ? "lançamento" : "lançamentos"}
                </p>
              </div>
            ) : null}
            <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded p-1 hover:bg-paper">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-auto">
          {erro ? (
            <p className="px-4 py-8 text-sm text-loss">{erro}</p>
          ) : !dados ? (
            <p className="px-4 py-8 text-sm text-mist">Carregando lançamentos…</p>
          ) : dados.linhas.length === 0 ? (
            <p className="px-4 py-8 text-sm text-mist">Nenhum lançamento neste recorte.</p>
          ) : (
            <table className="min-w-full text-[12px] tabular-nums">
              <thead className="sticky top-0 bg-header text-left text-[11px] uppercase tracking-[0.08em] text-white">
                <tr>
                  <th className="px-3 py-2 font-medium">{celula.campo === "real" ? "Data" : "Data / previsão"}</th>
                  {mostraOrigem ? <th className="px-3 py-2 font-medium">Tipo</th> : null}
                  <th className="px-3 py-2 font-medium">Cliente / fornecedor</th>
                  {variasCategorias ? <th className="px-3 py-2 font-medium">Categoria</th> : null}
                  <th className="px-3 py-2 font-medium">Documento</th>
                  <th className="px-3 py-2 font-medium">Observação</th>
                  <th className="px-3 py-2 font-medium">Conta</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {dados.linhas.map((l, i) => (
                  <tr key={i} className="border-t border-line align-top even:bg-paper/60">
                    <td className="whitespace-nowrap px-3 py-1.5">{dataBr(l.data)}</td>
                    {mostraOrigem ? (
                      <td className="whitespace-nowrap px-3 py-1.5 text-mist">{l.origem === "real" ? "Realizado" : "A realizar"}</td>
                    ) : null}
                    <td className="px-3 py-1.5">{l.pessoa ?? "—"}</td>
                    {variasCategorias ? <td className="px-3 py-1.5">{l.categoria ?? "(sem categoria)"}</td> : null}
                    <td className="whitespace-nowrap px-3 py-1.5">{l.documento ?? "—"}</td>
                    <td className="max-w-[22rem] px-3 py-1.5 text-mist">{l.descricao ?? ""}</td>
                    <td className="whitespace-nowrap px-3 py-1.5">{l.conta ?? "—"}</td>
                    <td className={cn("whitespace-nowrap px-3 py-1.5 text-right", l.valor < 0 && "text-loss")}>
                      {money(l.valor)}
                      {l.fator < 0.9999 ? (
                        <span className="block text-[10px] text-mist">rateio {(l.fator * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {cortado ? (
          <p className="border-t border-line px-4 py-2 text-[11px] text-mist">
            Mostrando os primeiros {dados!.limite} de cada tipo; o total acima considera todos.
          </p>
        ) : null}
      </div>
    </div>
  );
}
