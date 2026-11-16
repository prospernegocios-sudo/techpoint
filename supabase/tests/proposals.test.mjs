// Fase B do incentivo (Projeto Técnico): quem acessa, e as regras do orçamento.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../../scripts/db.mjs';

const id = (n) => `99999999-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { mgr: id(1), coach: id(2), mgr2: id(3) };
const ORG = id(100), ORG2 = id(101), P = id(200), G = id(300);
const as = (uid) => `reset role; select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true); set local role authenticated;`;
const tryRun = (name, stmt) => `do $t$ begin execute $q$${stmt}$q$;
  insert into results values ('${name}', '{"ok":true}'::jsonb);
exception when others then insert into results values ('${name}', jsonb_build_object('ok', false, 'error', sqlerrm)); end $t$;`;
const keep = (name, q) => `insert into results values ('${name}', (select to_jsonb(x) from (${q}) x limit 1));`;
const item = (cols = '', vals = '') => `insert into public.proposal_budget_items (proposal_id, org_id, stage, description, quantity, quotes, unit_value, total${cols}) values ('${P}','${ORG}','material','Bola de vôlei oficial',20,'[{"supplier":"A","value":100},{"supplier":"B","value":120},{"supplier":"C","value":140}]',100,2000${vals})`;

const scenario = `
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
 ('${U.mgr}','p.gestor@teste.local','authenticated','authenticated','{"full_name":"Gestor P"}'),
 ('${U.coach}','p.treinador@teste.local','authenticated','authenticated','{"full_name":"Treinador P"}'),
 ('${U.mgr2}','p.gestor2@teste.local','authenticated','authenticated','{"full_name":"Gestor P2"}');
insert into public.organizations (id, name, slug) values ('${ORG}','Clube P','clube-p-teste'), ('${ORG2}','Clube P2','clube-p2-teste');
insert into public.memberships (org_id, profile_id, role) values ('${ORG}','${U.mgr}','manager'), ('${ORG}','${U.coach}','coach'), ('${ORG2}','${U.mgr2}','manager');
insert into public.org_modules (org_id, module) values ('${ORG}','investimentos'), ('${ORG2}','investimentos');
create temp table results (name text primary key, value jsonb);
grant all on results to authenticated, anon;
${as(U.mgr)}
${tryRun('mgr_create', `insert into public.tech_proposals (id, org_id, title, axis, mesp_value, months) values ('${P}','${ORG}','Núcleo de vôlei de base','nucleo',400000,14)`)}
${tryRun('mgr_goal', `insert into public.proposal_goals (id, proposal_id, org_id, objective, indicator, target) values ('${G}','${P}','${ORG}','Manter frequência média acima de 75%','avg_frequency',75)`)}
${tryRun('item_menor', item())}
${tryRun('item_media_sem_justif', item(', adopted_rule', ", 'media'"))}
${tryRun('item_media_com_justif', item(', adopted_rule, justification', ", 'media', 'A mais barata não tem a bola oficial da federação'"))}
${tryRun('item_4_cotacoes', `insert into public.proposal_budget_items (proposal_id, org_id, stage, description, quotes) values ('${P}','${ORG}','material','Rede','[{"value":1},{"value":2},{"value":3},{"value":4}]')`)}
${keep('mgr_items', `select count(*)::int n from public.proposal_budget_items`)}
${as(U.coach)}
${keep('coach_sees', `select (select count(*) from public.tech_proposals)::int p, (select count(*) from public.proposal_budget_items)::int i`)}
${as(U.mgr2)}
${keep('other_sees', `select (select count(*) from public.tech_proposals)::int p, (select count(*) from public.proposal_goals)::int g`)}
${tryRun('other_injects', `insert into public.proposal_goals (proposal_id, org_id, objective) values ('${P}','${ORG2}','Invasão')`)}
reset role;
select name, value from results;`;

let R = {};
before(async () => { R = Object.fromEntries((await sql(`begin;\n${scenario}`)).map((r) => [r.name, r.value])); });
const ok = (n) => R[n]?.ok === true;

test('gestor com o módulo cria proposta, meta e itens', () => {
  assert.equal(ok('mgr_create'), true, R.mgr_create?.error);
  assert.equal(ok('mgr_goal'), true, R.mgr_goal?.error);
  assert.equal(ok('item_menor'), true, R.item_menor?.error);
});
test('valor que não é o menor exige justificativa; no máximo 3 cotações', () => {
  assert.equal(ok('item_media_sem_justif'), false);
  assert.equal(ok('item_media_com_justif'), true, R.item_media_com_justif?.error);
  assert.equal(ok('item_4_cotacoes'), false);
  assert.equal(R.mgr_items.n, 2);
});
test('treinador e outra entidade não veem nem gravam', () => {
  assert.deepEqual(R.coach_sees, { p: 0, i: 0 });
  assert.deepEqual(R.other_sees, { p: 0, g: 0 });
  assert.equal(ok('other_injects'), false);
});
