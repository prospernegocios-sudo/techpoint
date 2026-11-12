-- Guarda das fotos de check-in/check-out: 24 meses (decisão D48 do dono do produto).
alter table public.organizations alter column photo_retention_months set default 24;
update public.organizations set photo_retention_months = 24 where photo_retention_months = 12;
