// Logotipos de bancos e de clientes conhecidos, para identificação visual ao lado
// do nome. Arquivos em web/public/logos (bancos: github.com/Tgentil/Bancos-em-SVG;
// clientes: ícones dos sites oficiais). Sem arquivo, o selo mostra as iniciais.

export type Marca = {
  nome: string;
  sigla: string;
  cor: string;
  logo?: string;
};

const BANCOS: Record<string, Marca> = {
  "001": { nome: "Banco do Brasil", sigla: "BB", cor: "#F8D117" },
  "004": { nome: "Banco do Nordeste", sigla: "BNB", cor: "#A6192E", logo: "/logos/bancos/004.svg" },
  "033": { nome: "Santander", sigla: "S", cor: "#EC0000", logo: "/logos/bancos/033.svg" },
  "104": { nome: "Caixa", sigla: "CX", cor: "#005CA9", logo: "/logos/bancos/104.svg" },
  "237": { nome: "Bradesco", sigla: "B", cor: "#CC092F", logo: "/logos/bancos/237.svg" },
  "341": { nome: "Itaú", sigla: "I", cor: "#EC7000", logo: "/logos/bancos/341.svg" },
};

// Raiz do CNPJ (8 dígitos) → rede. Pela raiz e não pelo nome: no Omie as lojas
// vêm cadastradas com nomes como "HIPER SUL" ou "GB ATALAIA".
const CLIENTES: Array<Marca & { raizes: string[] }> = [
  { nome: "GBarbosa", sigla: "GB", cor: "#E30613", logo: "/logos/clientes/gbarbosa.png", raizes: ["39346861", "09182947"] },
  { nome: "Assaí", sigla: "AS", cor: "#0D4C92", raizes: ["06057223"] },
  { nome: "Atakarejo", sigla: "AT", cor: "#1F2A6B", logo: "/logos/clientes/atakarejo.jpg", raizes: ["73849952"] },
  { nome: "Mateus", sigla: "M", cor: "#E30613", logo: "/logos/clientes/mateus.png", raizes: ["03995515"] },
  { nome: "Supermercado Bombom", sigla: "BB", cor: "#64748B", raizes: ["04136442"] },
  { nome: "Ki Barato", sigla: "KB", cor: "#64748B", raizes: ["32860231"] },
];

export function marcaBanco(codigo?: string | null): Marca | null {
  if (!codigo) return null;
  return BANCOS[String(codigo).padStart(3, "0")] ?? null;
}

export function marcaCliente(cnpj?: string | null): Marca | null {
  const digitos = String(cnpj ?? "").replace(/\D/g, "");
  if (digitos.length !== 14) return null;
  const raiz = digitos.slice(0, 8);
  return CLIENTES.find((c) => c.raizes.includes(raiz)) ?? null;
}

// Para gráficos: só o arquivo de logo (o selo de iniciais polui o eixo).
export function logoCliente(cnpj?: string | null): string | null {
  return marcaCliente(cnpj)?.logo ?? null;
}

// Linhas "por cliente/fornecedor" no formato do HBarChart, com logo quando houver.
export function barrasComLogo(rows: Array<{ nome: string; valor: number; cnpj?: string | null }>) {
  return rows.map((r) => ({ name: r.nome, value: Number(r.valor), icon: logoCliente(r.cnpj) }));
}
