// Fase C do incentivo (onda 1): proposta aprovada vira projeto; orçamento travado; despesas e comprovantes.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../../scripts/db.mjs';

const id = (n) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { mgr: id(1), coach: id(2) };
const ORG = id(100), TEAM = id(200), A1 = id(300), A2 = id(301), A3 = id(302), P = id(400), P2 = id(401), G = id(500), I = id(600), I2 = id(601);
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
 ('${U.mgr}','e.gestor@teste.local','authenticated','authenticated','{"full_name":"Gestor E"}'),
 ('${U.coach}','e.treinador@teste.local','authenticated','authenticated','{"full_name":"Treinador E"}');
insert into public.organizations (id, name, slug) values ('${ORG}','Clube E','clube-e-teste');
insert into public.memberships (org_id, profile_id, role) values ('${ORG}','${U.mgr}','manager'), ('${ORG}','${U.coach}','coach');
insert into public.org_modules (org_id, module) values ('${ORG}','investimentos');
insert into public.sports (id, name) values ('${id(700)}', 'Vôlei E') on conflict do nothing;
insert into public.teams (id, org_id, sport_id, name) values ('${TEAM}','${ORG}','${id(700)}','Sub 17 E');
insert into public.athletes (id, org_id, full_name, birth_date, sex, status) values
  ('${A1}','${ORG}','Atleta E1','2010-01-01','M','active'), ('${A2}','${ORG}','Atleta E2','2010-02-02','F','active'), ('${A3}','${ORG}','Atleta E3','2010-03-03','F','inactive');
insert into public.team_members (team_id, athlete_id) values ('${TEAM}','${A1}'), ('${TEAM}','${A2}'), ('${TEAM}','${A3}');
create temp table results (name text primary key, value jsonb);
grant all on results to authenticated, anon;
${as(U.mgr)}
insert into public.tech_proposals (id, org_id, title, axis, mesp_value, starts_on, months, audience)
  values ('${P}','${ORG}','Núcleo E','nucleo',400000,'2027-03-01',14,'{"teams":[{"team_id":"${TEAM}","phase":"aperfeicoamento"}]}');
