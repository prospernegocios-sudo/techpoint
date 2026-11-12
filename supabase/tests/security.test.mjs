// Testes das regras de acesso (RLS) e das funções de presença.
// Roda contra o banco de TESTE dentro de uma transação que é desfeita no fim
// (nada fica gravado). Uso: npm run test:db
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../../scripts/db.mjs';

// ---- Identificadores fixos das pessoas e coisas de teste ----
const id = (n) => `11111111-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { mgrA: id(1), coachA: id(2), athA: id(3), athA2: id(4), mgrB: id(5), outsider: id(6), athB: id(7), kid: id(8) };
const ORG_A = id(100), ORG_B = id(101);
const VEN_A = id(200), VEN_B = id(201);
const TEAM_A1 = id(300), TEAM_A2 = id(301), TEAM_B = id(302);
const ATH = { a: id(400), a2: id(401), b: id(402), kid: id(403), noacc: id(404) };
const EV = { now: id(500), later: id(501), other: id(502), past2h: id(503), orgB: id(504) };
const LAT = -15.7942, LNG = -47.8822;          // centro do local A (raio 150 m)
const FAR_LNG = -47.8700;                      // ~1,3 km de distância

const photo = (ath, ev, n = 1) => `${ath}/${ev}/foto${n}.jpg`;

// ---- Montagem do cenário (roda como superusuário) ----
const fixtures = `
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
 ('${U.mgrA}','gestor.a@teste.local','authenticated','authenticated','{"full_name":"Gestor A"}'),
 ('${U.coachA}','treinador.a@teste.local','authenticated','authenticated','{"full_name":"Treinador A"}'),
 ('${U.athA}','atleta.a@teste.local','authenticated','authenticated','{"full_name":"Atleta A"}'),
 ('${U.athA2}','atleta.a2@teste.local','authenticated','authenticated','{"full_name":"Atleta A2"}'),
 ('${U.mgrB}','gestor.b@teste.local','authenticated','authenticated','{"full_name":"Gestor B"}'),
 ('${U.outsider}','fora@teste.local','authenticated','authenticated','{"full_name":"De Fora"}'),
 ('${U.athB}','atleta.b@teste.local','authenticated','authenticated','{"full_name":"Atleta B"}');

insert into public.organizations (id, name, slug) values ('${ORG_A}','Clube A','clube-a-teste'), ('${ORG_B}','Clube B','clube-b-teste');
insert into public.memberships (org_id, profile_id, role) values
 ('${ORG_A}','${U.mgrA}','manager'), ('${ORG_A}','${U.coachA}','coach'), ('${ORG_B}','${U.mgrB}','manager');
insert into public.venues (id, org_id, name, latitude, longitude, radius_m) values
 ('${VEN_A}','${ORG_A}','Ginásio A',${LAT},${LNG},150), ('${VEN_B}','${ORG_B}','Ginásio B',-15.8,-47.9,150);
insert into public.teams (id, org_id, name) values
 ('${TEAM_A1}','${ORG_A}','A Sub 15'), ('${TEAM_A2}','${ORG_A}','A Sub 17'), ('${TEAM_B}','${ORG_B}','B Sub 15');

-- Atletas com e-mail: são vinculados automaticamente às contas existentes.
insert into public.athletes (id, org_id, full_name, birth_date, email) values
 ('${ATH.a}','${ORG_A}','Atleta A','2011-01-01','atleta.a@teste.local'),
 ('${ATH.a2}','${ORG_A}','Atleta A2','2011-01-01','atleta.a2@teste.local'),
 ('${ATH.b}','${ORG_B}','Atleta B','2011-01-01','atleta.b@teste.local'),
 ('${ATH.kid}','${ORG_A}','Criança 8 anos', (current_date - interval '8 years')::date,'crianca@teste.local'),
 ('${ATH.noacc}','${ORG_A}','Sem Conta','2012-01-01',null);
