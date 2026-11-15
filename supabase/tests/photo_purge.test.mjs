// Exclusão das fotos após o prazo (D76): 24 meses, exceto projeto com prazo de guarda maior.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../../scripts/db.mjs';

const id = (n) => `77777777-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { coach: id(1) };
const ORG = id(100), VEN = id(200), T_PROJ = id(300), T_FREE = id(301), ATH = id(400), PROJ = id(600);
const EV_OLD_P = id(500), EV_OLD_F = id(501), EV_NEW_F = id(502);
const R_OLD_P = id(700), R_OLD_F = id(701), R_NEW_F = id(702);

const scenario = `
begin;
insert into auth.users (id, email, aud, role) values ('${U.coach}','p.treinador@teste.local','authenticated','authenticated');
insert into public.organizations (id, name, slug) values ('${ORG}','Clube P','clube-p-teste');
insert into public.memberships (org_id, profile_id, role) values ('${ORG}','${U.coach}','coach');
insert into public.venues (id, org_id, name, latitude, longitude) values ('${VEN}','${ORG}','Ginásio P',-15.79,-47.88);
insert into public.teams (id, org_id, name) values ('${T_PROJ}','${ORG}','P Projeto'), ('${T_FREE}','${ORG}','P Livre');
insert into public.athletes (id, org_id, full_name, birth_date) values ('${ATH}','${ORG}','Atleta Adulto P','1990-01-01');
insert into public.events (id, org_id, team_id, venue_id, starts_at, ends_at) values
 ('${EV_OLD_P}','${ORG}','${T_PROJ}','${VEN}', now() - interval '25 months', now() - interval '25 months' + interval '1 hour'),
 ('${EV_OLD_F}','${ORG}','${T_FREE}','${VEN}', now() - interval '25 months', now() - interval '25 months' + interval '1 hour'),
 ('${EV_NEW_F}','${ORG}','${T_FREE}','${VEN}', now() - interval '3 months', now() - interval '3 months' + interval '1 hour');
insert into public.projects (id, org_id, name, starts_on, ends_on, records_retention_until)
 values ('${PROJ}','${ORG}','Projeto P', (now() - interval '26 months')::date, (now() - interval '20 months')::date, current_date + 3650);
insert into public.project_teams (project_id, team_id, org_id) values ('${PROJ}','${T_PROJ}','${ORG}');
insert into public.attendance_records (id, org_id, event_id, athlete_id, kind, source, status, server_at, photo_path) values
 ('${R_OLD_P}','${ORG}','${EV_OLD_P}','${ATH}','check_in','app','valid', now() - interval '25 months', 'x/old-proj.jpg'),
 ('${R_OLD_F}','${ORG}','${EV_OLD_F}','${ATH}','check_in','app','valid', now() - interval '25 months', 'x/old-free.jpg'),
 ('${R_NEW_F}','${ORG}','${EV_NEW_F}','${ATH}','check_in','app','valid', now() - interval '3 months', 'x/new-free.jpg');
create temp table results (name text primary key, value jsonb);
grant all on results to authenticated;
insert into results select 'due', to_jsonb(array_agg(record_id)) from app_private.photos_due_for_purge(1000) where record_id in ('${R_OLD_P}','${R_OLD_F}','${R_NEW_F}');
do $t$ begin
  perform set_config('request.jwt.claims', '{"sub":"${U.coach}","role":"authenticated"}', true);
  set local role authenticated;
  perform public.purge_photos_mark(array['${R_OLD_F}']::uuid[]);
  reset role;
  insert into results values ('coach_mark', '"ok"');
exception when others then reset role; insert into results values ('coach_mark', to_jsonb(sqlerrm));
end $t$;
reset role;
insert into results values ('marked', to_jsonb(public.purge_photos_mark(array['${R_OLD_F}','${R_OLD_P}','${R_NEW_F}']::uuid[])));
insert into results select 'after', jsonb_object_agg(id, photo_path is null) from public.attendance_records where id in ('${R_OLD_P}','${R_OLD_F}','${R_NEW_F}');
update public.projects set records_retention_until = current_date - 1 where id = '${PROJ}';
insert into results select 'due_after_retention', to_jsonb(array_agg(record_id)) from app_private.photos_due_for_purge(1000) where record_id in ('${R_OLD_P}','${R_OLD_F}','${R_NEW_F}');
select name, value from results;
`;

let R = {};
before(async () => { R = Object.fromEntries((await sql(scenario)).map((r) => [r.name, r.value])); });

test('vencida e fora de projeto entra na lista; projeto com guarda maior e foto recente ficam', () => {
  assert.deepEqual(R.due, [R_OLD_F]);
});

test('só a chave de serviço marca as fotos como apagadas; marca apenas as vencidas', () => {
  assert.notEqual(R.coach_mark, 'ok');
  assert.equal(R.marked, 1);
  assert.deepEqual(R.after, { [R_OLD_P]: false, [R_OLD_F]: true, [R_NEW_F]: false });
});

test('quando o prazo de guarda do projeto termina, a foto do projeto passa a vencer', () => {
  assert.deepEqual(R.due_after_retention, [R_OLD_P]);
});
