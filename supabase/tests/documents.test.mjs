// Fase 2 · Onda 1: documentos do atleta e pedido de exclusão de conta.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../../scripts/db.mjs';

const id = (n) => `66666666-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { coach: id(1), kid: id(2), mom: id(3), stranger: id(4), other: id(5) };
const ORG = id(100), ORG2 = id(101), ATH = id(400), ATH2 = id(401);
const path = (org, ath, f) => `${org}/${ath}/${f}`;

const fixtures = `
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
 ('${U.coach}','d.treinador@teste.local','authenticated','authenticated','{"full_name":"Treinador D"}'),
 ('${U.kid}','d.atleta@teste.local','authenticated','authenticated','{"full_name":"Atleta D"}'),
 ('${U.mom}','d.mae@teste.local','authenticated','authenticated','{"full_name":"Mãe D"}'),
 ('${U.stranger}','d.estranho@teste.local','authenticated','authenticated','{"full_name":"Estranho D"}'),
 ('${U.other}','d.outro@teste.local','authenticated','authenticated','{"full_name":"Treinador de outro clube"}');
insert into public.organizations (id, name, slug) values ('${ORG}','Clube D','clube-d-teste'), ('${ORG2}','Clube D2','clube-d2-teste');
insert into public.memberships (org_id, profile_id, role) values ('${ORG}','${U.coach}','coach'), ('${ORG2}','${U.other}','coach'), ('${ORG}','${U.kid}','athlete');
insert into public.athletes (id, org_id, profile_id, full_name, birth_date) values ('${ATH}','${ORG}','${U.kid}','Atleta D','2012-03-03'), ('${ATH2}','${ORG}',null,'Outro D','2012-04-04');
insert into public.athlete_guardians (org_id, athlete_id, name, profile_id, status) values ('${ORG}','${ATH}','Mãe D','${U.mom}','active');
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
const doc = (name, org, ath, file, by) => tryRun(name, `insert into public.athlete_documents (org_id, athlete_id, kind, file_path, mime_type, size_bytes, uploaded_by)
  values ('${org}','${ath}','atestado','${path(org, ath, file)}','application/pdf', 1000, '${by}')`);
const obj = (name, org, ath, file) => tryRun(name, `insert into storage.objects (bucket_id, name) values ('athlete-docs','${path(org, ath, file)}')`);

const scenario = [
  fixtures,
  as(U.kid),
  doc('kid_own', ORG, ATH, 'a.pdf', U.kid),
  obj('kid_obj', ORG, ATH, 'a.pdf'),
  doc('kid_other_athlete', ORG, ATH2, 'b.pdf', U.kid),
  obj('kid_obj_other', ORG, ATH2, 'b.pdf'),
  doc('kid_fake_uploader', ORG, ATH, 'c.pdf', U.coach),
  doc('kid_wrong_folder', ORG2, ATH, 'd.pdf', U.kid),
  as(U.mom),
  doc('mom_child', ORG, ATH, 'm.pdf', U.mom),
  keep('mom_sees', `select count(*)::int n from public.athlete_documents`),
  as(U.coach),
  doc('coach_any', ORG, ATH2, 'e.pdf', U.coach),
  keep('coach_sees', `select count(*)::int n from public.athlete_documents`),
  as(U.stranger),
  keep('stranger_sees', `select count(*)::int n from public.athlete_documents`),
  obj('stranger_obj', ORG, ATH, 'x.pdf'),
  as(U.other),
  keep('other_org_sees', `select count(*)::int n from public.athlete_documents`),
  as(U.mom),
  tryRun('mom_deletes_kid_doc', `delete from public.athlete_documents where file_path = '${path(ORG, ATH, 'a.pdf')}'`),
  `reset role;`,
  keep('after_mom_delete', `select count(*)::int n from public.athlete_documents where file_path = '${path(ORG, ATH, 'a.pdf')}'`),
  as(U.coach),
  tryRun('coach_deletes', `delete from public.athlete_documents where file_path = '${path(ORG, ATH, 'a.pdf')}'`),
  `reset role;`,
  keep('after_coach_delete', `select count(*)::int n from public.athlete_documents where file_path = '${path(ORG, ATH, 'a.pdf')}'`),
  keep('audited', `select count(*)::int n from public.audit_log where table_name = 'athlete_documents'`),
  // Exclusão de conta
  as(U.kid),
  tryRun('del_req', `select public.request_account_deletion('Não jogo mais')`),
  tryRun('del_req_again', `select public.request_account_deletion(null)`),
  keep('kid_sees_req', `select count(*)::int n from public.deletion_requests`),
  tryRun('kid_direct_insert', `insert into public.deletion_requests (profile_id) values ('${U.mom}')`),
  as(U.mom),
  keep('mom_sees_req', `select count(*)::int n from public.deletion_requests`),
  as(U.kid),
  tryRun('cancel', `select public.cancel_account_deletion()`),
  `reset role;`,
  keep('after_cancel', `select status from public.deletion_requests where profile_id = '${U.kid}'`),
  `select name, value from results;`,
].join('\n');

let R = {};
before(async () => { R = Object.fromEntries((await sql(`begin;\n${scenario}`)).map((r) => [r.name, r.value])); });
const ok = (n) => R[n]?.ok === true;
const err = (n) => R[n]?.error ?? '';
const res = (n) => R[n]?.result;

test('atleta envia os próprios documentos, mas não os de outro atleta nem em nome de outra pessoa', () => {
  assert.equal(ok('kid_own'), true, err('kid_own'));
  assert.equal(ok('kid_obj'), true, err('kid_obj'));
  assert.equal(ok('kid_other_athlete'), false);
  assert.equal(ok('kid_obj_other'), false);
  assert.equal(ok('kid_fake_uploader'), false);
  assert.equal(ok('kid_wrong_folder'), false);
});

test('responsável envia e vê os documentos do filho; treinador vê os da entidade; estranhos e outro clube não veem', () => {
  assert.equal(ok('mom_child'), true, err('mom_child'));
  assert.equal(R.mom_sees.n, 2);
  assert.equal(ok('coach_any'), true, err('coach_any'));
  assert.equal(R.coach_sees.n, 3);
  assert.equal(R.stranger_sees.n, 0);
  assert.equal(ok('stranger_obj'), false);
  assert.equal(R.other_org_sees.n, 0);
});

test('só a equipe ou quem enviou apaga; tudo fica auditado', () => {
  assert.equal(R.after_mom_delete.n, 1); // a mãe não apaga o que o filho enviou
  assert.equal(R.after_coach_delete.n, 0);
  assert.ok(R.audited.n >= 4);
});

test('pedido de exclusão de conta: um pedido aberto por pessoa, visível só ao dono, e pode ser cancelado', () => {
  assert.equal(ok('del_req'), true, err('del_req'));
  assert.equal(res('del_req_again').already, true);
  assert.equal(R.kid_sees_req.n, 1);
  assert.equal(ok('kid_direct_insert'), false);
  assert.equal(R.mom_sees_req.n, 0);
  assert.equal(R.after_cancel.status, 'canceled');
});
