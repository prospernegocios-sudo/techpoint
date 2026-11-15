// Módulos contratados (D81): sem "investimentos", projetos ficam fechados no servidor.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../../scripts/db.mjs';

const id = (n) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
const MGR = id(1), ORG = id(100);
const scenario = `
begin;
insert into auth.users (id, email, aud, role) values ('${MGR}','m.gestor@teste.local','authenticated','authenticated');
insert into public.organizations (id, name, slug) values ('${ORG}','Clube M','clube-m-teste');
insert into public.memberships (org_id, profile_id, role) values ('${ORG}','${MGR}','manager');
create temp table results (name text primary key, value jsonb);
grant all on results to authenticated;
select set_config('request.jwt.claims', '{"sub":"${MGR}","role":"authenticated"}', true); set local role authenticated;
do $t$ begin
  insert into public.projects (org_id, name, starts_on, ends_on) values ('${ORG}','Sem módulo', current_date, current_date + 30);
  insert into results values ('without', '"ok"');
exception when others then insert into results values ('without', to_jsonb(sqlerrm)); end $t$;
do $t$ begin perform public.set_org_module('${ORG}','investimentos','active'); insert into results values ('self_enable', '"ok"');
exception when others then insert into results values ('self_enable', to_jsonb(sqlerrm)); end $t$;
reset role;
insert into public.org_modules (org_id, module) values ('${ORG}','investimentos');
select set_config('request.jwt.claims', '{"sub":"${MGR}","role":"authenticated"}', true); set local role authenticated;
do $t$ begin
  insert into public.projects (org_id, name, starts_on, ends_on) values ('${ORG}','Com módulo', current_date, current_date + 30);
  insert into results values ('with', '"ok"');
exception when others then insert into results values ('with', to_jsonb(sqlerrm)); end $t$;
insert into results select 'modules_seen', to_jsonb(count(*)) from public.org_modules where org_id = '${ORG}';
reset role;
select name, value from results;
`;
let R = {};
before(async () => { R = Object.fromEntries((await sql(scenario)).map((r) => [r.name, r.value])); });

test('sem o módulo, o gestor não cria projeto; com o módulo, cria', () => {
  assert.notEqual(R.without, 'ok');
  assert.equal(R.with, 'ok');
});
test('só a plataforma liga módulo; a entidade vê o que contratou', () => {
  assert.notEqual(R.self_enable, 'ok');
  assert.equal(R.modules_seen, 1);
});
