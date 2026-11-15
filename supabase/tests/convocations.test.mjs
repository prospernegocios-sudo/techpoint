// Convocações (ciência do atleta) e justificativas de falta: quem vê e quem pode marcar.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../../scripts/db.mjs';

const id = (n) => `77777777-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { coach: id(1), kid: id(2), mom: id(3), other: id(4), kid2: id(5) };
const ORG = id(100), TEAM = id(200), ATH = id(400), ATH2 = id(401), CONV = id(500), EV = id(600);
const as = (uid) => `reset role; select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true); set local role authenticated;`;
const tryRun = (name, stmt) => {
  const isSelect = stmt.trim().toLowerCase().startsWith('select');
  const exec = isSelect ? `execute $q$select to_jsonb(s.v) from (${stmt}) s(v)$q$ into v;` : `execute $q$${stmt}$q$;`;
  return `do $t$ declare v jsonb; begin ${exec}
  insert into results values ('${name}', jsonb_build_object('ok', true, 'result', v));
exception when others then insert into results values ('${name}', jsonb_build_object('ok', false, 'error', sqlerrm)); end $t$;`;
};
const keep = (name, q) => `insert into results values ('${name}', (select to_jsonb(x) from (${q}) x limit 1));`;

const scenario = `
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
 ('${U.coach}','c.treinador@teste.local','authenticated','authenticated','{"full_name":"Treinador C"}'),
 ('${U.kid}','c.atleta@teste.local','authenticated','authenticated','{"full_name":"Atleta C"}'),
 ('${U.mom}','c.mae@teste.local','authenticated','authenticated','{"full_name":"Mãe C"}'),
 ('${U.other}','c.outro@teste.local','authenticated','authenticated','{"full_name":"Outro C"}'),
 ('${U.kid2}','c.atleta2@teste.local','authenticated','authenticated','{"full_name":"Atleta C2"}');
insert into public.organizations (id, name, slug) values ('${ORG}','Clube C','clube-c-teste');
insert into public.memberships (org_id, profile_id, role) values ('${ORG}','${U.coach}','coach'), ('${ORG}','${U.kid}','athlete'), ('${ORG}','${U.kid2}','athlete');
insert into public.athletes (id, org_id, profile_id, full_name, birth_date) values ('${ATH}','${ORG}','${U.kid}','Atleta C','2005-03-03'), ('${ATH2}','${ORG}','${U.kid2}','Atleta C2','2005-04-04');
insert into public.athlete_guardians (org_id, athlete_id, name, profile_id, status) values ('${ORG}','${ATH}','Mãe C','${U.mom}','active');
insert into public.sports (id, name) values ('${id(300)}', 'Vôlei C') on conflict do nothing;
insert into public.teams (id, org_id, sport_id, name) values ('${TEAM}','${ORG}','${id(300)}','Sub 17 C');
insert into public.team_members (team_id, athlete_id) values ('${TEAM}','${ATH}'), ('${TEAM}','${ATH2}');
insert into public.venues (id, org_id, name, latitude, longitude, radius_m) values ('${id(700)}','${ORG}','Quadra C',-15.8,-47.9,100);
insert into public.events (id, org_id, team_id, venue_id, type, starts_at, ends_at) values ('${EV}','${ORG}','${TEAM}','${id(700)}','training', now() - interval '3 hours', now() - interval '1 hour');
create temp table results (name text primary key, value jsonb);
grant all on results to authenticated, anon;
${as(U.coach)}
${tryRun('coach_creates', `insert into public.convocations (id, org_id, team_id, title, starts_on) values ('${CONV}','${ORG}','${TEAM}','Taça C', current_date + 10)`)}
${tryRun('coach_adds', `insert into public.convocation_athletes (convocation_id, athlete_id, org_id) values ('${CONV}','${ATH}','${ORG}')`)}
${as(U.kid2)}
${keep('kid2_sees', `select count(*)::int n from public.convocations`)}
${tryRun('kid2_ack_other', `select public.acknowledge_convocation('${CONV}','${ATH}')`)}
${tryRun('kid2_ack_self_not_called', `select public.acknowledge_convocation('${CONV}','${ATH2}')`)}
${as(U.kid)}
${keep('kid_sees', `select count(*)::int n from public.convocations`)}
${tryRun('kid_direct_update', `update public.convocation_athletes set acknowledged_at = now() where athlete_id = '${ATH}'`)}
${keep('after_direct', `select (acknowledged_at is not null) b from public.convocation_athletes where athlete_id = '${ATH}'`)}
${tryRun('kid_ack', `select public.acknowledge_convocation('${CONV}','${ATH}')`)}
${tryRun('kid_justify', `insert into public.absence_justifications (org_id, event_id, athlete_id, reason, details, created_by) values ('${ORG}','${EV}','${ATH}','escola','Prova de matemática','${U.kid}')`)}
${tryRun('kid_justify_other', `insert into public.absence_justifications (org_id, event_id, athlete_id, reason, created_by) values ('${ORG}','${EV}','${ATH2}','viagem','${U.kid}')`)}
${as(U.mom)}
${keep('mom_sees_justif', `select count(*)::int n from public.absence_justifications`)}
${as(U.coach)}
${keep('coach_sees_ack', `select (acknowledged_at is not null) b from public.convocation_athletes where athlete_id = '${ATH}'`)}
${keep('coach_sees_justif', `select reason from public.absence_justifications where athlete_id = '${ATH}'`)}
${as(U.other)}
${keep('other_sees', `select (select count(*) from public.convocations)::int c, (select count(*) from public.absence_justifications)::int j`)}
reset role;
select name, value from results;`;

let R = {};
before(async () => { R = Object.fromEntries((await sql(`begin;\n${scenario}`)).map((r) => [r.name, r.value])); });
const ok = (n) => R[n]?.ok === true;

test('treinador cria convocação e convoca atletas', () => {
  assert.equal(ok('coach_creates'), true, R.coach_creates?.error);
  assert.equal(ok('coach_adds'), true, R.coach_adds?.error);
});
test('só o atleta convocado vê a convocação e só ele (ou o responsável) dá ciência', () => {
  assert.equal(R.kid2_sees.n, 0);
  assert.equal(ok('kid2_ack_other'), false);
  assert.equal(ok('kid2_ack_self_not_called'), false);
  assert.equal(R.kid_sees.n, 1);
  assert.equal(R.after_direct.b, false); // não marca direto na tabela, só pela função
  assert.equal(ok('kid_ack'), true, R.kid_ack?.error);
  assert.equal(R.coach_sees_ack.b, true);
});
test('atleta justifica a própria falta; responsável e treinador veem; outro atleta não justifica por ele', () => {
  assert.equal(ok('kid_justify'), true, R.kid_justify?.error);
  assert.equal(ok('kid_justify_other'), false);
  assert.equal(R.mom_sees_justif.n, 1);
  assert.equal(R.coach_sees_justif.reason, 'escola');
});
test('quem é de fora não vê convocações nem justificativas', () => {
  assert.equal(R.other_sees.c, 0);
  assert.equal(R.other_sees.j, 0);
});
