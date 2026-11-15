// Área do usuário e currículo esportivo (D78).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../../scripts/db.mjs';

const id = (n) => `99999999-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { coach: id(1), kid: id(2), mom: id(3), stranger: id(4) };
const ORG = id(100), TEAM = id(300), ATH = id(400);

const fixtures = `
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
 ('${U.coach}','c.treinador@teste.local','authenticated','authenticated','{"full_name":"Treinador C"}'),
 ('${U.kid}','c.atleta@teste.local','authenticated','authenticated','{"full_name":"Atleta C"}'),
 ('${U.mom}','c.mae@teste.local','authenticated','authenticated','{"full_name":"Mãe C"}'),
 ('${U.stranger}','c.estranho@teste.local','authenticated','authenticated','{"full_name":"Estranho C"}');
insert into public.organizations (id, name, slug) values ('${ORG}','Clube C','clube-c-teste');
insert into public.memberships (org_id, profile_id, role) values ('${ORG}','${U.coach}','coach'), ('${ORG}','${U.kid}','athlete');
insert into public.teams (id, org_id, name, category) values ('${TEAM}','${ORG}','C Sub 15','Sub 15');
insert into public.athletes (id, org_id, profile_id, full_name, birth_date) values ('${ATH}','${ORG}','${U.kid}','Atleta C','2012-03-03');
insert into public.team_members (team_id, athlete_id) values ('${TEAM}','${ATH}');
insert into public.athlete_guardians (org_id, athlete_id, name, profile_id, status) values ('${ORG}','${ATH}','Mãe C','${U.mom}','active');
insert into public.guardian_consents (org_id, athlete_id, guardian_profile_id, source, terms_version, scope) values ('${ORG}','${ATH}','${U.mom}','app','v2','{}');
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

const scenario = [
  fixtures,
  as(U.kid),
  tryRun('kid_details', `insert into public.athlete_details (athlete_id, org_id, cpf, modality, position, sport_started_on, city, uf) values ('${ATH}','${ORG}','52998224725','Vôlei de praia','Defesa','2019-03-01','Brasília','DF')`),
  tryRun('bad_cpf', `update public.athlete_details set cpf = '11111111111' where athlete_id = '${ATH}'`),
  tryRun('kid_body', `insert into public.athlete_body (athlete_id, height_cm, weight_kg, dominant_hand) values ('${ATH}', 172, 60.5, 'direita')`),
  tryRun('kid_entry', `insert into public.athlete_cv_entries (athlete_id, org_id, kind, title, institution, started_on) values ('${ATH}','${ORG}','titulo','Campeão Sub 17','Federação DF','2025-10-01')`),
  tryRun('kid_self_verify', `update public.athlete_cv_entries set verified_at = now(), verified_by = '${U.kid}' where athlete_id = '${ATH}'`),
  `reset role;`,
  keep('after_self_verify', `select (verified_at is null) as unverified from public.athlete_cv_entries where athlete_id = '${ATH}'`),
  as(U.kid),
  tryRun('kid_verify_rpc', `select public.verify_cv_entry((select id from public.athlete_cv_entries where athlete_id = '${ATH}'), true)`),
  as(U.coach),
  tryRun('coach_verify', `select public.verify_cv_entry((select id from public.athlete_cv_entries where athlete_id = '${ATH}'), true)`),
  keep('coach_sees_body', `select count(*)::int n from public.athlete_body`),
  keep('coach_sees_details', `select count(*)::int n from public.athlete_details`),
  tryRun('coach_cv', `select public.athlete_cv('${ATH}')`),
  tryRun('coach_share', `insert into public.athlete_cv_shares (athlete_id) values ('${ATH}')`),
  as(U.stranger),
  tryRun('stranger_cv', `select public.athlete_cv('${ATH}')`),
  keep('stranger_entries', `select count(*)::int n from public.athlete_cv_entries`),
  as(U.mom),
  tryRun('mom_cv', `select public.athlete_cv('${ATH}')`),
  tryRun('mom_share', `insert into public.athlete_cv_shares (athlete_id) values ('${ATH}')`),
  `reset role; create temp table tk as select token t from public.athlete_cv_shares limit 1; grant select on tk to anon, authenticated;`,
  asAnon,
  tryRun('public_cv', `select public.public_cv((select t from tk))`),
  tryRun('public_bad', `select public.public_cv('nao-existe')`),
  as(U.mom),
  tryRun('mom_revoke', `update public.athlete_cv_shares set revoked_at = now() where athlete_id = '${ATH}'`),
  asAnon,
  tryRun('public_revoked', `select public.public_cv((select t from tk))`),
  as(U.kid),
  tryRun('kid_edit_entry', `update public.athlete_cv_entries set title = 'Campeão Sub 17 (DF)' where athlete_id = '${ATH}'`),
  `reset role;`,
  keep('after_edit', `select (verified_at is null) as unverified from public.athlete_cv_entries where athlete_id = '${ATH}'`),
  `select name, value from results;`,
].join('\n');

