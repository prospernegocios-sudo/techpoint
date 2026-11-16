// Fase C (onda 2): ponto dos profissionais, cursos do COB, plano de mídia e uso do armazenamento.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../../scripts/db.mjs';

const id = (n) => `bbbbbbbb-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { mgr: id(1), coach: id(2), coach2: id(3), kid: id(4) };
const ORG = id(100), TEAM = id(200), VEN = id(300), EV = id(400), ATH = id(500), PR = id(600);
const as = (uid) => `reset role; select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true); set local role authenticated;`;
const tryRun = (name, stmt) => {
  const isSelect = stmt.trim().toLowerCase().startsWith('select');
  const exec = isSelect ? `execute $q$select to_jsonb(s.v) from (${stmt}) s(v)$q$ into v;` : `execute $q$${stmt}$q$;`;
  return `do $t$ declare v jsonb; begin ${exec}
  insert into results values ('${name}', jsonb_build_object('ok', true, 'result', v));
exception when others then insert into results values ('${name}', jsonb_build_object('ok', false, 'error', sqlerrm)); end $t$;`;
};
const keep = (name, q) => `insert into results values ('${name}', (select to_jsonb(x) from (${q}) x limit 1));`;
const photo = (uid) => `${ORG}/ponto/${uid}/${EV}-in.jpg`;
const ponto = (uid, kind, lat = -15.8, just = 'null') => `select public.record_staff_attendance('${EV}', '${kind}', ${lat}, -47.9, 10, '${photo(uid)}', 'sha-${uid}-${kind}', 'dev', false, ${just})`;

const scenario = `
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
 ('${U.mgr}','w.gestor@teste.local','authenticated','authenticated','{"full_name":"Gestor W"}'),
 ('${U.coach}','w.treinador@teste.local','authenticated','authenticated','{"full_name":"Treinador W"}'),
 ('${U.coach2}','w.treinador2@teste.local','authenticated','authenticated','{"full_name":"Treinador W2"}'),
 ('${U.kid}','w.atleta@teste.local','authenticated','authenticated','{"full_name":"Atleta W"}');
