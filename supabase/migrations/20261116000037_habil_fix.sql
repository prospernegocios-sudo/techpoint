-- "Não se aplica" exige motivo: o campo vazio passava pela regra anterior.
alter table public.org_habil_docs drop constraint org_habil_docs_check3;
alter table public.org_habil_docs add constraint org_habil_docs_na_note check (status <> 'nao_aplica' or coalesce(char_length(trim(note)), 0) >= 3);