let R = {};
before(async () => { R = Object.fromEntries((await sql(`begin;\n${scenario}`)).map((r) => [r.name, r.value])); });
const ok = (n) => R[n]?.ok === true;
const err = (n) => R[n]?.error ?? '';
const res = (n) => R[n]?.result;

test('atleta preenche dados, esporte e corpo; CPF inválido é recusado', () => {
  assert.equal(ok('kid_details'), true, err('kid_details'));
  assert.equal(ok('bad_cpf'), false);
  assert.equal(ok('kid_body'), true, err('kid_body'));
  assert.equal(ok('kid_entry'), true, err('kid_entry'));
});

test('selo "Confirmado pela entidade": só a equipe confirma; editar o item tira o selo', () => {
  assert.equal(R.after_self_verify.unverified, true);
  assert.equal(ok('kid_verify_rpc'), false);
  assert.equal(ok('coach_verify'), true, err('coach_verify'));
  assert.equal(res('coach_cv').entries[0].verified, true);
  assert.equal(R.after_edit.unverified, true);
});

test('equipe vê dados e currículo, mas não altura/peso (dado do corpo só atleta e responsáveis)', () => {
  assert.equal(R.coach_sees_details.n, 1);
  assert.equal(R.coach_sees_body.n, 0);
  assert.equal(res('coach_cv').body, null);
  assert.equal(res('mom_cv').body.height_cm, 172);
  assert.equal(res('coach_cv').modality, 'Vôlei de praia');
  assert.equal(res('coach_cv').teams[0].name, 'C Sub 15');
});

test('estranho não vê nada', () => {
  assert.equal(ok('stranger_cv'), false);
  assert.equal(R.stranger_entries.n, 0);
});

test('link de compartilhamento: só atleta/responsável cria; página pública sem CPF; revogado deixa de abrir', () => {
  assert.equal(ok('coach_share'), false);
  assert.equal(ok('mom_share'), true, err('mom_share'));
  const pub = res('public_cv');
  assert.equal(pub.full_name, 'Atleta C');
  assert.equal(pub.body, null);
  assert.equal(JSON.stringify(pub).includes('52998224725'), false);
  assert.equal(JSON.stringify(pub).includes('2012-03-03'), false);
  assert.equal(res('public_bad'), null);
  assert.equal(ok('mom_revoke'), true, err('mom_revoke'));
  assert.equal(res('public_revoked'), null);
});

// ---- Perfil do currículo e contatos (D84/D85) ----
const scenario2 = [
  fixtures,
  as(U.kid),
  tryRun('profile', `insert into public.athlete_cv_profile (athlete_id, headline, about, goals, contact_phone, "references") values ('${ATH}','Jogador de vôlei de areia','Sobre mim', array['Ser campeão'], '61900000000', '[{"name":"Treinador X","phone":"61911111111"}]')`),
  tryRun('entry_result', `insert into public.athlete_cv_entries (athlete_id, org_id, kind, title, result, started_on) values ('${ATH}','${ORG}','premio','Melhor levantador','Destaque','2023-01-01')`),
  as(U.coach),
  tryRun('coach_profile_edit', `update public.athlete_cv_profile set about = 'x' where athlete_id = '${ATH}'`),
  `reset role;`,
  keep('about_after_coach', `select about from public.athlete_cv_profile where athlete_id = '${ATH}'`),
  as(U.coach),
  tryRun('coach_cv', `select public.athlete_cv('${ATH}')`),
  as(U.mom),
  tryRun('mom_share', `insert into public.athlete_cv_shares (athlete_id) values ('${ATH}')`),
  `reset role; create temp table tk as select token t from public.athlete_cv_shares limit 1; grant select on tk to anon, authenticated;`,
  asAnon,
  tryRun('public_hidden', `select public.public_cv((select t from tk))`),
  as(U.kid),
  tryRun('show', `update public.athlete_cv_profile set show_contacts = true where athlete_id = '${ATH}'`),
  asAnon,
  tryRun('public_shown', `select public.public_cv((select t from tk))`),
  `select name, value from results;`,
].join('\n');

let R2 = {};
test('perfil do currículo: atleta edita, equipe só vê; contatos no link só quando liberados', async () => {
  R2 = Object.fromEntries((await sql(`begin;\n${scenario2}`)).map((r) => [r.name, r.value]));
  const ok2 = (n) => R2[n]?.ok === true, res2 = (n) => R2[n]?.result;
  assert.equal(ok2('profile'), true, R2.profile?.error);
  assert.equal(ok2('entry_result'), true, R2.entry_result?.error);
  assert.equal(R2.about_after_coach.about, 'Sobre mim');
  assert.equal(res2('coach_cv').profile.contact_phone, '61900000000');
  assert.equal(res2('coach_cv').entries[0].result, 'Destaque');
  assert.equal(res2('public_hidden').profile.contact_phone, null);
  assert.deepEqual(res2('public_hidden').profile.references, []);
  assert.equal(res2('public_shown').profile.contact_phone, '61900000000');
  assert.equal(res2('public_shown').profile.references[0].name, 'Treinador X');
});
