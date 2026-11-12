// Testes do administrador da entidade, cadastro próprio de entidade e análise posterior.
// Transação desfeita no fim. Uso: npm run test:db
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../../scripts/db.mjs';

const id = (n) => `33333333-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { owner: id(1), mgr: id(2), coach: id(3), other: id(4), plat: id(5), second: id(6) };
const CNPJ = '11222333000181', CNPJ2 = '11444777000161';
const CPF = '52998224725', CPF2 = '11144477735';

const fixtures = `
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
 ('${U.owner}','o.dono@teste.local','authenticated','authenticated','{"full_name":"Dono"}'),
 ('${U.mgr}','o.gestor@teste.local','authenticated','authenticated','{"full_name":"Gestor"}'),
 ('${U.coach}','o.treinador@teste.local','authenticated','authenticated','{"full_name":"Treinador"}'),
 ('${U.other}','o.outro@teste.local','authenticated','authenticated','{"full_name":"Outro"}'),
 ('${U.plat}','o.plataforma@teste.local','authenticated','authenticated','{"full_name":"Plataforma"}'),
 ('${U.second}','o.segundo@teste.local','authenticated','authenticated','{"full_name":"Segundo"}');
update public.profiles set is_platform_admin = true where id = '${U.plat}';
create temp table results (name text primary key, value jsonb);
grant all on results to authenticated, anon;
`;
const as = (uid) => `reset role; select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true); set local role authenticated;`;
const keep = (name, query) => `insert into results values ('${name}', (select to_jsonb(x) from (${query}) x limit 1));`;
const tryRun = (name, stmt) => {
  const isSelect = stmt.trim().toLowerCase().startsWith('select');
  const exec = isSelect ? `execute $q$select to_jsonb(s.v) from (${stmt}) s(v)$q$ into v;` : `execute $q$${stmt}$q$;`;
  return `do $t$ declare v jsonb; begin
  ${exec}
  insert into results values ('${name}', jsonb_build_object('ok', true, 'result', v));
exception when others then
  insert into results values ('${name}', jsonb_build_object('ok', false, 'error', sqlerrm));
