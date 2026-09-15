export function githubSyncConfigured(): boolean {
  return Boolean(process.env.SYNC_GITHUB_TOKEN && (process.env.SYNC_GITHUB_REPO || process.env.GITHUB_REPOSITORY));
}

export async function dispatchGithubSync(appKey?: string | null): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.SYNC_GITHUB_TOKEN;
  const repo = process.env.SYNC_GITHUB_REPO || process.env.GITHUB_REPOSITORY || "GabrielCNovaesDev/CostaNovaesBI";
  if (!token) {
    return { ok: false, error: "SYNC_GITHUB_TOKEN nao configurado" };
  }
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/sync-omie.yml/dispatches`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      ref: process.env.SYNC_GITHUB_REF || "main",
      inputs: { app_key: appKey || "" },
    }),
  });
  if (res.status === 204) return { ok: true };
  const text = await res.text();
  return { ok: false, error: `GitHub ${res.status}: ${text.slice(0, 200)}` };
}