insert into public.organizations (id, name, slug) values ('${ORG}','Clube W','clube-w-teste');
insert into public.memberships (org_id, profile_id, role) values ('${ORG}','${U.mgr}','manager'), ('${ORG}','${U.coach}','coach'), ('${ORG}','${U.coach2}','coach'), ('${ORG}','${U.kid}','athlete');
insert into public.org_modules (org_id, module) values ('${ORG}','investimentos');
insert into public.sports (id, name) values ('${id(700)}', 'Vôlei W') on conflict do nothing;
insert into public.teams (id, org_id, sport_id, name) values ('${TEAM}','${ORG}','${id(700)}','Sub 17 W');
insert into public.venues (id, org_id, name, latitude, longitude, radius_m) values ('${VEN}','${ORG}','Quadra W',-15.8,-47.9,100);
insert into public.events (id, org_id, team_id, venue_id, type, starts_at, ends_at) values ('${EV}','${ORG}','${TEAM}','${VEN}','training', now() - interval '20 minutes', now() + interval '70 minutes');
insert into public.athletes (id, org_id, profile_id, full_name, birth_date) values ('${ATH}','${ORG}','${U.kid}','Atleta W','2010-01-01');
insert into public.projects (id, org_id, name, starts_on, ends_on) values ('${PR}','${ORG}','Projeto W', current_date, current_date + 300);
insert into storage.objects (bucket_id, name, metadata) values ('org-docs', '${photo(U.coach)}', '{"size": 1000}'), ('org-docs', '${photo(U.coach2)}', '{"size": 1000}'), ('org-docs', '${photo(U.kid)}', '{"size": 1000}');
create temp table results (name text primary key, value jsonb);
grant all on results to authenticated, anon;
${as(U.coach)}
${tryRun('coach_out_first', ponto(U.coach, 'check_out'))}
${tryRun('coach_in', ponto(U.coach, 'check_in'))}
${tryRun('coach_in_again', ponto(U.coach, 'check_in'))}
${tryRun('coach_out', ponto(U.coach, 'check_out'))}
${keep('coach_sees', `select count(*)::int n from public.staff_attendance`)}
${tryRun('coach_cert', `insert into public.staff_certificates (org_id, profile_id, course, file_path, mime_type, size_bytes, uploaded_by) values ('${ORG}','${U.coach}','cob_antirracismo','${ORG}/execucao/c.pdf','application/pdf',10,'${U.coach}')`)}
${tryRun('coach_usage', `select public.storage_usage()`)}
${as(U.coach2)}
${tryRun('coach2_far', ponto(U.coach2, 'check_in', -15.9))}
${tryRun('coach2_far_just', ponto(U.coach2, 'check_in', -15.9, "'Treino na quadra anexa'"))}
${keep('coach2_sees', `select count(*)::int n from public.staff_attendance`)}
${as(U.kid)}
${tryRun('kid_ponto', ponto(U.kid, 'check_in'))}
${tryRun('kid_cob_doc', `insert into public.athlete_documents (org_id, athlete_id, kind, file_path, mime_type, size_bytes, uploaded_by) values ('${ORG}','${ATH}','cob_manipulacao','${ORG}/${ATH}/cob-1.pdf','application/pdf',10,'${U.kid}')`)}
${as(U.mgr)}
${keep('mgr_sees', `select count(*)::int n, count(*) filter (where status = 'pending')::int pend from public.staff_attendance`)}
${tryRun('mgr_cert', `insert into public.staff_certificates (org_id, profile_id, course, file_path, mime_type, size_bytes, uploaded_by) values ('${ORG}','${U.coach}','cob_antirracismo','${ORG}/execucao/c2.pdf','application/pdf',10,'${U.mgr}')`)}
${tryRun('mgr_media', `insert into public.project_media (org_id, project_id, kind, description, link, uploaded_by) values ('${ORG}','${PR}','rede_social','Post no Instagram','https://instagram.com/p/x','${U.mgr}')`)}
${tryRun('mgr_media_empty', `insert into public.project_media (org_id, project_id, kind, uploaded_by) values ('${ORG}','${PR}','placa','${U.mgr}')`)}
${tryRun('mgr_usage', `select public.storage_usage()`)}
reset role;
select name, value from results;`;

let R = {};
before(async () => { R = Object.fromEntries((await sql(`begin;\n${scenario}`)).map((r) => [r.name, r.value])); });
const ok = (n) => R[n]?.ok === true;

test('ponto do profissional: entrada antes da saída, sem repetir, com hora do servidor', () => {
  assert.equal(ok('coach_out_first'), false);
  assert.equal(ok('coach_in'), true, R.coach_in?.error);
  assert.equal(R.coach_in.result.status, 'valid');
  assert.equal(ok('coach_in_again'), false);
  assert.equal(ok('coach_out'), true, R.coach_out?.error);
});
test('fora do raio só com justificativa, e fica pendente para o gestor', () => {
  assert.equal(ok('coach2_far'), false);
  assert.equal(ok('coach2_far_just'), true, R.coach2_far_just?.error);
  assert.equal(R.mgr_sees.pend, 1);
});
test('cada profissional vê só o próprio ponto; o gestor vê todos; atleta não bate ponto', () => {
  assert.equal(R.coach_sees.n, 2);
  assert.equal(R.coach2_sees.n, 1);
  assert.equal(R.mgr_sees.n, 3);
  assert.equal(ok('kid_ponto'), false);
});
test('cursos do COB: atleta envia o próprio; certificado da equipe pelo gestor', () => {
  assert.equal(ok('kid_cob_doc'), true, R.kid_cob_doc?.error);
  assert.equal(ok('coach_cert'), false);
  assert.equal(ok('mgr_cert'), true, R.mgr_cert?.error);
});
test('plano de mídia exige foto ou link; uso do armazenamento só para a equipe TechPoint', () => {
  assert.equal(ok('mgr_media'), true, R.mgr_media?.error);
  assert.equal(ok('mgr_media_empty'), false);
  assert.equal(ok('mgr_usage'), false);
  assert.equal(ok('coach_usage'), false);
});
