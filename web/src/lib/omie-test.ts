export type OmieTestResult = {
  ok: boolean;
  razaoSocial: string | null;
  error?: string;
};

export async function testOmieCredentials(appKey: string, appSecret: string): Promise<OmieTestResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch("https://app.omie.com.br/api/v1/geral/empresas/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        call: "ListarEmpresas",
        param: [{ pagina: 1, registros_por_pagina: 10 }],
        app_key: appKey,
        app_secret: appSecret,
      }),
      signal: controller.signal,
    });
    const json = (await res.json()) as Record<string, unknown>;
    const fault = String(json.faultstring || json.faultcode || "");
    if (fault) return { ok: false, razaoSocial: null, error: fault };
    if (!res.ok) return { ok: false, razaoSocial: null, error: `HTTP ${res.status}` };
    const lista = (json.empresas_cadastro || json.empresas) as Array<Record<string, unknown>> | undefined;
    const first = lista?.[0] || {};
    const razao = String(first.razao_social || first.cRazaoSocial || first.nome_fantasia || "") || null;
    return { ok: true, razaoSocial: razao };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao falar com a Omie";
    return { ok: false, razaoSocial: null, error: message };
  } finally {
    clearTimeout(timer);
  }
}
