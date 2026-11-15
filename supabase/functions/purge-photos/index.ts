// Apaga as fotos de presença vencidas (D76): o banco decide quais (prazo da entidade, exceto projetos
// com guarda maior); aqui só removemos os arquivos e marcamos os registros. Roda 1x por dia (pg_cron).
// Sem login: chamar fora de hora só antecipa a mesma limpeza, que é idempotente.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Use POST', { status: 405 });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let purged = 0;
  for (let round = 0; round < 10; round++) {
    const { data, error } = await sb.rpc('purge_photos_next', { p_limit: 200 });
    if (error) return Response.json({ error: error.message, purged }, { status: 500 });
    const rows = (data ?? []) as { record_id: string; photo_path: string }[];
    if (rows.length === 0) break;
    const { error: rmErr } = await sb.storage.from('attendance-photos').remove(rows.map((r) => r.photo_path));
    if (rmErr) return Response.json({ error: rmErr.message, purged }, { status: 500 });
    const { data: n, error: mkErr } = await sb.rpc('purge_photos_mark', { p_record_ids: rows.map((r) => r.record_id) });
    if (mkErr) return Response.json({ error: mkErr.message, purged }, { status: 500 });
    purged += (n as number) ?? 0;
  }
  return Response.json({ purged });
});
