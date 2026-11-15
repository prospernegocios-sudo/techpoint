// Marca de dados fictícios (D77).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../../scripts/db.mjs';

const id = (n) => `88888888-0000-4000-8000-${String(n).padStart(12, '0')}`;
const DEMO = id(1), REAL = id(2), ORG = id(100);

const scenario = `
begin;
insert into auth.users (id, email, aud, role) values ('${DEMO}','x.treinador@guerreiro.com.br','authenticated','authenticated'), ('${REAL}','x.real@teste.local','authenticated','authenticated');
insert into public.organizations (id, name, slug) values ('${ORG}','Clube X','clube-x-teste');
insert into public.memberships (org_id, profile_id, role) values ('${ORG}','${DEMO}','coach'), ('${ORG}','${REAL}','coach');
create temp table results (name text primary key, value jsonb);
grant all on results to authenticated;
insert into results select 'demo_profile', to_jsonb(is_demo) from public.profiles where id = '${DEMO}';
select set_config('request.jwt.claims', '{"sub":"${DEMO}","role":"authenticated"}', true); set local role authenticated;
insert into public.athletes (org_id, full_name, birth_date) values ('${ORG}','Fictício X','1990-01-01');
do $t$ begin update public.profiles set is_demo = false where id = '${DEMO}'; insert into results values ('unmark', '"ok"');
exception when others then insert into results values ('unmark', to_jsonb(sqlerrm)); end $t$;
reset role;
select set_config('request.jwt.claims', '{"sub":"${REAL}","role":"authenticated"}', true); set local role authenticated;
insert into public.athletes (org_id, full_name, birth_date) values ('${ORG}','Real X','1990-01-01');
reset role;
insert into results select 'flags', jsonb_object_agg(full_name, is_demo) from public.athletes where org_id = '${ORG}';
select name, value from results;
`;

let R = {};
before(async () => { R = Object.fromEntries((await sql(scenario)).map((r) => [r.name, r.value])); });

test('conta de teste nasce marcada e o que ela cria é fictício; conta real cria dado real', () => {
  assert.equal(R.demo_profile, true);
  assert.deepEqual(R.flags, { 'Fictício X': true, 'Real X': false });
});

test('ninguém tira a própria marca de conta de teste pelo app', () => {
  assert.notEqual(R.unmark, 'ok');
});
