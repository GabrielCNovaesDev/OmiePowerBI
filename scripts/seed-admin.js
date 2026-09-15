require("dotenv").config();
const bcrypt = require("bcryptjs");
const { getPool, query } = require("../src/db/pool");

async function main() {
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const nome = process.env.ADMIN_NAME || "Administrador";
  if (!email || !password) {
    throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no .env");
  }
  if (password.length < 10) {
    throw new Error("ADMIN_PASSWORD deve ter pelo menos 10 caracteres");
  }

  const hash = await bcrypt.hash(password, 12);
  const r = await query(
    `INSERT INTO auth.usuario (nome, email, senha_hash, papel, ativo, deve_trocar_senha)
     VALUES ($1,$2,$3,'admin', true, false)
     ON CONFLICT (email) DO UPDATE SET
       nome = EXCLUDED.nome,
       senha_hash = EXCLUDED.senha_hash,
       papel = 'admin',
       ativo = true
     RETURNING id, email, papel`,
    [nome, email, hash]
  );
  console.log("Admin gravado:", r.rows[0]);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => {});
  });
