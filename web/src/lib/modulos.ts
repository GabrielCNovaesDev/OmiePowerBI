// Telas que podem ser ligadas/desligadas por empresa (ops.aplicativo.modulos_desativados).
// O Resumo é a página inicial e fica sempre ligado; "Qualidade & Sync" não é módulo
// de empresa: só aparece para o papel desenvolvedor.

export type ModuloId =
  | "saldo"
  | "fluxo"
  | "fluxo_previsto"
  | "resultado"
  | "dre"
  | "previsto"
  | "receitas"
  | "custos"
  | "despesas"
  | "nfs"
  | "qa"
  | "validacao"
  | "check"
  | "diario"
  | "mensal"
  | "receber"
  | "pagar"
  | "titulos"
  | "extrato";

export type Modulo = {
  id: ModuloId;
  label: string;
  grupo: "Dashboards" | "Relatórios";
  // Rota da tela; módulos sem rota são partes de outra tela.
  href?: string;
  descricao?: string;
};

export const MODULOS: Modulo[] = [
  { id: "saldo", label: "Saldo", grupo: "Dashboards", href: "/saldo" },
  { id: "fluxo", label: "Fluxo de Caixa", grupo: "Dashboards", href: "/fluxo" },
  {
    id: "fluxo_previsto",
    label: "Fluxo de Caixa — Previsto",
    grupo: "Dashboards",
    descricao: "Modos Previsto e Atual + Previsto dentro do Fluxo de Caixa",
  },
  { id: "resultado", label: "Resultados", grupo: "Dashboards", href: "/resultado" },
  { id: "dre", label: "DRE", grupo: "Dashboards", href: "/dre" },
  { id: "previsto", label: "Previsto x Realizado", grupo: "Dashboards", href: "/previsto" },
  { id: "receitas", label: "Receitas", grupo: "Dashboards", href: "/receitas" },
  { id: "custos", label: "Custos", grupo: "Dashboards", href: "/custos" },
  { id: "despesas", label: "Despesas", grupo: "Dashboards", href: "/despesas" },
  { id: "nfs", label: "NFs", grupo: "Dashboards", href: "/nfs" },
  { id: "qa", label: "Q&A", grupo: "Dashboards", href: "/qa" },
  { id: "validacao", label: "Validação Omie", grupo: "Relatórios", href: "/validacao" },
  { id: "check", label: "Check Panel", grupo: "Relatórios", href: "/check" },
  { id: "diario", label: "Relatório Diário", grupo: "Relatórios", href: "/diario" },
  { id: "mensal", label: "Relatório Mensal", grupo: "Relatórios", href: "/mensal" },
  { id: "receber", label: "Contas a receber", grupo: "Relatórios", href: "/receber" },
  { id: "pagar", label: "Contas a pagar", grupo: "Relatórios", href: "/pagar" },
  { id: "titulos", label: "Lançamentos", grupo: "Relatórios", href: "/titulos" },
  { id: "extrato", label: "Extrato", grupo: "Relatórios", href: "/extrato" },
];

const IDS = new Set<string>(MODULOS.map((m) => m.id));

export const ROTA_DESENVOLVEDOR = "/sync";
// Telas em teste: só admin/desenvolvedor.
export const ROTAS_STAFF = ["/fluxo-livre"];

export function isModuloId(value: string): value is ModuloId {
  return IDS.has(value);
}

export function moduloDaRota(pathname: string): ModuloId | null {
  const hit = MODULOS.find((m) => m.href && (pathname === m.href || pathname.startsWith(`${m.href}/`)));
  return hit?.id ?? null;
}

// Rotas que o menu deve esconder para o usuário atual.
export function rotasOcultas(desativados: string[], desenvolvedor: boolean, staff: boolean): string[] {
  const off = new Set(desativados);
  const rotas = MODULOS.filter((m) => m.href && off.has(m.id)).map((m) => m.href!);
  if (!desenvolvedor) rotas.push(ROTA_DESENVOLVEDOR);
  if (!staff) rotas.push(...ROTAS_STAFF);
  return rotas;
}
