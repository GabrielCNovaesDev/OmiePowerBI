require("dotenv").config();
const { encryptSecret } = require("../src/lib/secret");
const { getPool, query } = require("../src/db/pool");
const { omieCall, withOmieCreds } = require("../src/omie/client");

function arg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function usage() {
  console.log(`Uso:
  npm run add:aplicativo -- --apelido "Cliente XYZ" --app-key 123 --app-secret abc123

Opcoes:
  --apelido      Nome que aparece no seletor do BI (obrigatorio)
  --app-key      App Key da Omie (obrigatorio)
  --app-secret   App Secret da Omie (obrigatorio)
  --skip-test    Nao chama a Omie para validar as chaves
`);
}

async function testOmie(appKey, appSecret) {
  return withOmieCreds({ app_key: appKey, app_secret: appSecret }, () =>
    omieCall("https://app.omie.com.br/api/v1/geral/empresas/", "ListarEmpresas", {
      pagina: 1,
      registros_por_pagina: 10,
    })
  );
}

async function main() {
  const apelido = arg("apelido");
  const appKey = arg("app-key") || arg("key");
  const appSecret = arg("app-secret") || arg("secret");
  const skipTest = process.argv.includes("--skip-test");

  if (!apelido || !appKey || !appSecret) {
    usage();
    throw new Error("Informe --apelido, --app-key e --app-secret");
  }
  if (!process.env.APP_ENCRYPTION_KEY && !process.env.ENCRYPTION_KEY) {
    throw new Error("Defina APP_ENCRYPTION_KEY no .env");
  }

  let razao = null;
  if (!skipTest) {
    console.log("Testando chaves na Omie...");
    const json = await testOmie(appKey, appSecret);
    const lista = json.empresas_cadastro || json.empresas || [];
    const primeira = lista[0] || {};
    razao = primeira.razao_social || primeira.cRazaoSocial || null;
    console.log("Omie OK", razao ? `— ${razao}` : "");
  }

  const encrypted = encryptSecret(appSecret);
  const inserted = await query(
    `INSERT INTO ops.aplicativo (apelido, razao_social_cache, app_key, app_secret_encrypted, ativo, sync_habilitado)
     VALUES ($1,$2,$3,$4, true, true)
     ON CONFLICT (app_key) DO UPDATE SET
       apelido = EXCLUDED.apelido,
       razao_social_cache = COALESCE(EXCLUDED.razao_social_cache, ops.aplicativo.razao_social_cache),
       app_secret_encrypted = EXCLUDED.app_secret_encrypted,
       ativo = true,
       sync_habilitado = true,
       updated_at = NOW()
     RETURNING id, app_key, apelido, razao_social_cache`,
    [apelido, razao, appKey, encrypted]
  );

  const row = inserted.rows[0];
  console.log("Aplicativo gravado:", row);
  console.log("\nProximo passo — puxar os dados dessa empresa:");
  console.log(`  node scripts/load-full.js ${row.app_key}`);
  console.log("\nAdmin e interno veem a empresa no seletor apos o login.");
  console.log("Nao altere OMIE_APP_KEY no .env: o segundo app fica so no banco.");
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => {});
  });