insert into public.team_members (team_id, athlete_id) values
 ('${TEAM_A1}','${ATH.a}'), ('${TEAM_A1}','${ATH.a2}'), ('${TEAM_A1}','${ATH.noacc}'), ('${TEAM_B}','${ATH.b}');

-- Criança de 8 anos cria conta depois: NÃO deve ser vinculada (mínimo 10 anos).
insert into auth.users (id, email, aud, role) values ('${U.kid}','crianca@teste.local','authenticated','authenticated');

insert into public.events (id, org_id, team_id, venue_id, starts_at, ends_at) values
 ('${EV.now}',   '${ORG_A}','${TEAM_A1}','${VEN_A}', now() - interval '20 minutes', now() + interval '70 minutes'),
 ('${EV.later}', '${ORG_A}','${TEAM_A1}','${VEN_A}', now() + interval '3 hours',    now() + interval '4 hours'),
 ('${EV.other}', '${ORG_A}','${TEAM_A2}','${VEN_A}', now() - interval '10 minutes', now() + interval '80 minutes'),
 ('${EV.past2h}','${ORG_A}','${TEAM_A1}','${VEN_A}', now() - interval '2 hours',    now() - interval '30 minutes'),
 ('${EV.orgB}',  '${ORG_B}','${TEAM_B}', '${VEN_B}', now() - interval '10 minutes', now() + interval '80 minutes');

-- Fotos "já enviadas" ao armazenamento.
insert into storage.objects (bucket_id, name) values
 ('attendance-photos','${photo(ATH.a, EV.now)}'),
 ('attendance-photos','${photo(ATH.a, EV.now, 2)}'),
 ('attendance-photos','${photo(ATH.a, EV.past2h)}'),
 ('attendance-photos','${photo(ATH.a, EV.other)}'),
 ('attendance-photos','${photo(ATH.a2, EV.now)}');

create temp table results (name text primary key, value jsonb);
grant all on results to authenticated, anon;
`;

// ---- Ajudantes para escrever os cenários ----
const as = (uid) => `reset role; select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true); set local role authenticated;`;
const asAnon = `reset role; select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;`;
// Guarda o valor de uma consulta.
const keep = (name, query) => `insert into results values ('${name}', (select to_jsonb(x) from (${query}) x limit 1));`;
// Executa algo que pode falhar; guarda "ok" ou a mensagem de erro (+ detalhe).
const tryRun = (name, stmt) => {
  const isSelect = stmt.trim().toLowerCase().startsWith('select');
  const exec = isSelect
    ? `execute $q$select to_jsonb(s.v) from (${stmt}) s(v)$q$ into v;`
    : `execute $q$${stmt}$q$;`;
  return `do $t$ declare v jsonb; d text; begin
  ${exec}
  insert into results values ('${name}', jsonb_build_object('ok', true, 'result', v));
exception when others then
  get stacked diagnostics d = pg_exception_detail;
  insert into results values ('${name}', jsonb_build_object('ok', false, 'error', sqlerrm, 'detail', nullif(d, '')));
