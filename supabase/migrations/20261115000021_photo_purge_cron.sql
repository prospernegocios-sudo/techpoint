-- Agenda diária (03:17 em Brasília = 06:17 UTC) da limpeza das fotos vencidas (D76).
create extension if not exists pg_cron;
select cron.schedule(
  'purge-photos-daily',
  '17 6 * * *',
  $$select net.http_post(
      url := 'https://qdilebgnpqajlqhkzbie.supabase.co/functions/v1/purge-photos',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    )$$
);
