// Check-in atrasado: aceito até o fim do treino e marcado; depois do fim, recusado.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '../../scripts/db.mjs';

const id = (n) => `44444444-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = id(1), ORG = id(100), VEN = id(200), TEAM = id(300), ATH = id(400), LATE = id(500), OVER = id(501);
const scenario = `
insert into auth.users (id, email, aud, role) values ('${U}','l.atleta@teste.local','authenticated','authenticated');
insert into public.organizations (id, name, slug) values ('${ORG}','Clube L','clube-l-teste');
insert into public.venues (id, org_id, name, latitude, longitude) values ('${VEN}','${ORG}','Ginásio L',-15.79,-47.88);
insert into public.teams (id, org_id, name) values ('${TEAM}','${ORG}','L Sub 15');
insert into public.athletes (id, org_id, full_name, birth_date, email) values ('${ATH}','${ORG}','Atleta L','2011-01-01','l.atleta@teste.local');
insert into public.team_members (team_id, athlete_id) values ('${TEAM}','${ATH}');
insert into public.events (id, org_id, team_id, venue_id, starts_at, ends_at) values
 ('${LATE}','${ORG}','${TEAM}','${VEN}', now() - interval '60 minutes', now() + interval '30 minutes'),
 ('${OVER}','${ORG}','${TEAM}','${VEN}', now() - interval '3 hours', now() - interval '90 minutes');
insert into storage.objects (bucket_id, name) values ('attendance-photos','${ATH}/${LATE}/a.jpg'), ('attendance-photos','${ATH}/${OVER}/a.jpg');
create temp table results (name text primary key, value jsonb);
grant all on results to authenticated;
reset role; select set_config('request.jwt.claims', '{"sub":"${U}","role":"authenticated"}', true); set local role authenticated;
do $t$ declare v jsonb; begin
  v := public.record_attendance('${LATE}','check_in',-15.79,-47.88,5,'${ATH}/${LATE}/a.jpg','h1','d1',false,null,false,null);
  insert into results values ('late', v);
exception when others then insert into results values ('late', jsonb_build_object('error', sqlerrm)); end $t$;
do $t$ declare v jsonb; begin
  v := public.record_attendance('${OVER}','check_in',-15.79,-47.88,5,'${ATH}/${OVER}/a.jpg','h2','d1',false,null,false,null);
  insert into results values ('over', v);
exception when others then insert into results values ('over', jsonb_build_object('error', sqlerrm)); end $t$;
do $t$ begin
  insert into public.attendance_correction_requests (org_id, record_id, athlete_id, reason)
  select '${ORG}', id, '${ATH}', 'Fiz check-in no treino errado' from public.attendance_records where event_id = '${LATE}';
  insert into results values ('corr', '{"ok":true}');
exception when others then insert into results values ('corr', jsonb_build_object('error', sqlerrm)); end $t$;
do $t$ begin
  update public.attendance_correction_requests set status = 'resolved';
  insert into results values ('corr_self_resolve', (select to_jsonb(count(*)) from public.attendance_correction_requests where status = 'resolved'));
exception when others then insert into results values ('corr_self_resolve', jsonb_build_object('error', sqlerrm)); end $t$;
reset role;
select name, value from results;`;
let R = {};
before(async () => { R = Object.fromEntries((await sql(`begin;\n${scenario}`)).map((r) => [r.name, r.value])); });
test('check-in 1 hora depois do início é aceito, válido e marcado como atrasado', () => {
  assert.equal(R.late.status, 'valid', JSON.stringify(R.late));
  assert.ok(R.late.flags.includes('late'));
});
test('check-in depois que o treino acabou é recusado', () => {
  assert.match(R.over.error, /TP_OUTSIDE_WINDOW/);
});
test('atleta pede correção do próprio registro, mas não resolve o pedido', () => {
  assert.deepEqual(R.corr, { ok: true });
  assert.equal(R.corr_self_resolve, 0);
});
