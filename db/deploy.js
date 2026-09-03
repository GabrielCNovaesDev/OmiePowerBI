require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('✅ Conectado ao Neon');

  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await client.query(sql);
  console.log('✅ Schema executado com sucesso');

  const { rows } = await client.query(`
    SELECT schemaname, tablename 
    FROM pg_tables 
    WHERE schemaname IN ('dim','fato','stg','ops')
    ORDER BY schemaname, tablename
  `);
  console.log(`\n📊 ${rows.length} tabelas criadas:`);
  rows.forEach(r => console.log(`   ${r.schemaname}.${r.tablename}`));

  await client.end();
}

main().catch(err => { console.error('❌ Erro:', err.message); process.exit(1); });
