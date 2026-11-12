-- Check-in feito pelo navegador (site): fica marcado, porque o navegador não detecta GPS falso
-- nem identifica o aparelho com segurança (decisão D49).
create function app_private.flag_web_attendance() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.device_id like 'web:%' and not ('web_browser' = any (new.flags)) then
    new.flags := array_append(new.flags, 'web_browser');
  end if;
  return new;
end; $$;
create trigger attendance_flag_web before insert on public.attendance_records
  for each row execute function app_private.flag_web_attendance();
