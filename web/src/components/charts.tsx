"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axis = { fill: "#8b9bb0", fontSize: 11 };
const grid = { stroke: "#263140" };
const tooltipStyle = {
  background: "#141b24",
  border: "1px solid #263140",
  borderRadius: 8,
  color: "#eef3f8",
};

export function CashflowChart({
  data,
}: {
  data: Array<{ mes: string; receber: number; pagar: number }>;
}) {
  if (!data.length) {
    return <p className="py-16 text-center text-sm text-mist">Sem baixas nesta carga ainda.</p>;
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" {...grid} vertical={false} />
          <XAxis dataKey="mes" tick={axis} />
          <YAxis tick={axis} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Bar dataKey="receber" name="Recebido" fill="#4ade80" radius={[4, 4, 0, 0]} />
          <Bar dataKey="pagar" name="Pago" fill="#fb7185" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AgingChart({ data }: { data: Array<{ faixa: string; valor: number }> }) {
  const labels: Record<string, string> = {
    "0_a_vencer": "A vencer",
    "1_ate_7d": "1–7 d",
    "2_ate_15d": "8–15 d",
    "3_ate_30d": "16–30 d",
    "4_ate_60d": "31–60 d",
    "5_acima_60d": "60+ d",
  };
  const mapped = data.map((d) => ({ ...d, label: labels[d.faixa] || d.faixa }));
  if (!mapped.length) {
    return <p className="py-16 text-center text-sm text-mist">Carteira aberta ainda vazia — a carga de títulos pode estar em andamento.</p>;
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={mapped}>
          <CartesianGrid strokeDasharray="3 3" {...grid} vertical={false} />
          <XAxis dataKey="label" tick={axis} />
          <YAxis tick={axis} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="valor" name="Aberto" fill="#d4a853" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProjectionChart({
  data,
}: {
  data: Array<{ dia: string; receber: number; pagar: number }>;
}) {
  if (!data.length) {
    return <p className="py-16 text-center text-sm text-mist">Sem títulos em aberto no horizonte de 45 dias.</p>;
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" {...grid} vertical={false} />
          <XAxis dataKey="dia" tick={axis} />
          <YAxis tick={axis} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Line type="monotone" dataKey="receber" name="A receber" stroke="#4ade80" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="pagar" name="A pagar" stroke="#fb7185" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