end $t$;`;
};

// Chamada do check-in com valores padrão.
const checkin = (o = {}) => {
  const p = { event: EV.now, kind: 'check_in', lat: LAT, lng: LNG, acc: 10, photo: photo(ATH.a, EV.now),
    hash: 'hash-a', device: 'device-a', mocked: false, clientAt: null, offline: false, just: null, ...o };
  const s = (v) => (v === null ? 'null' : `'${v}'`);
  return `select public.record_attendance('${p.event}', '${p.kind}', ${p.lat}, ${p.lng}, ${p.acc}, ${s(p.photo)}, ${s(p.hash)}, ${s(p.device)}, ${p.mocked}, ${p.clientAt ?? 'null'}, ${p.offline}, ${s(p.just)})`;
};

// Relatório do dia anterior até hoje (fuso de Brasília).
const report = (org, teams) => `select public.attendance_report('${org}', array[${teams.map((t) => `'${t}'`).join(',')}]::uuid[],
  (now() at time zone 'America/Sao_Paulo')::date - 1, (now() at time zone 'America/Sao_Paulo')::date, '{"name":"Projeto Teste"}'::jsonb)`;

// ---- Cenários ----
const scenario = [
  fixtures,
  // Vínculo automático e idade mínima
  `reset role;`,
  keep('link_athlete', `select profile_id::text from public.athletes where id = '${ATH.a}'`),
  keep('link_kid', `select profile_id::text as profile_id from public.athletes where id = '${ATH.kid}'`),
  keep('athlete_membership', `select count(*)::int n from public.memberships where profile_id = '${U.athA}' and role = 'athlete'`),

  // Gestor A
  as(U.mgrA),
  keep('mgrA_athletes', `select count(*)::int n from public.athletes where org_id in ('${ORG_A}','${ORG_B}')`),
  keep('mgrA_athletes_orgB', `select count(*)::int n from public.athletes where org_id = '${ORG_B}'`),
  keep('mgrA_orgs', `select count(*)::int n from public.organizations where id in ('${ORG_A}','${ORG_B}')`),
  tryRun('mgrA_insert_venue_orgB', `insert into public.venues (org_id, name, latitude, longitude) values ('${ORG_B}','Invasão',0,0)`),
  tryRun('mgrA_insert_venue_orgA', `insert into public.venues (org_id, name, latitude, longitude) values ('${ORG_A}','Quadra 2',0,0)`),
  keep('mgrA_audit', `select count(*)::int n from public.audit_log where org_id = '${ORG_A}'`),

  // Treinador A
  as(U.coachA),
  tryRun('coach_insert_athlete', `insert into public.athletes (org_id, full_name, birth_date) values ('${ORG_A}','Novo Atleta','2012-05-05')`),
  tryRun('coach_insert_venue', `insert into public.venues (org_id, name, latitude, longitude) values ('${ORG_A}','Quadra 3',0,0)`),
  tryRun('coach_set_profile_id', `update public.athletes set profile_id = '${U.coachA}' where id = '${ATH.noacc}'`),

  // Atleta A
  as(U.athA),
  keep('athA_athletes', `select count(*)::int n from public.athletes`),
  keep('athA_events', `select count(*)::int n, bool_and(team_id = '${TEAM_A1}') own_team from public.events where org_id in ('${ORG_A}','${ORG_B}')`),
  tryRun('athA_insert_attendance', `insert into public.attendance_records (org_id, event_id, athlete_id, kind, source, status) values ('${ORG_A}','${EV.now}','${ATH.a}','check_in','app','valid')`),
  tryRun('athA_make_admin', `update public.profiles set is_platform_admin = true where id = '${U.athA}'`),
  tryRun('athA_upload_other_folder', `insert into storage.objects (bucket_id, name) values ('attendance-photos','${photo(ATH.a2, EV.now, 9)}')`),
  tryRun('athA_upload_own_folder', `insert into storage.objects (bucket_id, name) values ('attendance-photos','${photo(ATH.a, EV.now, 9)}')`),

  // Check-in
  tryRun('ci_outside_window', checkin({ event: EV.later })),
  tryRun('ci_other_team', checkin({ event: EV.other, photo: photo(ATH.a, EV.other) })),
  tryRun('ci_org_b', checkin({ event: EV.orgB, photo: `${ATH.a}/${EV.orgB}/x.jpg` })),
  tryRun('ci_photo_missing', checkin({ photo: photo(ATH.a, EV.now, 7) })),
  tryRun('ci_photo_other_folder', checkin({ photo: photo(ATH.a2, EV.now) })),
  tryRun('ci_no_photo', checkin({ photo: null })),
  tryRun('co_before_ci', checkin({ kind: 'check_out' })),
  tryRun('ci_outside_radius', checkin({ lng: FAR_LNG })),
  tryRun('ci_offline_too_old', checkin({ offline: true, clientAt: "now() - interval '30 hours'" })),
  tryRun('ci_valid', checkin()),
  keep('ci_server_time', `select (server_at = now()) as is_server_now from public.attendance_records where athlete_id = '${ATH.a}' and event_id = '${EV.now}' and kind = 'check_in'`),
  tryRun('ci_duplicate', checkin({ photo: photo(ATH.a, EV.now, 2) })),
  tryRun('co_valid', checkin({ kind: 'check_out', photo: photo(ATH.a, EV.now, 2), hash: 'hash-a2' })),
  tryRun('ci_offline_ok', checkin({ event: EV.past2h, photo: photo(ATH.a, EV.past2h), hash: 'hash-off',
    offline: true, clientAt: "now() - interval '2 hours' + interval '5 minutes'" })),

  // Atleta A2: fora do raio com justificativa, localização falsa, foto repetida, mesmo aparelho
  as(U.athA2),
  tryRun('ci_a2_pending', checkin({ photo: photo(ATH.a2, EV.now), lng: FAR_LNG, just: 'GPS ruim no ginásio',
    hash: 'hash-a', device: 'device-a', mocked: true })),
  keep('a2_sees_own_only', `select count(*)::int n from public.attendance_records`),
  tryRun('a2_review_self', `select public.review_attendance((select id from public.attendance_records limit 1), true)`),

  // Treinador revisa e registra presença manual
  as(U.coachA),
  keep('coach_sees_all', `select count(*)::int n from public.attendance_records where org_id = '${ORG_A}'`),
  tryRun('coach_review', `select public.review_attendance((select id from public.attendance_records where athlete_id = '${ATH.a2}'), true, 'Conferido')`),
  tryRun('manual_no_reason', `select public.record_manual_attendance('${EV.now}','${ATH.noacc}','check_in','')`),
  tryRun('manual_ok', `select public.record_manual_attendance('${EV.now}','${ATH.noacc}','check_in','Atleta sem celular')`),

  // Gestor B não vê nada do clube A; atleta comum não registra manual
  as(U.mgrB),
  keep('mgrB_sees_orgA_attendance', `select count(*)::int n from public.attendance_records where org_id = '${ORG_A}'`),
  keep('mgrB_sees_orgA_athletes', `select count(*)::int n from public.athletes where org_id = '${ORG_A}'`),
  tryRun('mgrB_manual_orgA', `select public.record_manual_attendance('${EV.now}','${ATH.a2}','check_out','tentativa')`),

  // Pessoa sem vínculo e anônimo
  as(U.outsider),
  keep('outsider_counts', `select (select count(*) from public.organizations)::int orgs, (select count(*) from public.athletes)::int athletes, (select count(*) from public.events)::int events, (select count(*) from storage.objects where bucket_id = 'attendance-photos')::int photos`),
  asAnon,
  tryRun('anon_read_athletes', `select count(*)::int from public.athletes`),

  `reset role;`,
  keep('audit_entries', `select count(*)::int n from public.audit_log where org_id = '${ORG_A}'`),

  // Relatório de frequência (prestação de contas)
  as(U.coachA),
  tryRun('report_coach', report(ORG_A, [TEAM_A1])),
  tryRun('report_bad_period', `select public.attendance_report('${ORG_A}', array['${TEAM_A1}']::uuid[], current_date, current_date - 1)`),
  as(U.athA),
  tryRun('report_athlete', report(ORG_A, [TEAM_A1])),
  as(U.mgrB),
  tryRun('report_other_org', report(ORG_A, [TEAM_A1])),
  tryRun('report_mix_teams', report(ORG_B, [TEAM_A1, TEAM_B])),
  `reset role;`,
  keep('report_audit', `select count(*)::int n from public.audit_log where org_id = '${ORG_A}' and action = 'report_generated'`),
  keep('report_code_check', `select app_private.attendance_code(r) as code from public.attendance_records r where athlete_id = '${ATH.a}' and event_id = '${EV.past2h}'`),
  `select name, value from results;`,
].join('\n');

let R = {};
before(async () => {
  const rows = await sql(`begin;\n${scenario}`); // sem commit: tudo é desfeito
  R = Object.fromEntries(rows.map((r) => [r.name, r.value]));
});

const err = (name) => R[name]?.error ?? '';
const ok = (name) => R[name]?.ok === true;
const res = (name) => R[name]?.result;

test('conta é vinculada ao cadastro de atleta pelo e-mail e ganha papel de atleta', () => {
  assert.equal(R.link_athlete.profile_id, U.athA);
  assert.equal(R.athlete_membership.n, 1);
});
test('criança com menos de 10 anos NÃO é vinculada a uma conta', () => {
  assert.equal(R.link_kid.profile_id, null);
});
test('gestor vê só atletas da própria organização', () => {
  assert.equal(R.mgrA_athletes_orgB.n, 0);
  assert.equal(R.mgrA_athletes.n, 4);
  assert.equal(R.mgrA_orgs.n, 1);
});
test('gestor não cadastra local em outra organização, mas cadastra na sua', () => {
  assert.equal(ok('mgrA_insert_venue_orgB'), false);
  assert.equal(ok('mgrA_insert_venue_orgA'), true);
});
test('treinador cadastra atleta, mas não cadastra local nem vincula conta de atleta', () => {
  assert.equal(ok('coach_insert_athlete'), true);
  assert.equal(ok('coach_insert_venue'), false);
  assert.equal(ok('coach_set_profile_id'), false);
});
test('atleta vê só o próprio cadastro e só eventos da sua equipe', () => {
  assert.equal(R.athA_athletes.n, 1);
  assert.equal(R.athA_events.own_team, true);
  assert.equal(R.athA_events.n, 3);
});
test('atleta não grava presença direto na tabela nem se torna admin', () => {
  assert.equal(ok('athA_insert_attendance'), false);
  assert.equal(ok('athA_make_admin'), false);
});
test('atleta só envia foto para a própria pasta', () => {
  assert.equal(ok('athA_upload_other_folder'), false);
  assert.equal(ok('athA_upload_own_folder'), true);
});
test('check-in fora da janela de horário é recusado', () => {
  assert.match(err('ci_outside_window'), /TP_OUTSIDE_WINDOW/);
});
test('check-in em treino de outra equipe ou outra organização é recusado', () => {
  assert.match(err('ci_other_team'), /TP_NOT_IN_TEAM/);
  assert.match(err('ci_org_b'), /TP_NOT_IN_TEAM/);
});
test('check-in exige foto real, enviada na pasta do próprio atleta', () => {
  assert.match(err('ci_photo_missing'), /TP_PHOTO_NOT_FOUND/);
  assert.match(err('ci_photo_other_folder'), /TP_PHOTO_REQUIRED/);
  assert.match(err('ci_no_photo'), /TP_PHOTO_REQUIRED/);
});
test('check-out sem check-in é recusado', () => {
  assert.match(err('co_before_ci'), /TP_NO_CHECK_IN/);
});
test('fora do raio sem justificativa é recusado', () => {
  assert.match(err('ci_outside_radius'), /TP_OUTSIDE_RADIUS/);
});
test('registro offline muito antigo é recusado', () => {
  assert.match(err('ci_offline_too_old'), /TP_OFFLINE_TOO_OLD/);
});
test('check-in dentro do raio é válido e usa a hora do servidor', () => {
  assert.equal(ok('ci_valid'), true, err('ci_valid'));
  assert.equal(res('ci_valid').status, 'valid');
  assert.ok(res('ci_valid').distance_m <= 1);
  assert.equal(R.ci_server_time.is_server_now, true);
});
test('não é possível fazer dois check-ins no mesmo treino', () => {
  assert.match(err('ci_duplicate'), /TP_ALREADY_RECORDED/);
});
test('check-out depois do check-in é válido', () => {
  assert.equal(ok('co_valid'), true, err('co_valid'));
  assert.equal(res('co_valid').status, 'valid');
});
test('registro offline dentro do prazo é aceito e marcado', () => {
  assert.equal(ok('ci_offline_ok'), true, err('ci_offline_ok'));
  assert.ok(res('ci_offline_ok').flags.includes('offline_sync'));
});
test('fora do raio com justificativa vira pendente e antifraude sinaliza', () => {
  assert.equal(ok('ci_a2_pending'), true, err('ci_a2_pending'));
  const r = res('ci_a2_pending');
  assert.equal(r.status, 'pending');
  for (const f of ['outside_radius', 'mock_location', 'duplicate_photo', 'shared_device']) {
    assert.ok(r.flags.includes(f), `faltou o sinal ${f}`);
  }
});
test('atleta vê só os próprios registros e não aprova a si mesmo', () => {
  assert.equal(R.a2_sees_own_only.n, 1);
  assert.match(err('a2_review_self'), /TP_FORBIDDEN/);
});
test('treinador vê a presença da organização e aprova pendências', () => {
  assert.equal(R.coach_sees_all.n, 4);
  assert.equal(ok('coach_review'), true, err('coach_review'));
  assert.equal(res('coach_review').status, 'valid');
});
test('presença manual exige motivo e fica registrada', () => {
  assert.match(err('manual_no_reason'), /TP_REASON_REQUIRED/);
  assert.equal(ok('manual_ok'), true, err('manual_ok'));
});
test('gestor de outra organização não vê nem registra nada no clube A', () => {
  assert.equal(R.mgrB_sees_orgA_attendance.n, 0);
  assert.equal(R.mgrB_sees_orgA_athletes.n, 0);
  assert.match(err('mgrB_manual_orgA'), /TP_FORBIDDEN/);
});
test('pessoa sem vínculo não vê nada', () => {
  assert.deepEqual(R.outsider_counts, { orgs: 0, athletes: 0, events: 0, photos: 0 });
});
test('usuário não logado não acessa dados', () => {
  assert.equal(ok('anon_read_athletes'), false);
});
test('ações sensíveis ficam na auditoria', () => {
  // check-in, check-out, offline, pendente, revisão, manual = 6
  assert.equal(R.audit_entries.n, 6);
});
test('relatório de frequência: treinador gera, só com treinos encerrados e código de verificação', () => {
  assert.equal(ok('report_coach'), true, err('report_coach'));
  const r = res('report_coach');
  assert.deepEqual(r.events.map((e) => e.id), [EV.past2h]); // o treino em andamento e o futuro não entram
  assert.equal(r.members.length, 3);
  assert.equal(r.records.length, 1);
  assert.equal(r.records[0].synced_offline, true);
  assert.match(r.records[0].code, /^[0-9A-F]{10}$/);
  assert.equal(r.records[0].code, R.report_code_check.code);
  assert.equal(r.project.name, 'Projeto Teste');
  assert.match(err('report_bad_period'), /TP_INVALID_PERIOD/);
});
test('relatório: atleta e gestor de outro clube não geram; times de outro clube são ignorados', () => {
  assert.match(err('report_athlete'), /TP_FORBIDDEN/);
  assert.match(err('report_other_org'), /TP_FORBIDDEN/);
  assert.equal(ok('report_mix_teams'), true, err('report_mix_teams'));
  assert.deepEqual(res('report_mix_teams').teams.map((t) => t.id), [TEAM_B]);
});
test('cada relatório gerado fica na auditoria', () => {
  assert.equal(R.report_audit.n, 1);
});
