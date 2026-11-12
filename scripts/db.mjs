// Ferramenta de banco do TechPoint.
// Usa a API de gestão do Supabase (HTTPS), sem precisar de Docker nem conexão direta ao Postgres.
//
//   node scripts/db.mjs migrate        aplica as migrações pendentes de supabase/migrations
//   node scripts/db.mjs seed           aplica supabase/seed.sql (+ admin do .env)
//   node scripts/db.mjs sql "<sql>"    roda um SQL avulso
//
// Variáveis (arquivo .env na raiz): SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN (opcional
// no ambiente de nuvem, onde o token é injetado pelo proxy), SEED_ADMIN_EMAIL.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnv() {
  const file = join(root, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export async function sql(query) {
  loadEnv();
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!ref) throw new Error('Defina SUPABASE_PROJECT_REF no .env');
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.SUPABASE_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`;
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers, body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Erro SQL (${res.status}): ${text}`);
  return JSON.parse(text);
}

const quote = (s) => `'${String(s).replace(/'/g, "''")}'`;

async function migrate() {
  await sql(`create schema if not exists app_private;
    create table if not exists app_private.schema_migrations (name text primary key, applied_at timestamptz default now());`);
  const done = new Set((await sql('select name from app_private.schema_migrations')).map((r) => r.name));
  const dir = join(root, 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    process.stdout.write(`Aplicando ${f}... `);
    const body = readFileSync(join(dir, f), 'utf8');
    // Tudo numa transação: ou aplica inteira, ou nada.
    await sql(`begin;\n${body}\ninsert into app_private.schema_migrations(name) values (${quote(f)});\ncommit;`);
    console.log('ok');
  }
  console.log('Banco atualizado.');
}

async function seed() {
  const body = readFileSync(join(root, 'supabase', 'seed.sql'), 'utf8');
  await sql(`begin;\n${body}\ncommit;`);
  const admin = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
  if (admin) {
    await sql(`select app_private.seed_admin(${quote(admin)});`);
    console.log(`Admin/gestor/treinador/atleta de teste ligado a ${admin}.`);
  }
  console.log('Dados de exemplo aplicados.');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const [cmd, arg] = process.argv.slice(2);
  const run = { migrate, seed, sql: async () => console.log(JSON.stringify(await sql(arg), null, 2)) }[cmd];
  if (!run) { console.log('Uso: node scripts/db.mjs migrate | seed | sql "<sql>"'); process.exit(1); }
  run().catch((e) => { console.error(e.message); process.exit(1); });
}