end $t$;`;
};
const register = (cnpj, cpf) => `select public.register_organization(
  '{"full_name":"Dono da Silva","cpf":"${cpf}","phone":"(61) 99999-0000","title":"Presidente"}'::jsonb,
  '{"cnpj":"${cnpj}","legal_name":"Associação Teste de Vôlei","trade_name":"Vôlei Teste","state_registration":"isento","cep":"70000-000","city":"Brasília","uf":"df","email":"Contato@Teste.local","receita_status":"ATIVA"}'::jsonb,
  '[{"full_name":"Dono da Silva","cpf":"${cpf}","role_title":"Presidente","is_me":true},{"full_name":"Tesoureira","role_title":"Tesoureira"}]'::jsonb,
  '2026-11-v1')`;
const ORG = `(select id from public.organizations where cnpj = '${CNPJ}')`;

const scenario = [
  fixtures,
  `reset role;`,
  keep('validators', `select app_private.valid_cnpj('${CNPJ}') c1, app_private.valid_cnpj('11222333000182') c2, app_private.valid_cpf('${CPF}') p1, app_private.valid_cpf('11111111111') p2`),

  as(U.owner),
  tryRun('bad_cnpj', register('11222333000182', CPF)),
  tryRun('bad_cpf', register(CNPJ, '52998224724')),
  tryRun('register', register(CNPJ, CPF)),
  keep('org_after', `select review_status, created_via, state_registration, uf, email, photo_retention_months, terms_version from public.organizations where cnpj = '${CNPJ}'`),
  keep('my_roles', `select array_agg(role::text) roles from public.memberships where profile_id = '${U.owner}'`),
  keep('reps_seen', `select count(*)::int n from public.org_legal_representatives where org_id = ${ORG}`),
  tryRun('owner_edit_org', `update public.organizations set phone = '6133334444' where id = ${ORG}`),
  tryRun('owner_self_approve', `update public.organizations set review_status = 'approved' where id = ${ORG}`),
  tryRun('owner_add_people', `insert into public.memberships (org_id, profile_id, role) values (${ORG}, '${U.mgr}', 'manager'), (${ORG}, '${U.coach}', 'coach')`),
  tryRun('owner_remove_self_last', `delete from public.memberships where profile_id = '${U.owner}' and role = 'admin'`),

  as(U.other),
  tryRun('dup_cnpj', register(CNPJ, CPF2)),
  tryRun('cpf_in_use', register(CNPJ2, CPF)),
  keep('other_sees', `select (select count(*) from public.organizations where cnpj = '${CNPJ}')::int orgs, (select count(*) from public.profile_private where profile_id = '${U.owner}')::int cpf`),

  as(U.mgr),
  keep('mgr_sees_reps', `select count(*)::int n from public.org_legal_representatives`),
  keep('mgr_sees_cpf', `select count(*)::int n from public.profile_private where profile_id = '${U.owner}'`),
  tryRun('mgr_edit_org', `update public.organizations set phone = '6100000000' where id = ${ORG}`),
  keep('phone_after_mgr', `select phone from public.organizations where cnpj = '${CNPJ}'`),
  tryRun('mgr_make_admin', `insert into public.memberships (org_id, profile_id, role) values (${ORG}, '${U.mgr}', 'admin')`),
  tryRun('mgr_add_coach', `insert into public.memberships (org_id, invited_email, role) values (${ORG}, 'novo@teste.local', 'coach')`),
  tryRun('mgr_review', `select public.review_organization(${ORG}, 'approved', 'eu mesmo')`),

  as(U.owner),
  tryRun('owner_add_admin', `insert into public.memberships (org_id, profile_id, role) values (${ORG}, '${U.second}', 'admin')`),
  tryRun('owner_remove_self_ok', `delete from public.memberships where profile_id = '${U.owner}' and role = 'admin'`),

  as(U.plat),
  tryRun('review_list', `select public.platform_org_review_list()`),
  tryRun('suspend', `select public.review_organization(${ORG}, 'suspended', 'Contato feito: entidade não reconhece o cadastro')`),
  as(U.coach),
  keep('coach_after_suspend', `select count(*)::int n from public.organizations where cnpj = '${CNPJ}'`),
  as(U.plat),
  tryRun('reactivate', `select public.review_organization(${ORG}, 'approved', 'Ligação com o presidente: tudo certo')`),
  as(U.coach),
  keep('coach_after_approve', `select count(*)::int n from public.organizations where cnpj = '${CNPJ}'`),

  `reset role;`,
  keep('audit', `select (select count(*) from public.audit_log where action = 'organization_registered' and org_id = ${ORG})::int registered,
                        (select count(*) from public.audit_log where table_name = 'organizations' and org_id = ${ORG} and action = 'update')::int updates`),
  `select name, value from results;`,
].join('\n');

let R = {};
before(async () => {
  const rows = await sql(`begin;\n${scenario}`);
  R = Object.fromEntries(rows.map((r) => [r.name, r.value]));
});
const ok = (n) => R[n]?.ok === true;
const err = (n) => R[n]?.error ?? '';
const res = (n) => R[n]?.result;

test('CPF e CNPJ são conferidos pelos dígitos verificadores', () => {
  assert.deepEqual(R.validators, { c1: true, c2: false, p1: true, p2: false });
  assert.match(err('bad_cnpj'), /TP_INVALID_CNPJ/);
  assert.match(err('bad_cpf'), /TP_INVALID_CPF/);
});
test('qualquer pessoa cadastra a própria entidade, que já funciona e vai para análise', () => {
  assert.equal(ok('register'), true, err('register'));
  assert.deepEqual(R.org_after, { review_status: 'pending', created_via: 'self_signup', state_registration: 'ISENTO', uf: 'DF', email: 'contato@teste.local', photo_retention_months: 24, terms_version: '2026-11-v1' });
  assert.deepEqual(R.my_roles.roles, ['admin']);
  assert.equal(R.reps_seen.n, 2);
  assert.equal(ok('owner_edit_org'), true, err('owner_edit_org'));
  assert.equal(ok('owner_add_people'), true, err('owner_add_people'));
});
test('a entidade não se aprova sozinha', () => {
  assert.equal(ok('owner_self_approve'), false);
  assert.match(err('mgr_review'), /TP_FORBIDDEN/);
});
test('CNPJ e CPF não se repetem', () => {
  assert.match(err('dup_cnpj'), /TP_CNPJ_EXISTS/);
  assert.match(err('cpf_in_use'), /TP_CPF_IN_USE/);
  assert.deepEqual(R.other_sees, { orgs: 0, cpf: 0 });
});
test('gestor não vê CPF nem responsáveis legais, não edita a entidade e não cria administrador', () => {
  assert.equal(R.mgr_sees_reps.n, 0);
  assert.equal(R.mgr_sees_cpf.n, 0);
  assert.equal(R.phone_after_mgr.phone, '6133334444');
  assert.match(err('mgr_make_admin'), /TP_ADMIN_ONLY/);
  assert.equal(ok('mgr_add_coach'), true, err('mgr_add_coach'));
});
test('o último administrador não pode sair; com outro administrador, pode', () => {
  assert.match(err('owner_remove_self_last'), /TP_LAST_ADMIN/);
  assert.equal(ok('owner_add_admin'), true, err('owner_add_admin'));
  assert.equal(ok('owner_remove_self_ok'), true, err('owner_remove_self_ok'));
});
test('a plataforma analisa: lista com contatos, suspende (bloqueia o acesso) e reativa', () => {
  assert.equal(ok('review_list'), true, err('review_list'));
  const item = res('review_list').find((x) => x.org.cnpj === CNPJ);
  assert.equal(item.users, 3);
  assert.equal(ok('suspend'), true, err('suspend'));
  assert.equal(R.coach_after_suspend.n, 0);
  assert.equal(R.coach_after_approve.n, 1);
});
test('cadastro e mudanças da entidade ficam na auditoria', () => {
  assert.equal(R.audit.registered, 1);
  assert.ok(R.audit.updates >= 3);
});
