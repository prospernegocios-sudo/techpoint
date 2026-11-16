// Fase A do incentivo (habilitação): dirigentes com dados pessoais restritos e pasta de documentos da entidade.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../../scripts/db.mjs';

const id = (n) => `88888888-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { mgr: id(1), coach: id(2), mgr2: id(3), mgrOff: id(4) };
const ORG = id(100), ORG2 = id(101), ORGOFF = id(102);
const as = (uid) => `reset role; select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true); set local role authenticated;`;
const tryRun = (name, stmt) => {
  const isSelect = stmt.trim().toLowerCase().startsWith('select');
  const exec = isSelect ? `execute $q$select to_jsonb(s.v) from (${stmt}) s(v)$q$ into v;` : `execute $q$${stmt}$q$;`;
  return `do $t$ declare v jsonb; begin ${exec}
  insert into results values ('${name}', jsonb_build_object('ok', true, 'result', v));
exception when others then insert into results values ('${name}', jsonb_build_object('ok', false, 'error', sqlerrm)); end $t$;`;
};
const keep = (name, q) => `insert into results values ('${name}', (select to_jsonb(x) from (${q}) x limit 1));`;
const officer = (extra = '') => `'{"full_name":"Dirigente Teste","role_title":"Presidente","cpf":"52998224725","rg":"1234567","rg_issuer":"SSP/DF","birth_date":"1980-01-02","address":"Rua X, 1","is_signatory":true${extra}}'::jsonb`;

const scenario = `
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
 ('${U.mgr}','h.gestor@teste.local','authenticated','authenticated','{"full_name":"Gestor H"}'),
 ('${U.coach}','h.treinador@teste.local','authenticated','authenticated','{"full_name":"Treinador H"}'),
 ('${U.mgr2}','h.gestor2@teste.local','authenticated','authenticated','{"full_name":"Gestor H2"}'),
 ('${U.mgrOff}','h.gestor3@teste.local','authenticated','authenticated','{"full_name":"Gestor H3"}');
insert into public.organizations (id, name, slug) values ('${ORG}','Clube H','clube-h-teste'), ('${ORG2}','Clube H2','clube-h2-teste'), ('${ORGOFF}','Clube H3','clube-h3-teste');
insert into public.memberships (org_id, profile_id, role) values ('${ORG}','${U.mgr}','manager'), ('${ORG}','${U.coach}','coach'),
  ('${ORG2}','${U.mgr2}','manager'), ('${ORGOFF}','${U.mgrOff}','manager');
insert into public.org_modules (org_id, module) values ('${ORG}','investimentos'), ('${ORG2}','investimentos');
create temp table results (name text primary key, value jsonb);
grant all on results to authenticated, anon;
${as(U.mgr)}
${tryRun('mgr_save', `select public.save_org_officer('${ORG}', ${officer()})`)}
${tryRun('mgr_bad_cpf', `select public.save_org_officer('${ORG}', ${officer().replace('52998224725', '11111111111')})`)}
${tryRun('mgr_list', `select public.list_org_officers('${ORG}')`)}
${tryRun('mgr_direct', `select count(*) from public.org_officers`)}
${tryRun('mgr_profile', `insert into public.org_habil_profile (org_id, founded_on, proposal_number) values ('${ORG}', '2015-05-05', '123/2026')`)}
${tryRun('mgr_doc_confirm', `insert into public.org_habil_docs (org_id, item_code, status, uploaded_by) values ('${ORG}','1.11','confirmado','${U.mgr}')`)}
${tryRun('mgr_na_without_note', `insert into public.org_habil_docs (org_id, item_code, status, uploaded_by) values ('${ORG}','4.20','nao_aplica','${U.mgr}')`)}
${tryRun('mgr_na_with_note', `insert into public.org_habil_docs (org_id, item_code, status, note, uploaded_by) values ('${ORG}','4.20','nao_aplica','Projeto abaixo de 1 milhão','${U.mgr}')`)}
${tryRun('mgr_sent_without_file', `insert into public.org_habil_docs (org_id, item_code, status, uploaded_by) values ('${ORG}','4.1','enviado','${U.mgr}')`)}
${tryRun('mgr_other_folder', `insert into public.org_habil_docs (org_id, item_code, file_path, mime_type, size_bytes, uploaded_by) values ('${ORG}','4.1','${ORG2}/habilitacao/x.pdf','application/pdf',10,'${U.mgr}')`)}
${keep('mgr_docs', `select count(*)::int n from public.org_habil_docs`)}
${as(U.coach)}
${tryRun('coach_list', `select public.list_org_officers('${ORG}')`)}
${keep('coach_docs', `select count(*)::int n from public.org_habil_docs`)}
${keep('coach_profile', `select count(*)::int n from public.org_habil_profile`)}
${as(U.mgr2)}
${tryRun('other_list', `select public.list_org_officers('${ORG}')`)}
${tryRun('other_save', `select public.save_org_officer('${ORG}', ${officer()})`)}
${keep('other_docs', `select count(*)::int n from public.org_habil_docs`)}
${as(U.mgrOff)}
${tryRun('nomodule_list', `select public.list_org_officers('${ORGOFF}')`)}
${tryRun('nomodule_doc', `insert into public.org_habil_docs (org_id, item_code, status, uploaded_by) values ('${ORGOFF}','1.11','confirmado','${U.mgrOff}')`)}
reset role;
${keep('audit_view', `select count(*)::int n from public.audit_log where org_id = '${ORG}' and action = 'officers_viewed'`)}
select name, value from results;`;

let R = {};
before(async () => { R = Object.fromEntries((await sql(`begin;\n${scenario}`)).map((r) => [r.name, r.value])); });
const ok = (n) => R[n]?.ok === true;

test('gestor com o módulo cadastra e lista dirigentes; CPF inválido é recusado', () => {
  assert.equal(ok('mgr_save'), true, R.mgr_save?.error);
  assert.equal(ok('mgr_bad_cpf'), false);
  assert.equal(ok('mgr_list'), true, R.mgr_list?.error);
  assert.equal(R.mgr_list.result.length, 1);
  assert.equal(R.mgr_list.result[0].rg, '1234567');
});
test('dados pessoais dos dirigentes não são lidos direto da tabela, e cada leitura fica no histórico', () => {
  assert.equal(ok('mgr_direct'), false);
  assert.equal(R.audit_view.n, 1);
});
test('pasta de habilitação: regras de status', () => {
  assert.equal(ok('mgr_profile'), true, R.mgr_profile?.error);
  assert.equal(ok('mgr_doc_confirm'), true, R.mgr_doc_confirm?.error);
  assert.equal(ok('mgr_na_without_note'), false);   // "não se aplica" exige motivo
  assert.equal(ok('mgr_na_with_note'), true, R.mgr_na_with_note?.error);
  assert.equal(ok('mgr_sent_without_file'), false); // "enviado" exige arquivo
  assert.equal(ok('mgr_other_folder'), false);      // arquivo tem que estar na pasta da própria entidade
  assert.equal(R.mgr_docs.n, 2);
});
test('treinador não vê dirigentes, documentos nem dados de apoio', () => {
  assert.equal(ok('coach_list'), false);
  assert.equal(R.coach_docs.n, 0);
  assert.equal(R.coach_profile.n, 0);
});
test('gestor de outra entidade não acessa', () => {
  assert.equal(ok('other_list'), false);
  assert.equal(ok('other_save'), false);
  assert.equal(R.other_docs.n, 0);
});
test('sem o módulo investimentos, tudo fica fechado', () => {
  assert.equal(ok('nomodule_list'), false);
  assert.equal(ok('nomodule_doc'), false);
});
