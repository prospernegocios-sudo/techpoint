-- Novo papel: administrador da entidade (decisão D54). Fica num arquivo próprio porque
-- um valor novo de enum só pode ser usado depois que esta transação termina.
alter type public.org_role add value if not exists 'admin' before 'manager';
