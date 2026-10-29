// Importa o de/para de categorias do Fluxo de Caixa Livre de uma empresa.
//
//   node scripts/importar-depara-fluxo.js <app_key> <depara.json> [--gravar]
//
// depara.json: lista de { categoria, tipo, classificacao, subgrupo, categoria_ajustada },
// uma linha por categoria da planilha de configuração (aba "configuracoes").
// Casa cada categoria-folha do Omie pelo nome (sem acento/caixa) e pelo tipo
// (1.x = ENTRADAS, 2.x = SAÍDAS). Sem --gravar, só mostra o que faria.
require("dotenv").config();
const fs = require("fs");
const { query, withTransaction, getPool } = require("../src/db/pool");

const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

async function main() {
  const [appKey, arquivo] = process.argv.slice(2);
  const gravar = process.argv.includes("--gravar");
  if (!appKey || !arquivo) throw new Error("uso: node scripts/importar-depara-fluxo.js <app_key> <depara.json> [--gravar]");

  const depara = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  const cats = (
    await query(
      `SELECT codigo, descricao, conta_inativa FROM dim.categoria
       WHERE app_key=$1 AND totalizadora <> 'S' AND transferencia <> 'S' AND descricao <> '<Disponível>'
       ORDER BY codigo`,
      [appKey]
    )
  ).rows;

  const linhas = [];
  const semPar = [];
  for (const c of cats) {
    const entrada = c.codigo.startsWith("1.");
    const hit = depara.find(
      (d) => norm(d.categoria) === norm(c.descricao) && norm(d.tipo).startsWith(entrada ? "entrada" : "saida")
    );
    if (!hit) {
      semPar.push(`${c.codigo} ${c.descricao}${c.conta_inativa === "S" ? " (inativa)" : ""}`);
      continue;
    }
    linhas.push([appKey, c.codigo, hit.classificacao, hit.subgrupo, hit.categoria_ajustada || c.descricao, hit.tipo]);
  }

  console.log(`categorias: ${cats.length} | casadas: ${linhas.length} | sem par: ${semPar.length}`);
  if (semPar.length) console.log("sem par (ficam como Não classificado):\n  " + semPar.join("\n  "));
  if (!gravar) {
    console.log("\nnada gravado (use --gravar)");
    return;
  }
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM ops.categoria_fluxo WHERE app_key=$1`, [appKey]);
    for (const l of linhas) {
      await client.query(
        `INSERT INTO ops.categoria_fluxo (app_key, codigo_categoria, classificacao, subgrupo, categoria_ajustada, tipo)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        l
      );
    }
  });
  console.log(`\n${linhas.length} linhas gravadas em ops.categoria_fluxo`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => getPool().end().catch(() => {}));
