// Testes do módulo de projetos incentivados: regras de acesso, cálculo dos indicadores
// e emissão congelada de relatórios. Roda numa transação desfeita no fim. Uso: npm run test:db
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../../scripts/db.mjs';

const id = (n) => `22222222-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { mgr: id(1), coach: id(2), ath: id(3), mgrB: id(4) };
const ORG = id(100), ORG_B = id(101), VEN = id(200);
const T1 = id(300), T2 = id(301);
const A = { a: id(400), b: id(401), c: id(402), d: id(403), x: id(404) };
const E = { e1: id(500), e2: id(501), e3: id(502), e5: id(504) };
const P = id(600);
const SP = `(now() at time zone 'America/Sao_Paulo')::date`;

const fixtures = `
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
 ('${U.mgr}','p.gestor@teste.local','authenticated','authenticated','{"full_name":"Gestor P"}'),
 ('${U.coach}','p.treinador@teste.local','authenticated','authenticated','{"full_name":"Treinador P"}'),
 ('${U.ath}','p.atleta@teste.local','authenticated','authenticated','{"full_name":"Atleta P"}'),
 ('${U.mgrB}','p.gestorb@teste.local','authenticated','authenticated','{"full_name":"Gestor PB"}');
insert into public.organizations (id, name, slug) values ('${ORG}','Clube P','clube-p-teste'), ('${ORG_B}','Clube PB','clube-pb-teste');
insert into public.memberships (org_id, profile_id, role) values
 ('${ORG}','${U.mgr}','manager'), ('${ORG}','${U.coach}','coach'), ('${ORG_B}','${U.mgrB}','manager');
insert into public.venues (id, org_id, name, latitude, longitude) values ('${VEN}','${ORG}','Ginásio P',-15.79,-47.88);
insert into public.teams (id, org_id, name) values ('${T1}','${ORG}','P Sub 15'), ('${T2}','${ORG}','P Sub 17');
insert into public.athletes (id, org_id, full_name, birth_date, email) values
 ('${A.a}','${ORG}','Ana','2011-01-01','p.atleta@teste.local'),
 ('${A.b}','${ORG}','Bruno','2011-01-01',null),
 ('${A.c}','${ORG}','Caio','2011-01-01',null),
 ('${A.d}','${ORG}','Davi','2011-01-01',null);
insert into public.athletes (id, org_id, full_name, birth_date) values ('${A.x}','${ORG_B}','Xavier','2011-01-01');
insert into public.team_members (team_id, athlete_id) values ('${T1}','${A.a}'), ('${T1}','${A.b}'), ('${T1}','${A.c}'), ('${T2}','${A.d}');
insert into public.events (id, org_id, team_id, venue_id, starts_at, ends_at, status) values
 ('${E.e1}','${ORG}','${T1}','${VEN}', now() - interval '3 days', now() - interval '3 days' + interval '90 minutes', 'scheduled'),
 ('${E.e2}','${ORG}','${T1}','${VEN}', now() - interval '1 day',  now() - interval '1 day' + interval '90 minutes', 'scheduled'),
 ('${E.e3}','${ORG}','${T1}','${VEN}', now() - interval '2 days', now() - interval '2 days' + interval '90 minutes', 'canceled'),
 ('${E.e5}','${ORG}','${T2}','${VEN}', now() - interval '2 days', now() - interval '2 days' + interval '90 minutes', 'scheduled');
-- Registros (como o servidor gravaria): Ana presente nos dois; Bruno pendente; Caio presente mas não é beneficiário.
insert into public.attendance_records (org_id, event_id, athlete_id, kind, server_at, source, status, latitude, longitude, distance_m) values
 ('${ORG}','${E.e1}','${A.a}','check_in', now() - interval '3 days','app','valid',-15.79,-47.88,5),
 ('${ORG}','${E.e2}','${A.a}','check_in', now() - interval '1 day','app','valid',-15.79,-47.88,5),
 ('${ORG}','${E.e2}','${A.b}','check_in', now() - interval '1 day','app','pending',-15.80,-47.88,900),
 ('${ORG}','${E.e1}','${A.c}','check_in', now() - interval '3 days','app','valid',-15.79,-47.88,5);
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
const issue = (rect = null, reason = null) =>
  `select public.issue_project_report('${P}', ${SP} - 10, ${SP}, ${rect ? `(select id from public.project_reports where project_id = '${P}' and number = ${rect} and version = 1)` : 'null'}, ${reason ? `'${reason}'` : 'null'})`;

