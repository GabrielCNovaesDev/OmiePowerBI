"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, Signed } from "@/components/ui";
import { cn, money } from "@/lib/format";
import type { FluxoDrillNode } from "@/lib/dash";

export type FluxoMetric = "entrada" | "saida" | "resultado";

function metricValue(entrada: number, saida: number, metric: FluxoMetric) {
  if (metric === "entrada") return entrada;
  if (metric === "saida") return saida;
  return entrada - saida;
}

function MetricCell({ value, metric }: { value: number; metric: FluxoMetric }) {
  if (metric === "resultado") return <Signed value={value} />;
  return <>{money(value)}</>;
}

const LEVEL_TONE: Record<FluxoDrillNode["level"], string> = {
  grupo: "font-semibold text-ink",
  subgrupo: "font-medium text-ink",
  categoria: "text-ink",
  fornecedor: "text-mist",
};

export function FluxoDrilldown({
  months,
  nodes,
  hint,
}: {
  months: Array<{ mes: string; label: string }>;
  nodes: FluxoDrillNode[];
  hint?: string;
}) {
  const [metric, setMetric] = useState<FluxoMetric>("resultado");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const metrics: Array<{ id: FluxoMetric; label: string }> = [
    { id: "entrada", label: "Entrada" },
    { id: "saida", label: "Saída" },
    { id: "resultado", label: "Resultado" },
  ];

  const totals = useMemo(() => {
    const byMonth = months.map((m) =>
      nodes.reduce((s, row) => s + metricValue(row.byMonth[m.mes]?.entrada ?? 0, row.byMonth[m.mes]?.saida ?? 0, metric), 0)
    );
    const grand = nodes.reduce((s, row) => s + metricValue(row.entrada, row.saida, metric), 0);
    return { byMonth, grand };
  }, [months, nodes, metric]);

  function toggle(key: string) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function collapseAll() {
    setOpen({});
  }

  const anyOpen = Object.values(open).some(Boolean);

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Detalhamento</p>
          <p className="mt-1 text-xs text-mist">
            {hint ?? "Clique na linha para abrir o nível abaixo (grupo → sub-grupo → categoria → fornecedor)."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {anyOpen ? (
            <button type="button" onClick={collapseAll} className="rounded border border-line px-3 py-1 text-xs hover:border-cyan">
              Recolher tudo
            </button>
          ) : null}
          {metrics.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMetric(item.id)}
              className={cn(
                "rounded border px-3 py-1 text-xs",
                metric === item.id ? "border-cyan bg-cyan text-white" : "border-line bg-card hover:border-cyan"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full text-sm">
          <thead className="bg-header text-left text-[11px] uppercase tracking-[0.08em] text-white">
            <tr>
              <th className="px-3 py-2 font-medium">Grupo / sub-grupo / categoria</th>
              {months.map((m) => (
                <th key={m.mes} className="px-3 py-2 font-medium">
                  {m.label}
                </th>
              ))}
              <th className="px-3 py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {nodes.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-mist" colSpan={months.length + 2}>
                  Sem movimentação neste recorte.
                </td>
              </tr>
            ) : (
              <FluxoDrillRows nodes={nodes} depth={0} open={open} onToggle={toggle} months={months} metric={metric} />
            )}
          </tbody>
          {nodes.length ? (
            <tfoot>
              <tr className="border-t border-line bg-paper font-medium">
                <td className="px-3 py-2">Total</td>
                {totals.byMonth.map((v, i) => (
                  <td key={months[i]!.mes} className="px-3 py-2">
                    <MetricCell metric={metric} value={v} />
                  </td>
                ))}
                <td className="px-3 py-2">
                  <MetricCell metric={metric} value={totals.grand} />
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </Card>
  );
}

function FluxoDrillRows({
  nodes,
  depth,
  open,
  onToggle,
  months,
  metric,
}: {
  nodes: FluxoDrillNode[];
  depth: number;
  open: Record<string, boolean>;
  onToggle: (key: string) => void;
  months: Array<{ mes: string; label: string }>;
  metric: FluxoMetric;
}) {
  return (
    <>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const expanded = Boolean(open[node.key]);
        return (
          <Fragment key={node.key}>
            <tr className={cn("border-t border-line", depth === 0 ? "even:bg-paper/70" : "bg-paper/40")}>
              <td className="px-3 py-2 align-middle">
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => onToggle(node.key)}
                    aria-expanded={expanded}
                    className={cn("flex max-w-[28rem] items-center gap-1 text-left hover:text-cyan", LEVEL_TONE[node.level])}
                    style={{ paddingLeft: depth * 18 }}
                  >
                    {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                    <span>{node.nome}</span>
                  </button>
                ) : (
                  <span className={cn("flex max-w-[28rem] items-center", LEVEL_TONE[node.level])} style={{ paddingLeft: depth * 18 + 18 }}>
                    {node.nome}
                  </span>
                )}
              </td>
              {months.map((m) => (
                <td key={`${node.key}-${m.mes}`} className="px-3 py-2 whitespace-nowrap">
                  <MetricCell
                    metric={metric}
                    value={metricValue(node.byMonth[m.mes]?.entrada ?? 0, node.byMonth[m.mes]?.saida ?? 0, metric)}
                  />
                </td>
              ))}
              <td className="px-3 py-2 whitespace-nowrap">
                <MetricCell metric={metric} value={metricValue(node.entrada, node.saida, metric)} />
              </td>
            </tr>
            {hasChildren && expanded ? (
              <FluxoDrillRows nodes={node.children} depth={depth + 1} open={open} onToggle={onToggle} months={months} metric={metric} />
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}
