"use client";

import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import { compactMoney } from "@/lib/format";
import echarts from "@/lib/echarts";

const ReactECharts = dynamic(
  () => import("echarts-for-react/esm/core").then((mod) => mod.default),
  { ssr: false }
);

const COLORS = {
  receive: "#4ea3d9",
  pay: "#e06a6a",
  cyan: "#00c2d4",
  gold: "#e3b341",
  gain: "#2f9e6b",
  ink: "#1c2430",
  mist: "#6b7787",
  grid: "#e4e9ee",
};

function Chart({ option, height = 280, empty }: { option: EChartsOption | null; height?: number; empty?: string }) {
  if (!option) {
    return <p className="py-14 text-center text-sm text-mist">{empty ?? "Sem dados neste recorte."}</p>;
  }
  return <ReactECharts echarts={echarts} option={option} style={{ height }} notMerge lazyUpdate />;
}

const moneyAxis = {
  type: "value" as const,
  axisLabel: { color: COLORS.mist, formatter: (v: number) => compactMoney(v) },
  splitLine: { lineStyle: { color: COLORS.grid } },
};

export function ComboCashflow({
  labels,
  entradas,
  saidas,
  saldo,
  height = 320,
}: {
  labels: string[];
  entradas: number[];
  saidas: number[];
  saldo: number[];
  height?: number;
}) {
  if (!labels.length) return <Chart option={null} />;
  const option: EChartsOption = {
    tooltip: { trigger: "axis" },
    legend: { data: ["Entrada", "Saída", "Saldo em conta"], bottom: 0, textStyle: { color: COLORS.mist } },
    grid: { left: 56, right: 56, top: 24, bottom: 48 },
    xAxis: { type: "category", data: labels, axisLabel: { color: COLORS.mist } },
    yAxis: [
      moneyAxis,
      { ...moneyAxis, position: "right" },
    ],
    series: [
      { name: "Entrada", type: "bar", data: entradas, itemStyle: { color: COLORS.receive, borderRadius: [3, 3, 0, 0] }, barGap: "10%" },
      { name: "Saída", type: "bar", data: saidas, itemStyle: { color: COLORS.pay, borderRadius: [3, 3, 0, 0] } },
      { name: "Saldo em conta", type: "line", yAxisIndex: 1, data: saldo, itemStyle: { color: COLORS.gold }, lineStyle: { width: 3 }, symbolSize: 8 },
    ],
  };
  return <Chart option={option} height={height} />;
}

export function ComboCashflowAtualPrevisto({
  labels,
  entradaAtual,
  saidaAtual,
  entradaPrev,
  saidaPrev,
  saldoAtual,
  saldoPrevisto,
  height = 360,
}: {
  labels: string[];
  entradaAtual: number[];
  saidaAtual: number[];
  entradaPrev: number[];
  saidaPrev: number[];
  saldoAtual: Array<number | null>;
  saldoPrevisto: number[];
  height?: number;
}) {
  if (!labels.length) return <Chart option={null} />;
  const option: EChartsOption = {
    tooltip: { trigger: "axis" },
    legend: {
      data: ["Entrada atual", "Entrada prevista", "Saída atual", "Saída prevista", "Saldo atual", "Saldo previsto"],
      bottom: 0,
      textStyle: { color: COLORS.mist },
    },
    grid: { left: 56, right: 56, top: 24, bottom: 72 },
    xAxis: { type: "category", data: labels, axisLabel: { color: COLORS.mist } },
    yAxis: [moneyAxis, { ...moneyAxis, position: "right" }],
    series: [
      { name: "Entrada atual", type: "bar", stack: "entrada", data: entradaAtual, itemStyle: { color: COLORS.receive, borderRadius: [0, 0, 0, 0] } },
      { name: "Entrada prevista", type: "bar", stack: "entrada", data: entradaPrev, itemStyle: { color: "#9fd4ee", borderRadius: [3, 3, 0, 0] } },
      { name: "Saída atual", type: "bar", stack: "saida", data: saidaAtual, itemStyle: { color: COLORS.pay } },
      { name: "Saída prevista", type: "bar", stack: "saida", data: saidaPrev, itemStyle: { color: "#f0a8a8", borderRadius: [3, 3, 0, 0] } },
      {
        name: "Saldo atual",
        type: "line",
        yAxisIndex: 1,
        data: saldoAtual,
        itemStyle: { color: COLORS.cyan },
        lineStyle: { width: 2 },
        symbolSize: 7,
        connectNulls: false,
      },
      {
        name: "Saldo previsto",
        type: "line",
        yAxisIndex: 1,
        data: saldoPrevisto,
        itemStyle: { color: COLORS.gold },
        lineStyle: { width: 3 },
        symbolSize: 8,
      },
    ],
  };
  return <Chart option={option} height={height} />;
}

