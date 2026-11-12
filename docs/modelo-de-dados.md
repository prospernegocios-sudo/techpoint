# Modelo de dados — TechPoint

Banco: PostgreSQL (Supabase). Todas as tabelas com dados de organização têm `org_id`
e são protegidas por Row Level Security (RLS): cada pessoa só enxerga o que o seu papel
naquela organização permite.

## Papéis (`role` em `memberships`)

`athlete` (atleta) · `guardian` (responsável) · `coach` (treinador) · `manager` (gestor).
O administrador da plataforma é marcado em `profiles.is_platform_admin`.

## Tabelas

### Organização
- **organizations** — id, name, slug, photo_retention_months (padrão 12), checkin_before_min (30), checkin_after_min (30), checkout_after_min (60), offline_max_hours (24), created_at
- **memberships** — org_id, profile_id, role, active, created_at. Uma pessoa pode ter vários papéis em várias organizações
- **invites** — org_id, code, role, team_id (opcional), athlete_id (opcional), created_by, expires_at, used_at, used_by

### Pessoas
- **profiles** — id (= usuário de login), full_name, email, avatar_path, is_platform_admin, created_at
- **athletes** — org_id, profile_id (opcional: atleta pode não ter conta), full_name, birth_date, avatar_path, status (pending_consent, active, inactive), created_at
- **guardianships** — guardian_profile_id, athlete_id, relationship (pai, mãe, outro), is_legal_guardian
- **athlete_documents** — athlete_id, type (atestado médico, outro), file_path, valid_until, uploaded_by

### LGPD
- **legal_documents** — kind (termos, privacidade, consentimento), version, content, published_at
- **consents** — athlete_id, granted_by (perfil), legal_document_id (versão), purpose, granted_at, revoked_at, device_info
- **deletion_requests** — requested_by, athlete_id/profile_id, status, requested_at, completed_at
- **audit_log** — actor_id, org_id, action (viu, criou, alterou, excluiu), table_name, record_id, details, at

### Estrutura esportiva
- **venues** — org_id, name, address, latitude, longitude, radius_m (padrão 150)
- **sports** — org_id (nulo = global), name, evaluation_criteria (lista), stat_fields (lista de campos)
- **teams** — org_id, sport_id, name, category (ex.: Sub 15, Sub 17), season
- **team_members** — team_id, athlete_id, jersey_number, position
- **team_staff** — team_id, profile_id, role (head_coach, assistant)

### Agenda
- **event_series** — org_id, team_id, venue_id, type, weekdays, start_time, duration_min, starts_on, ends_on. Gera os eventos
- **events** — org_id, team_id, venue_id, series_id (opcional), type (training, match), title, opponent, starts_at, ends_at, status (scheduled, canceled)

### Presença (coração do app)
- **attendance_records** — um registro por ação:
  - event_id, athlete_id, org_id, kind (check_in, check_out)
  - server_at (hora do servidor), client_at (hora do aparelho), synced_offline (bool)
  - latitude, longitude, accuracy_m, distance_m (calculada no servidor)
  - photo_path, photo_sha256
  - source (app, manual), manual_reason, recorded_by
  - status (valid, pending, rejected), justification, reviewed_by, reviewed_at
  - device_id, is_mocked_location, flags (lista de sinais de suspeita)
- Visão **attendance_summary**: junta check-in e check-out por atleta e evento

### Jogo e desempenho
- **call_ups** — event_id, athlete_id, status (starter, reserve, not_called), reason, response (pending, confirmed, declined), responded_at
- **evaluations** — athlete_id, evaluator_id, evaluated_on, comment; **evaluation_scores** — evaluation_id, criterion, score
- **match_stats** — event_id, athlete_id, stats (campos flexíveis por esporte)
- **athlete_milestones** — athlete_id, kind (título, observação), title, description, happened_on

### Avisos
- **push_tokens** — profile_id, token, platform
- **notifications** — profile_id, type, title, body, data, sent_at, read_at
