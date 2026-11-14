// Fase 2: convite do atleta, aprovação do treinador, responsável e consentimento LGPD.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../../scripts/db.mjs';

const id = (n) => `55555555-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { coach: id(1), mgr: id(2), kid: id(3), mom: id(4), stranger: id(5), adult: id(6) };
const ORG = id(100), VEN = id(200), TEAM = id(300), EV = id(500), OTHER_ATH = id(401);
const SP = `(now() at time zone 'America/Sao_Paulo')::date`;

const fixtures = `
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
 ('${U.coach}','g.treinador@teste.local','authenticated','authenticated','{"full_name":"Treinador G"}'),
 ('${U.mgr}','g.gestor@teste.local','authenticated','authenticated','{"full_name":"Gestor G"}'),
 ('${U.kid}','g.atleta@teste.local','authenticated','authenticated','{"full_name":"Atleta G"}'),
 ('${U.mom}','g.mae@teste.local','authenticated','authenticated','{"full_name":"Mãe G"}'),
 ('${U.stranger}','g.estranho@teste.local','authenticated','authenticated','{"full_name":"Estranho"}'),
 ('${U.adult}','g.adulto@teste.local','authenticated','authenticated','{"full_name":"Adulto G"}');
insert into public.organizations (id, name, slug) values ('${ORG}','Clube G','clube-g-teste');
insert into public.memberships (org_id, profile_id, role) values ('${ORG}','${U.coach}','coach'), ('${ORG}','${U.mgr}','manager');
insert into public.venues (id, org_id, name, latitude, longitude) values ('${VEN}','${ORG}','Ginásio G',-15.79,-47.88);
insert into public.teams (id, org_id, name) values ('${TEAM}','${ORG}','G Sub 15');
insert into public.events (id, org_id, team_id, venue_id, starts_at, ends_at) values ('${EV}','${ORG}','${TEAM}','${VEN}', now() - interval '10 minutes', now() + interval '80 minutes');
insert into public.athletes (id, org_id, full_name, birth_date) values ('${OTHER_ATH}','${ORG}','Outro Atleta','2012-01-01');
create temp table results (name text primary key, value jsonb);
grant all on results to authenticated, anon;
`;
const as = (uid) => `reset role; select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true); set local role authenticated;`;
const asAnon = `reset role; select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;`;
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
const TOKEN = `(select token from public.team_invites where team_id = '${TEAM}' limit 1)`;
const KID_ATH = `(select id from public.athletes where profile_id = '${U.kid}')`;
const G_TOKEN = `(select token from public.athlete_guardians where athlete_id = ${KID_ATH} limit 1)`;
const checkin = (name) => tryRun(name, `insert into public.attendance_records (org_id, event_id, athlete_id, kind, source, status) select '${ORG}', '${EV}', id, 'check_in', 'app', 'valid' from public.athletes where profile_id = '${U.kid}'`);

const scenario = [
  fixtures,
  as(U.coach),
  tryRun('create_invite', `insert into public.team_invites (org_id, team_id) values ('${ORG}','${TEAM}')`),
  `reset role;`,
  `create temp table tk as select ${TOKEN} as t; grant select on tk to authenticated, anon;`,
  asAnon,
  tryRun('anon_info', `select public.invite_info((select t from tk))`),
  as(U.kid),
  tryRun('too_young', `select public.request_to_join((select t from tk), 'Atleta G', ${SP} - 9*365, '{}'::jsonb)`),
  tryRun('no_guardian', `select public.request_to_join((select t from tk), 'Atleta G', '2012-05-05', '{}'::jsonb)`),
  tryRun('join', `select public.request_to_join((select t from tk), 'Atleta G', '2012-05-05', '{"name":"Mãe G","phone":"(61) 98888-7777","relationship":"Mãe"}'::jsonb)`),
  tryRun('join_again', `select public.request_to_join((select t from tk), 'Atleta G', '2012-05-05', '{"phone":"61988887777"}'::jsonb)`),
  keep('kid_sees_request', `select count(*)::int n from public.athlete_join_requests`),
  as(U.stranger),
  tryRun('stranger_decides', `select public.decide_join_request((select id from public.athlete_join_requests limit 1), true)`),
  as(U.coach),
  tryRun('approve', `select public.decide_join_request((select id from public.athlete_join_requests where profile_id = '${U.kid}'), true)`),
  `reset role;`,
  keep('after_approve', `select a.status, (select count(*) from public.memberships m where m.profile_id = '${U.kid}' and m.role = 'athlete')::int memb,
     (select count(*) from public.team_members tm where tm.athlete_id = a.id)::int teams,
     (select count(*) from public.athlete_guardians g where g.athlete_id = a.id and g.status = 'invited')::int invites
     from public.athletes a where a.profile_id = '${U.kid}'`),
  checkin('checkin_no_consent'),
  as(U.kid),
  tryRun('kid_accepts_own', `select public.accept_guardian_invite(${G_TOKEN})`),
  tryRun('kid_adds_guardian', `insert into public.athlete_guardians (org_id, athlete_id, name, phone) select org_id, id, 'Pai G', '61977776666' from public.athletes where profile_id = '${U.kid}'`),
  tryRun('kid_adds_for_other', `insert into public.athlete_guardians (org_id, athlete_id, name, phone) values ('${ORG}','${OTHER_ATH}','Pai X','61977776666')`),
  as(U.stranger),
  tryRun('stranger_consent', `select public.grant_consent(${KID_ATH}, 'v1', '{}'::jsonb)`),
  `reset role;`,
  `create temp table gtk as select token as t from public.athlete_guardians g where g.name = 'Mãe G' limit 1; grant select on gtk to authenticated;`,
  as(U.mom),
  tryRun('mom_accepts', `select public.accept_guardian_invite((select t from gtk))`),
  `reset role;`,
  `create temp table kid as select id from public.athletes where profile_id = '${U.kid}'; grant select on kid to authenticated;`,
  as(U.mom),
  keep('mom_sees', `select (select count(*) from public.athletes)::int athletes, (select count(*) from public.events)::int events`),
  tryRun('mom_token', `insert into public.push_tokens (token, profile_id, platform) values ('ExponentPushToken[teste-mae]', '${U.mom}', 'android')`),
  tryRun('mom_token_other', `insert into public.push_tokens (token, profile_id, platform) values ('ExponentPushToken[teste-outro]', '${U.kid}', 'android')`),
  tryRun('mom_consent', `select public.grant_consent((select id from kid), 'v1', '{"photos":true,"sponsors":true,"notifications":true}'::jsonb)`),
  `reset role;`,
  keep('after_consent', `select status from public.athletes where profile_id = '${U.kid}'`),
  `create temp table q0 as select count(*) n from net.http_request_queue;`,
  checkin('checkin_with_consent'),
  keep('push_queued', `select (select count(*) from net.http_request_queue where url like '%exp.host%')::int - (select n from q0)::int + (select count(*) from net.http_request_queue where url like '%exp.host%' and false)::int n, (select convert_from(body, 'UTF8') like '%chegou ao treino%' from net.http_request_queue order by id desc limit 1) body_ok`),
  as(U.mom),
  tryRun('mom_revokes', `select public.revoke_consent((select id from public.guardian_consents where guardian_profile_id = '${U.mom}'))`),
  `reset role;`,
  keep('after_revoke', `select status from public.athletes where profile_id = '${U.kid}'`),
  `delete from public.attendance_records where event_id = '${EV}';`,
  checkin('checkin_after_revoke'),
  as(U.coach),
  tryRun('coach_paper', `select public.record_paper_consent('${OTHER_ATH}', 'papel-v1', 'Termo assinado na secretaria')`),
  as(U.mgr),
  tryRun('mgr_paper', `select public.record_paper_consent('${OTHER_ATH}', 'papel-v1', 'Termo assinado na secretaria')`),
  `reset role;`,
  keep('audit', `select count(*)::int n from public.audit_log where org_id = '${ORG}' and table_name = 'guardian_consents'`),
  `select name, value from results;`,
].join('\n');

let R = {};
before(async () => { R = Object.fromEntries((await sql(`begin;\n${scenario}`)).map((r) => [r.name, r.value])); });
const ok = (n) => R[n]?.ok === true;
const err = (n) => R[n]?.error ?? '';
const res = (n) => R[n]?.result;

test('treinador cria convite; a página do link mostra só nome do time e da entidade', () => {
  assert.equal(ok('create_invite'), true, err('create_invite'));
  assert.equal(ok('anon_info'), true, err('anon_info'));
  assert.deepEqual([res('anon_info').team, res('anon_info').org, res('anon_info').valid], ['G Sub 15', 'Clube G', true]);
});
test('atleta pede para entrar: menor de 10 anos e menor sem responsável são recusados; pedido duplicado também', () => {
  assert.match(err('too_young'), /TP_TOO_YOUNG/);
  assert.match(err('no_guardian'), /TP_GUARDIAN_REQUIRED/);
  assert.equal(ok('join'), true, err('join'));
  assert.match(err('join_again'), /TP_REQUEST_EXISTS/);
  assert.equal(R.kid_sees_request.n, 1);
});
test('só a equipe da entidade aprova; aprovado vira atleta aguardando consentimento, com convite ao responsável', () => {
  assert.match(err('stranger_decides'), /TP_FORBIDDEN/);
  assert.equal(ok('approve'), true, err('approve'));
  assert.deepEqual(R.after_approve, { status: 'pending_consent', memb: 1, teams: 1, invites: 1 });
});
test('sem consentimento, menor não tem presença registrada', () => {
  assert.match(err('checkin_no_consent'), /TP_CONSENT_REQUIRED/);
});
test('o próprio atleta não vira seu responsável; pode cadastrar responsável só para si', () => {
  assert.match(err('kid_accepts_own'), /TP_GUARDIAN_SELF/);
  assert.equal(ok('kid_adds_guardian'), true, err('kid_adds_guardian'));
  assert.equal(ok('kid_adds_for_other'), false);
});
test('responsável aceita, vê só o filho e os treinos dele, e dá o consentimento', () => {
  assert.match(err('stranger_consent'), /TP_FORBIDDEN/);
  assert.equal(ok('mom_accepts'), true, err('mom_accepts'));
  assert.deepEqual(R.mom_sees, { athletes: 1, events: 1 });
  assert.equal(ok('mom_consent'), true, err('mom_consent'));
  assert.equal(R.after_consent.status, 'active');
  assert.equal(ok('checkin_with_consent'), true, err('checkin_with_consent'));
});
test('revogar o consentimento bloqueia de novo', () => {
  assert.equal(ok('mom_revokes'), true, err('mom_revokes'));
  assert.equal(R.after_revoke.status, 'pending_consent');
  assert.match(err('checkin_after_revoke'), /TP_CONSENT_REQUIRED/);
});
test('consentimento em papel: só gestor ou administrador registra, com motivo; tudo auditado', () => {
  assert.match(err('coach_paper'), /TP_FORBIDDEN/);
  assert.equal(ok('mgr_paper'), true, err('mgr_paper'));
  assert.ok(R.audit.n >= 3);
});
test('responsável que autorizou avisos recebe o push de chegada; ninguém registra aparelho em nome de outro', () => {
  assert.equal(ok('mom_token'), true, err('mom_token'));
  assert.equal(ok('mom_token_other'), false);
  assert.ok(R.push_queued.n >= 1, JSON.stringify(R.push_queued));
  assert.equal(R.push_queued.body_ok, true);
});