export function DailyCashflow({
  labels,
  entradas,
  saidas,
  saldo,
  height = 220,
}: {
  labels: string[];
  entradas: number[];
  saidas: number[];
  saldo: number[];
  height?: number;
}) {
  if (!labels.length) return <Chart option={null} />;
  const option: EChartsOption = {
    tooltip: { trigger: "axis" },
    legend: { data: ["Entradas", "Saídas", "Saldo em conta"], bottom: 0, textStyle: { color: COLORS.mist } },
    grid: { left: 48, right: 16, top: 16, bottom: 40 },
    xAxis: { type: "category", data: labels, axisLabel: { color: COLORS.mist } },
    yAxis: moneyAxis,
    series: [
      { name: "Entradas", type: "bar", data: entradas, itemStyle: { color: COLORS.receive } },
      { name: "Saídas", type: "bar", data: saidas, itemStyle: { color: COLORS.pay } },
      { name: "Saldo em conta", type: "line", data: saldo, itemStyle: { color: "#e67e22" }, symbol: "circle", symbolSize: 7 },
    ],
  };
  return <Chart option={option} height={height} />;
}

export function DonutChart({
  data,
  center,
  colors,
}: {
  data: Array<{ name: string; value: number }>;
  center?: string;
  colors?: string[];
}) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <Chart option={null} />;
  const option: EChartsOption = {
    tooltip: { trigger: "item", formatter: (p: unknown) => {
      const x = p as { name: string; value: number; percent: number };
      return `${x.name}<br/>${compactMoney(x.value)} (${x.percent}%)`;
    } },
    color: colors ?? ["#7ec8e3", "#4ea3d9", "#2b7fb8", "#f0b429", "#e06a6a"],
    series: [
      {
        type: "pie",
        radius: ["52%", "78%"],
        label: { show: true, formatter: "{b}\n{d}%", color: COLORS.mist, fontSize: 11 },
        data: filtered,
      },
    ],
    graphic: center
      ? [{ type: "text" as const, left: "center", top: "middle", style: { text: center, fill: COLORS.ink, fontSize: 16, fontWeight: 600 } }]
      : undefined,
  };
  return <Chart option={option} height={260} />;
}

export function HBarChart({
  data,
  color = COLORS.receive,
}: {
  data: Array<{ name: string; value: number; icon?: string | null }>;
  color?: string;
}) {
  const rows = data.filter((d) => d.value !== 0).slice(0, 12).reverse();
  if (!rows.length) return <Chart option={null} />;
  // Logo opcional antes do nome (rich text do ECharts: um estilo por imagem).
  const rich: Record<string, { backgroundColor: { image: string }; width: number; height: number }> = {};
  rows.forEach((r, i) => {
    if (r.icon) rich[`i${i}`] = { backgroundColor: { image: r.icon }, width: 14, height: 14 };
  });
  const option: EChartsOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: "value", axisLabel: { color: COLORS.mist, formatter: (v: number) => compactMoney(v) }, splitLine: { lineStyle: { color: COLORS.grid } } },
    yAxis: {
      type: "category",
      data: rows.map((r) => r.name),
      axisLabel: {
        color: COLORS.ink,
        width: 140,
        overflow: "truncate",
        rich,
        formatter: (value: string, index: number) => (rich[`i${index}`] ? `{i${index}|}  ${value}` : value),
      },
    },
    series: [
      {
        type: "bar",
        data: rows.map((r) => r.value),
        itemStyle: { color, borderRadius: [0, 3, 3, 0] },
        label: {
          show: true,
          position: "right",
          formatter: (p) => compactMoney(Number(p.value ?? 0)),
          color: COLORS.mist,
          fontSize: 10,
        },
      },
    ],
  };
  return <Chart option={option} height={Math.max(220, rows.length * 28)} />;
}

export function AreaLine({ labels, series }: { labels: string[]; series: Array<{ name: string; data: number[]; color: string }> }) {
  if (!labels.length) return <Chart option={null} />;
  const option: EChartsOption = {
    tooltip: { trigger: "axis" },
    grid: { left: 48, right: 16, top: 24, bottom: 28 },
    xAxis: { type: "category", data: labels, axisLabel: { color: COLORS.mist } },
    yAxis: moneyAxis,
    series: series.map((s) => ({
      name: s.name,
      type: "line",
      data: s.data,
      smooth: true,
      areaStyle: { opacity: 0.18 },
      itemStyle: { color: s.color },
      showSymbol: false,
    })),
  };
  return <Chart option={option} height={180} />;
}

