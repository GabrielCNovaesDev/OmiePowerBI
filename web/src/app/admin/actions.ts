"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getAplicativo, getAplicativoSecret, replaceUsuarioApps } from "@/lib/admin-data";
import { query } from "@/lib/db";
import { dispatchGithubSync, githubSyncConfigured } from "@/lib/github-sync";
import { testOmieCredentials } from "@/lib/omie-test";
import { decryptSecret, encryptSecret } from "@/lib/secret";

function str(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export async function saveAplicativo(formData: FormData) {
  const session = await requireAdmin();
  const id = str(formData, "id");
  const apelido = str(formData, "apelido");
  const appKey = str(formData, "app_key");
  const appSecret = str(formData, "app_secret");
  const ativo = formData.get("ativo") === "on";
  const syncHabilitado = formData.get("sync_habilitado") === "on";

  if (!apelido || !appKey) {
    redirect("/admin/aplicativos/novo?error=Preencha+apelido+e+App+Key");
  }

  let secretToStore: string | null = appSecret ? encryptSecret(appSecret) : null;
  let secretForTest = appSecret;
  if (!secretForTest && id) {
    const encrypted = await getAplicativoSecret(id);
    if (encrypted) secretForTest = decryptSecret(encrypted);
  }
  if (!secretForTest) {
    redirect("/admin/aplicativos/novo?error=Informe+o+App+Secret");
  }

  const test = await testOmieCredentials(appKey, secretForTest);
  if (!test.ok) {
    const dest = id ? `/admin/aplicativos/${id}` : "/admin/aplicativos/novo";
    redirect(`${dest}?error=${encodeURIComponent(test.error || "Chaves Omie invalidas")}`);
  }

  try {
    if (id) {
      if (secretToStore) {
        await query(
          `UPDATE ops.aplicativo
           SET apelido=$2, app_key=$3, app_secret_encrypted=$4, razao_social_cache=$5,
               ativo=$6, sync_habilitado=$7, updated_at=NOW()
           WHERE id=$1`,
          [id, apelido, appKey, secretToStore, test.razaoSocial, ativo, syncHabilitado]
        );
      } else {
        await query(
          `UPDATE ops.aplicativo
           SET apelido=$2, app_key=$3, razao_social_cache=$4, ativo=$5, sync_habilitado=$6, updated_at=NOW()
           WHERE id=$1`,
          [id, apelido, appKey, test.razaoSocial, ativo, syncHabilitado]
        );
      }
    } else {
      await query(
        `INSERT INTO ops.aplicativo (apelido, razao_social_cache, app_key, app_secret_encrypted, ativo, sync_habilitado)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [apelido, test.razaoSocial, appKey, encryptSecret(secretForTest), ativo, syncHabilitado]
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao salvar";
    const dest = id ? `/admin/aplicativos/${id}` : "/admin/aplicativos/novo";
    if (/unique|duplicate/i.test(message)) {
      redirect(`${dest}?error=Essa+App+Key+ja+esta+cadastrada`);
    }
    redirect(`${dest}?error=${encodeURIComponent(message)}`);
  }

  void session;
  revalidatePath("/admin");
  redirect("/admin/aplicativos?ok=Empresa+salva");
}

export async function saveUsuario(formData: FormData) {
  const session = await requireAdmin();
  const id = str(formData, "id");
  const nome = str(formData, "nome");
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");
  const papel = str(formData, "papel") as "admin" | "interno" | "cliente";
  const ativo = formData.get("ativo") === "on";
  const appIds = formData.getAll("apps").map(String).filter(Boolean);

  if (!nome || !email) {
    redirect("/admin/usuarios/novo?error=Preencha+nome+e+e-mail");
  }
  if (!["admin", "interno", "cliente"].includes(papel)) {
    redirect("/admin/usuarios/novo?error=Papel+invalido");
  }
  if (papel === "cliente" && appIds.length === 0) {
    const dest = id ? `/admin/usuarios/${id}` : "/admin/usuarios/novo";
    redirect(`${dest}?error=Cliente+precisa+de+pelo+menos+uma+empresa`);
  }
  if (!id && password.length < 10) {
    redirect("/admin/usuarios/novo?error=Senha+com+no+minimo+10+caracteres");
  }
  if (id && password && password.length < 10) {
    redirect(`/admin/usuarios/${id}?error=Senha+com+no+minimo+10+caracteres`);
  }

  if (id && id === session.user.id && !ativo) {
    redirect(`/admin/usuarios/${id}?error=Voce+nao+pode+desativar+a+si+mesmo`);
  }

  let usuarioId = id;
  if (id) {
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      await query(
        `UPDATE auth.usuario SET nome=$2, email=$3, senha_hash=$4, papel=$5::auth.papel, ativo=$6 WHERE id=$1`,
        [id, nome, email, hash, papel, ativo]
      );
    } else {
      await query(
        `UPDATE auth.usuario SET nome=$2, email=$3, papel=$4::auth.papel, ativo=$5 WHERE id=$1`,
        [id, nome, email, papel, ativo]
      );
    }
  } else {
    const hash = await bcrypt.hash(password, 12);
    const rows = await query<{ id: string }>(
      `INSERT INTO auth.usuario (nome, email, senha_hash, papel, ativo)
       VALUES ($1,$2,$3,$4::auth.papel,$5)
       RETURNING id::text`,
      [nome, email, hash, papel, ativo]
    );
    usuarioId = rows[0]?.id || "";
  }

  if (!usuarioId) redirect("/admin/usuarios?error=Falha+ao+salvar");
  if (papel === "cliente") await replaceUsuarioApps(usuarioId, appIds);
  else await replaceUsuarioApps(usuarioId, []);

  revalidatePath("/admin");
  redirect("/admin/usuarios?ok=Usuario+salvo");
}

export async function requestSync(formData: FormData) {
  const session = await requireAdmin();
  const appKey = str(formData, "app_key") || null;
  let aplicativoId: string | null = null;
  if (appKey) {
    const rows = await query<{ id: string }>(`SELECT id::text FROM ops.aplicativo WHERE app_key=$1`, [appKey]);
    aplicativoId = rows[0]?.id ?? null;
  }

  await query(
    `INSERT INTO ops.sync_job (aplicativo_id, app_key, origem, solicitado_por, status)
     VALUES ($1,$2,'manual',$3,'queued')`,
    [aplicativoId, appKey, session.user.id]
  );

  if (githubSyncConfigured()) {
    const dispatched = await dispatchGithubSync(appKey);
    if (!dispatched.ok) {
      redirect(`/admin/sync?error=${encodeURIComponent(dispatched.error || "Falha ao disparar carga")}`);
    }
    revalidatePath("/admin/sync");
    redirect("/admin/sync?ok=Carga+disparada+no+GitHub+Actions");
  }

  revalidatePath("/admin/sync");
  redirect(
    "/admin/sync?error=" +
      encodeURIComponent(
        "Pedido registrado. Configure SYNC_GITHUB_TOKEN na Vercel para disparar a carga, ou rode npm run load:all nesta maquina."
      )
  );
}
