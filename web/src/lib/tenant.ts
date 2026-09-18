import { cache } from "react";
import { query } from "./db";
import type { Session } from "next-auth";
import type { Papel } from "@/auth.config";

export type { Papel };

export type EmpresaOpt = {
  app_key: string;
  apelido: string;
  razao_social: string | null;
};

export type Tenant = {
  userId: string;
  nome: string;
  email: string;
  papel: Papel;
  allowedKeys: string[];
  selectedKeys: string[];
  empresas: EmpresaOpt[];
  canPickEmpresa: boolean;
};

function isStaff(papel: Papel) {
  return papel === "admin" || papel === "interno";
}

const loadFromAplicativo = cache(async function loadFromAplicativo(userId: string, papel: Papel): Promise<EmpresaOpt[]> {
  try {
    if (isStaff(papel)) {
      return query<EmpresaOpt>(
        `SELECT app_key, apelido, razao_social_cache AS razao_social
         FROM ops.aplicativo
         WHERE ativo = true
         ORDER BY apelido, id`
      );
    }
    return query<EmpresaOpt>(
      `SELECT a.app_key, a.apelido, a.razao_social_cache AS razao_social
       FROM ops.aplicativo a
       JOIN auth.usuario_aplicativo ua ON ua.aplicativo_id = a.id
       WHERE ua.usuario_id = $1 AND a.ativo = true
       ORDER BY a.apelido, a.id`,
      [Number(userId)]
    );
  } catch {
    return [];
  }
});

const loadFromDimEmpresa = cache(async function loadFromDimEmpresa(): Promise<EmpresaOpt[]> {
  try {
    return query<EmpresaOpt>(
      `SELECT app_key,
              COALESCE(nome_fantasia, razao_social, app_key) AS apelido,
              razao_social
       FROM dim.empresa
       ORDER BY id`
    );
  } catch {
    return [];
  }
});

export async function resolveTenant(session: Session, empresaParam?: string | null): Promise<Tenant> {
  const user = session.user;
  const papel = (user.papel || "cliente") as Papel;
  const userId = String(user.id);
  let empresas = await loadFromAplicativo(userId, papel);
  if (!empresas.length && isStaff(papel)) {
    empresas = await loadFromDimEmpresa();
  }

  const allowedKeys = empresas.map((e) => e.app_key);
  const canPickEmpresa = allowedKeys.length > 1;
  let selectedKeys = allowedKeys;

  if (empresaParam && empresaParam !== "todas" && allowedKeys.includes(empresaParam)) {
    selectedKeys = [empresaParam];
  } else if (!canPickEmpresa) {
    selectedKeys = allowedKeys;
  }

  return {
    userId,
    nome: user.name || user.email || "Usuário",
    email: user.email || "",
    papel,
    allowedKeys,
    selectedKeys,
    empresas,
    canPickEmpresa,
  };
}

export function tenantLabel(tenant: Tenant): string {
  if (!tenant.selectedKeys.length) return "Nenhuma empresa liberada";
  if (tenant.selectedKeys.length === 1) {
    const hit = tenant.empresas.find((e) => e.app_key === tenant.selectedKeys[0]);
    return hit?.apelido || hit?.razao_social || "Omie";
  }
  return `Consolidado (${tenant.selectedKeys.length})`;
}

export function empresaFromHeaders(urlHeader: string | null): string | undefined {
  if (!urlHeader) return undefined;
  try {
    const u = new URL(urlHeader);
    const v = u.searchParams.get("empresa");
    if (!v || v === "todas") return undefined;
    return v;
  } catch {
    return undefined;
  }
}