export function GaugePct({ value, target = 35 }: { value: number; target?: number }) {
  const needle = Math.min(Math.max(value, 0), 100);
  const option: EChartsOption = {
    series: [
      {
        type: "gauge",
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        center: ["50%", "58%"],
        radius: "92%",
        pointer: { show: true, length: "60%" },
        axisLine: {
          lineStyle: {
            width: 14,
            color: [
              [0.45, "#e06a6a"],
              [0.7, "#e3b341"],
              [1, "#2f9e6b"],
            ],
          },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: { formatter: () => `${value.toFixed(1)}%`, fontSize: 18, offsetCenter: [0, "58%"], color: COLORS.ink },
        data: [{ value: needle, name: `Meta ${target.toFixed(0)}%` }],
        title: {
          show: true,
          offsetCenter: [0, "-58%"],
          color: COLORS.mist,
          fontSize: 11,
          fontWeight: 500,
        },
      },
    ],
  };
  return <Chart option={option} height={180} />;
}

export function Waterfall({ labels, values }: { labels: string[]; values: number[] }) {
  if (!labels.length) return <Chart option={null} />;
  let acc = 0;
  const helpers = values.map((v, i) => {
    if (i === 0) {
      acc = v;
      return 0;
    }
    const base = v >= 0 ? acc : acc + v;
    acc += v;
    return Math.max(base, 0);
  });
  const option: EChartsOption = {
    tooltip: { trigger: "axis" },
    grid: { left: 56, right: 16, top: 24, bottom: 72 },
    xAxis: { type: "category", data: labels, axisLabel: { color: COLORS.mist, rotate: 30 } },
    yAxis: moneyAxis,
    series: [
      { type: "bar", stack: "w", data: helpers, itemStyle: { color: "transparent" }, silent: true },
      {
        type: "bar",
        stack: "w",
        data: values.map((v) => ({ value: Math.abs(v), itemStyle: { color: v >= 0 ? COLORS.receive : COLORS.pay } })),
        label: { show: true, formatter: (p: { dataIndex: number }) => compactMoney(values[p.dataIndex] ?? 0), fontSize: 10 },
      },
    ],
  };
  return <Chart option={option} height={280} />;
}

export function ScatterOutliers({
  points,
  height = 380,
}: {
  points: Array<{ categoria: string; valor: number; outlier: boolean; cliente: string; numero: string | null }>;
  height?: number;
}) {
  if (!points.length) return <Chart option={null} />;
  const cats = Array.from(new Set(points.map((p) => p.categoria))).slice(0, 24);
  const index = new Map(cats.map((c, i) => [c, i]));
  const inShown = points.filter((p) => index.has(p.categoria));
  const toPoint = (p: (typeof points)[number]) => ({
    value: [index.get(p.categoria) ?? 0, p.valor] as [number, number],
    categoria: p.categoria,
    cliente: p.cliente,
    numero: p.numero,
  });
  const option: EChartsOption = {
    tooltip: {
      trigger: "item",
      formatter: (p: unknown) => {
        const x = p as { seriesName: string; data: { categoria: string; cliente: string; numero: string | null; value: [number, number] } };
        const d = x.data;
        return `${d.categoria}<br/>${x.seriesName}<br/>${compactMoney(d.value[1])}<br/>${d.cliente}${d.numero ? `<br/>Doc. ${d.numero}` : ""}`;
      },
    },
    legend: { data: ["Dentro da faixa", "Desvio"], bottom: 0, textStyle: { color: COLORS.mist } },
    grid: { left: 56, right: 16, top: 16, bottom: 88 },
    xAxis: {
      type: "category",
      data: cats,
      axisLabel: { color: COLORS.mist, rotate: 28, width: 88, overflow: "truncate", interval: 0 },
    },
    yAxis: moneyAxis,
    series: [
      {
        name: "Dentro da faixa",
        type: "scatter",
        symbolSize: 8,
        itemStyle: { color: COLORS.receive, opacity: 0.7 },
        data: inShown.filter((p) => !p.outlier).map(toPoint),
      },
      {
        name: "Desvio",
        type: "scatter",
        symbolSize: 12,
        itemStyle: { color: COLORS.pay },
        data: inShown.filter((p) => p.outlier).map(toPoint),
      },
    ],
  };
  return <Chart option={option} height={height} />;
}

export function Spark({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const option: EChartsOption = {
    grid: { left: 0, right: 0, top: 8, bottom: 0 },
    xAxis: { type: "category", show: false, data: data.map((_, i) => i) },
    yAxis: { type: "value", show: false },
    series: [{ type: "line", data, showSymbol: false, areaStyle: { opacity: 0.25 }, itemStyle: { color }, lineStyle: { width: 2 } }],
  };
  return <Chart option={option} height={64} />;
}