insert into public.tech_proposals (id, org_id, title, axis) values ('${P2}','${ORG}','Outra proposta','nucleo');
insert into public.proposal_goals (id, proposal_id, org_id, objective, quantitative, indicator, target, method) values ('${G}','${P}','${ORG}','Treinar os atletas','Frequência de 75%','avg_frequency',75,'Check-in');
insert into public.proposal_budget_items (id, proposal_id, org_id, stage, description, quantity, unit_value, total) values ('${I}','${P}','${ORG}','material','Bola',30,320,9600);
insert into public.proposal_budget_items (id, proposal_id, org_id, stage, description, quantity, unit_value, total) values ('${I2}','${P2}','${ORG}','material','Rede',1,100,100);
${tryRun('direct_status', `update public.tech_proposals set status = 'aprovada' where id = '${P}'`)}
${tryRun('approve_no_number', `select public.approve_proposal('${P}', '', '2027-02-20')`)}
${tryRun('approve', `select public.approve_proposal('${P}', '123456/2027', '2027-02-20')`)}
${keep('project', `select pr.name, pr.planned_beneficiaries planned, pr.process_number, pr.starts_on, pr.ends_on, pr.status, (select count(*) from public.project_beneficiaries b where b.project_id = pr.id)::int bens, (select count(*) from public.project_goals g where g.project_id = pr.id and g.kind = 'avg_frequency' and g.target = 75)::int goals, (select count(*) from public.project_plan_versions v where v.project_id = pr.id)::int plans from public.projects pr where pr.proposal_id = '${P}'`)}
${keep('proposal_after', `select status, (project_id is not null) linked from public.tech_proposals where id = '${P}'`)}
${tryRun('approve_again', `select public.approve_proposal('${P}', '999/2027', '2027-02-20')`)}
${tryRun('edit_locked_item', `update public.proposal_budget_items set total = 1 where id = '${I}'`)}
${keep('item_total', `select total from public.proposal_budget_items where id = '${I}'`)}
${tryRun('edit_locked_title', `update public.tech_proposals set title = 'Mudou' where id = '${P}'`)}
${tryRun('delete_locked', `delete from public.tech_proposals where id = '${P}'`)}
${tryRun('exec_no_note', `select public.set_item_execution('${I}', 'substituido', '')`)}
${tryRun('exec_note', `select public.set_item_execution('${I}', 'substituido', 'Trocada por modelo oficial da federação')`)}
${tryRun('transfer', `insert into public.project_transfers (org_id, project_id, received_on, value) select '${ORG}', id, '2027-03-10', 400000 from public.projects where proposal_id = '${P}'`)}
${tryRun('expense', `insert into public.project_expenses (org_id, project_id, item_id, supplier, supplier_doc, doc_number, value, spent_on, paid_on) select '${ORG}', id, '${I}', 'Loja A', '11222333000181', 'NF 10', 9300, '2027-04-01', '2027-04-02' from public.projects where proposal_id = '${P}'`)}
${tryRun('expense_other_item', `insert into public.project_expenses (org_id, project_id, item_id, supplier, value, spent_on) select '${ORG}', id, '${I2}', 'Loja B', 100, '2027-04-01' from public.projects where proposal_id = '${P}'`)}
${tryRun('file_ok', `insert into public.expense_files (org_id, expense_id, kind, file_path, mime_type, size_bytes, uploaded_by) select '${ORG}', id, 'nota', '${ORG}/execucao/nf.pdf', 'application/pdf', 10, '${U.mgr}' from public.project_expenses where doc_number = 'NF 10'`)}
${tryRun('file_wrong_folder', `insert into public.expense_files (org_id, expense_id, kind, file_path, mime_type, size_bytes, uploaded_by) select '${ORG}', id, 'nota', '${ORG}/habilitacao/nf.pdf', 'application/pdf', 10, '${U.mgr}' from public.project_expenses where doc_number = 'NF 10'`)}
${as(U.coach)}
${keep('coach_sees', `select (select count(*) from public.project_expenses)::int e, (select count(*) from public.project_transfers)::int t, (select count(*) from public.expense_files)::int f`)}
${tryRun('coach_approve', `select public.approve_proposal('${P2}', '1/2027', '2027-02-20')`)}
reset role;
select name, value from results;`;

let R = {};
before(async () => { R = Object.fromEntries((await sql(`begin;\n${scenario}`)).map((r) => [r.name, r.value])); });
const ok = (n) => R[n]?.ok === true;

test('aprovar só pela função e com o número do termo', () => {
  assert.equal(ok('direct_status'), false);
  assert.equal(ok('approve_no_number'), false);
  assert.equal(ok('approve'), true, R.approve?.error);
  assert.equal(ok('approve_again'), false);
});
test('aprovação cria o projeto com vigência, beneficiários ativos, metas de check-in e plano v1', () => {
  assert.equal(R.project.name, 'Núcleo E');
  assert.equal(R.project.process_number, '123456/2027');
  assert.equal(R.project.starts_on, '2027-03-01');
  assert.equal(R.project.ends_on, '2028-04-30');
  assert.equal(R.project.status, 'active');
  assert.equal(R.project.bens, 2); // o atleta inativo fica fora
  assert.equal(R.project.planned, 2);
  assert.equal(R.project.goals, 1);
  assert.equal(R.project.plans, 1);
  assert.deepEqual(R.proposal_after, { status: 'aprovada', linked: true });
});
test('proposta aprovada fica travada (orçamento combinado não muda); troca de item exige justificativa', () => {
  assert.equal(Number(R.item_total.total), 9600);
  assert.equal(ok('edit_locked_title'), false);
  assert.equal(ok('delete_locked'), false);
  assert.equal(ok('exec_no_note'), false);
  assert.equal(ok('exec_note'), true, R.exec_note?.error);
});
test('repasse, despesa ligada ao item do projeto e comprovante na pasta da execução', () => {
  assert.equal(ok('transfer'), true, R.transfer?.error);
  assert.equal(ok('expense'), true, R.expense?.error);
  assert.equal(ok('expense_other_item'), false); // item de outra proposta
  assert.equal(ok('file_ok'), true, R.file_ok?.error);
  assert.equal(ok('file_wrong_folder'), false);
});
test('treinador não vê a execução financeira nem aprova', () => {
  assert.deepEqual(R.coach_sees, { e: 0, t: 0, f: 0 });
  assert.equal(ok('coach_approve'), false);
});