const scenario = [
  fixtures,
  // Gestor monta o projeto
  as(U.mgr),
  tryRun('create_project', `insert into public.projects (id, org_id, name, process_number, starts_on, ends_on, status, public_school_min_pct)
    values ('${P}','${ORG}','Vôlei para Todos','58000.000001/2026-00', ${SP} - 30, ${SP} + 30, 'active', 50)`),
  tryRun('plan_v1', `insert into public.project_plan_versions (org_id, project_id, version, approved_on, description) values ('${ORG}','${P}',1, ${SP} - 30,'Plano aprovado')`),
  tryRun('plan_update', `update public.project_plan_versions set description = 'mudado' where project_id = '${P}'`),
  keep('plan_after_update', `select description from public.project_plan_versions where project_id = '${P}'`),
  tryRun('goals', `insert into public.project_goals (org_id, project_id, code, description, kind, unit, target) values
    ('${ORG}','${P}','Meta 1','Atender beneficiários','unique_beneficiaries','pessoas',2),
    ('${ORG}','${P}','Meta 2','Atendimentos','attendances','atendimentos',5),
    ('${ORG}','${P}','Meta 3','Frequência média','avg_frequency','%',60),
    ('${ORG}','${P}','Meta 4','Oficinas para pais','manual','oficinas',10)`),
  tryRun('entry_manual', `insert into public.project_goal_entries (org_id, goal_id, value, reference_date) select '${ORG}', id, 7, ${SP} from public.project_goals where code = 'Meta 4' and project_id = '${P}'`),
  tryRun('entry_auto_goal', `insert into public.project_goal_entries (org_id, goal_id, value, reference_date) select '${ORG}', id, 99, ${SP} from public.project_goals where code = 'Meta 1' and project_id = '${P}'`),
  tryRun('project_team', `insert into public.project_teams (project_id, team_id, org_id) values ('${P}','${T1}','${ORG}')`),
  tryRun('beneficiaries', `insert into public.project_beneficiaries (project_id, athlete_id, org_id, starts_on, school_type) values
    ('${P}','${A.a}','${ORG}', ${SP} - 30, 'publica'),
    ('${P}','${A.b}','${ORG}', ((now() - interval '1 day') at time zone 'America/Sao_Paulo')::date, 'nao_informado'),
    ('${P}','${A.d}','${ORG}', ${SP} - 30, 'privada')`),
  tryRun('beneficiary_other_org', `insert into public.project_beneficiaries (project_id, athlete_id, org_id, starts_on) values ('${P}','${A.x}','${ORG}', ${SP})`),
  tryRun('indicators', `select public.project_indicators('${P}', ${SP} - 10, ${SP})`),

  // Treinador: lê e emite, não cria projeto
  as(U.coach),
  keep('coach_sees', `select count(*)::int n from public.projects where id = '${P}'`),
  tryRun('coach_create_project', `insert into public.projects (org_id, name, starts_on, ends_on) values ('${ORG}','Outro', ${SP}, ${SP})`),
  tryRun('issue_1', issue()),
  tryRun('issue_2', issue()),
  tryRun('rectify_no_reason', issue(1, null)),
  tryRun('rectify_ok', issue(1, 'Correção de presença aprovada depois')),
  tryRun('coach_edit_report', `update public.project_reports set sha256 = 'x' where project_id = '${P}'`),
  keep('reports_after_edit', `select count(*)::int n from public.project_reports where sha256 = 'x'`),

  // Atleta e outro clube
  as(U.ath),
  keep('ath_sees', `select count(*)::int n from public.projects`),
  tryRun('ath_indicators', `select public.project_indicators('${P}')`),
  as(U.mgrB),
  keep('mgrB_sees', `select (select count(*) from public.projects where id = '${P}')::int p, (select count(*) from public.project_reports where project_id = '${P}')::int r`),
  tryRun('mgrB_indicators', `select public.project_indicators('${P}')`),
  tryRun('mgrB_issue', issue()),

  `reset role;`,
  keep('report_rows', `select jsonb_agg(jsonb_build_object('n', number, 'v', version, 'hash_ok', sha256 = encode(sha256(convert_to(data::text, 'UTF8')), 'hex')) order by number, version) rows from public.project_reports where project_id = '${P}'`),
  keep('audit', `select (select count(*) from public.audit_log where org_id = '${ORG}' and table_name = 'projects')::int projects,
                        (select count(*) from public.audit_log where org_id = '${ORG}' and action = 'report_issued')::int issued`),
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

test('gestor monta o projeto: plano, metas, equipe e beneficiários', () => {
  for (const n of ['create_project', 'plan_v1', 'goals', 'entry_manual', 'project_team', 'beneficiaries']) assert.equal(ok(n), true, `${n}: ${err(n)}`);
});
test('versão do plano aprovado não pode ser alterada', () => {
  assert.equal(R.plan_after_update.description, 'Plano aprovado');
});
test('resultado manual só em meta manual; beneficiário de outro clube é recusado', () => {
  assert.equal(ok('entry_auto_goal'), false);
  assert.equal(ok('beneficiary_other_org'), false);
});
test('indicadores seguem as regras de cálculo', () => {
  assert.equal(ok('indicators'), true, err('indicators'));
  const i = res('indicators');
  const ind = i.indicators;
  assert.equal(ind.activities_done, 2);          // e1 e e2 (e3 cancelado, e5 é de outra equipe)
  assert.equal(ind.activities_canceled, 1);
  assert.equal(ind.beneficiaries_enrolled, 3);   // Ana, Bruno, Davi (Caio não é beneficiário)
  assert.equal(ind.eligible_total, 3);           // Ana 2 + Bruno 1 (entrou no dia do e2) + Davi 0
  assert.equal(ind.attendances, 2);              // pendente do Bruno não conta
  assert.equal(ind.unique_beneficiaries, 1);
  assert.equal(Number(ind.avg_frequency_pct), 66.7);
  assert.equal(ind.pending_total, 1);
  assert.equal(Number(ind.public_school_pct), 33.3);
  assert.equal(ind.school_unknown, 1);
  const davi = i.beneficiaries.find((b) => b.full_name === 'Davi');
  assert.equal(davi.frequency_pct, null);        // sem atividades elegíveis = não aplicável
  const g = Object.fromEntries(i.goals.map((x) => [x.code, x]));
  assert.equal(Number(g['Meta 1'].result), 1);
  assert.equal(g['Meta 1'].reached, false);
  assert.equal(Number(g['Meta 3'].result), 66.7);
  assert.equal(g['Meta 3'].reached, true);
  assert.equal(Number(g['Meta 4'].result), 7);
  assert.equal(i.records, undefined);            // o painel não traz dados de presença individuais
});
test('treinador vê e emite relatórios, mas não cria projeto nem altera relatório emitido', () => {
  assert.equal(R.coach_sees.n, 1);
  assert.equal(ok('coach_create_project'), false);
  assert.equal(ok('issue_1'), true, err('issue_1'));
  assert.deepEqual([res('issue_1').number, res('issue_1').version], [1, 1]);
  assert.deepEqual([res('issue_2').number, res('issue_2').version], [2, 1]);
  assert.match(err('rectify_no_reason'), /TP_REASON_REQUIRED/);
  assert.deepEqual([res('rectify_ok').number, res('rectify_ok').version], [1, 2]);
  assert.equal(ok('coach_edit_report'), false);
  assert.equal(R.reports_after_edit.n, 0);
});
test('relatório emitido fica congelado com impressão digital conferível', () => {
  assert.deepEqual(R.report_rows.rows, [
    { n: 1, v: 1, hash_ok: true }, { n: 1, v: 2, hash_ok: true }, { n: 2, v: 1, hash_ok: true },
  ]);
});
test('atleta e gestor de outro clube não veem projetos', () => {
  assert.equal(R.ath_sees.n, 0);
  assert.match(err('ath_indicators'), /TP_FORBIDDEN/);
  assert.deepEqual(R.mgrB_sees, { p: 0, r: 0 });
  assert.match(err('mgrB_indicators'), /TP_FORBIDDEN/);
  assert.match(err('mgrB_issue'), /TP_FORBIDDEN/);
});
test('mudanças em projeto e emissões ficam na auditoria', () => {
  assert.ok(R.audit.projects >= 1);
  assert.equal(R.audit.issued, 3);
});
