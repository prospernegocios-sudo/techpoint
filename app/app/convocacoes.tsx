// Eventos da equipe (D110): competição, reunião, palestra ou outro. O treinador convoca e acompanha quem deu
// ciência. Não há "aceitar/recusar": o atleta convocado participa e só confirma que está ciente.
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { DateField } from '@/components/date-field';
import { toast } from '@/components/toast';
import { Badge, Button, Card, Chip, Field, Loading, Notice, Screen, T, styles } from '@/components/ui';
import { EVENT_KINDS, eventKind, eventWhen, useOrgConvocations, type EventKind } from '@/lib/convocations';
import { toFriendlyError } from '@/lib/errors';
import { parseBrDate, toIsoDate } from '@/lib/format';
import { useMe } from '@/lib/me';
import { useTeams } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';


export default function Convocacoes() {
  const me = useMe();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const convs = useOrgConvocations(me.org?.id);
  const teams = useTeams(me.org?.id);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [f, setF] = useState({ title: '', location: '', from: '', to: '', time: '', notes: '' });
  const [kind, setKind] = useState<EventKind | null>(null);
  const [kindOpen, setKindOpen] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const roster = useQuery({
    queryKey: ['conv-roster', teamId], enabled: Boolean(teamId),
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('athlete_id, athletes(full_name)').eq('team_id', teamId!);
      const list = ((data ?? []) as unknown as { athlete_id: string; athletes: { full_name: string } | null }[]).map((x) => ({ id: x.athlete_id, name: x.athletes?.full_name ?? '' }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return list;
    },
  });

  // Ao escolher a equipe, todos vêm marcados; o treinador desmarca quem não vai.
  useEffect(() => { setPicked(new Set((roster.data ?? []).map((x) => x.id))); }, [roster.data]);

  if (!me.isStaff) return <Screen><Notice tone="danger" text="Apenas a equipe da entidade faz convocações." /></Screen>;

  const save = async () => {
    setErr(null);
    const a = parseBrDate(f.from), b = f.to ? parseBrDate(f.to) : null;
    if (!kind) return setErr('Escolha o tipo do evento.');
    if (f.title.trim().length < 3) return setErr('Informe o nome do evento.');
    const tm = f.time.trim();
    if (tm && !/^([01]\d|2[0-3]):[0-5]\d$/.test(tm)) return setErr('Horário no formato hh:mm (ex.: 19:00).');
    if (!a) return setErr('Informe a data de início (dd/mm/aaaa).');
    if (f.to && (!b || b < a)) return setErr('A data final precisa ser igual ou depois da inicial.');
    if (!teamId) return setErr('Escolha a equipe.');
    if (picked.size === 0) return setErr('Marque pelo menos um atleta.');
    setBusy(true);
    try {
      const { data, error } = await supabase.from('convocations').insert({
        org_id: me.org!.id, team_id: teamId, kind, start_time: tm || null, title: f.title.trim(), location: f.location.trim() || null,
        starts_on: toIsoDate(a), ends_on: b ? toIsoDate(b) : null, notes: f.notes.trim() || null, created_by: me.profile?.id,
      }).select('id').single();
      if (error) throw error;
      const { error: e2 } = await supabase.from('convocation_athletes').insert([...picked].map((id) => ({ convocation_id: data.id, athlete_id: id, org_id: me.org!.id })));
      if (e2) throw e2;
      await qc.invalidateQueries({ queryKey: ['org-convocations'] });
      setAdding(false); setF({ title: '', location: '', from: '', to: '', time: '', notes: '' }); setTeamId(null); setKind(null);
      toast('Evento enviado. Os atletas veem em Eventos.');
    } catch (e) { setErr(toFriendlyError(e).message); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Eventos da equipe' }} />
      {!adding && <Button title="Novo evento" icon="add" kind="accent" onPress={() => setAdding(true)} />}
      {adding && (
        <Card>
          <T variant="subtitle">Novo evento</T>
          {/* Tipo do evento: menu que abre as opções */}
          <View style={{ gap: 6 }}>
            <T variant="small" style={{ fontWeight: '600', marginLeft: 4 }}>Tipo do evento</T>
            <Pressable accessibilityRole="button" accessibilityLabel="Tipo do evento" accessibilityState={{ expanded: kindOpen }} onPress={() => setKindOpen(!kindOpen)}
              style={[styles.row, { minHeight: 56, borderWidth: 1, borderColor: colors.outline, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'space-between' }]}>
              <View style={[styles.row, { gap: 10 }]}>
                {kind && <Ionicons name={eventKind(kind).icon} size={20} color={colors.primary} />}
                <Text style={{ color: kind ? colors.text : colors.textMuted, fontSize: 16 }}>{kind ? eventKind(kind).label : 'Escolha o tipo'}</Text>
              </View>
              <Ionicons name={kindOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
            </Pressable>
            {kindOpen && (
              <View style={{ borderRadius: 16, backgroundColor: colors.surfaceContainerHigh, overflow: 'hidden' }}>
                {EVENT_KINDS.map((k) => (
                  <Pressable key={k.key} accessibilityRole="menuitem" onPress={() => { setKind(k.key); setKindOpen(false); }}
                    style={({ pressed }) => [styles.row, { minHeight: 48, paddingHorizontal: 16, gap: 12, backgroundColor: pressed || kind === k.key ? colors.primaryContainer : 'transparent' }]}>
                    <Ionicons name={k.icon} size={20} color={colors.text} />
                    <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{k.label}</Text>
                    {kind === k.key && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          <Field label="Nome do evento" value={f.title} onChangeText={(v) => setF({ ...f, title: v })} maxLength={120}
            placeholder={kind === 'reuniao' ? 'Ex.: Reunião de pais e atletas' : kind === 'palestra' ? 'Ex.: Palestra sobre nutrição' : 'Ex.: Taça Brasília'} />
          <Field label="Local (opcional)" value={f.location} onChangeText={(v) => setF({ ...f, location: v })} maxLength={160} placeholder="Ex.: Ginásio Nilson Nelson" />
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            <View style={{ flexGrow: 1, flexBasis: 220 }}><DateField label="Início" mode="date" value={f.from} onChange={(v) => setF({ ...f, from: v })} minimumDate={new Date()} /></View>
            <View style={{ flexGrow: 1, flexBasis: 220 }}><DateField label="Fim (opcional)" mode="date" value={f.to} onChange={(v) => setF({ ...f, to: v })} minimumDate={new Date()} /></View>
          </View>
          <DateField label="Horário (opcional)" mode="time" value={f.time} onChange={(v) => setF({ ...f, time: v })} />
          <Field label="Recado aos atletas (opcional)" value={f.notes} onChangeText={(v) => setF({ ...f, notes: v })} maxLength={1000} multiline placeholder="Horário de concentração, uniforme..." />
          <T variant="small" style={{ fontWeight: '700' }}>Equipe</T>
          <View style={styles.wrap}>{(teams.data ?? []).map((t) => <Chip key={t.id} label={t.name} selected={teamId === t.id} onPress={() => setTeamId(t.id)} />)}</View>
          {teamId && (roster.isLoading ? <Loading /> : (
            <View style={{ gap: 4 }}>
              <T variant="small" style={{ fontWeight: '700' }}>Atletas convocados ({picked.size} de {roster.data?.length ?? 0})</T>
              {(roster.data ?? []).map((a) => {
                const on = picked.has(a.id);
                return (
                  <Pressable key={a.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setPicked((s) => { const n = new Set(s); if (on) n.delete(a.id); else n.add(a.id); return n; })}
                    style={[styles.row, { minHeight: 40, gap: 10 }]}>
                    <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.primary : colors.textMuted} />
                    <T variant="body">{a.name}</T>
                  </Pressable>
                );
              })}
            </View>
          ))}
          {err && <Notice tone="danger" text={err} />}
          <Button title="Enviar evento" loading={busy} onPress={save} />
          <Button title="Cancelar" kind="ghost" onPress={() => { setAdding(false); setErr(null); }} />
        </Card>
      )}
      {convs.isLoading && <Loading />}
      {!convs.isLoading && (convs.data?.length ?? 0) === 0 && <Notice tone="info" text="Nenhum evento ainda. Toque em “Novo evento” para convocar atletas para uma competição, reunião ou palestra." />}
      {(convs.data ?? []).map((c) => {
        const list = [...c.convocation_athletes].sort((a, b) => (a.athletes?.full_name ?? '').localeCompare(b.athletes?.full_name ?? ''));
        const ok = list.filter((x) => x.acknowledged_at).length;
        const isOpen = open === c.id;
        return (
          <Card key={c.id} onPress={() => setOpen(isOpen ? null : c.id)}>
            <View style={[styles.row, { gap: 6 }]}>
              <Ionicons name={eventKind(c.kind).icon} size={16} color={colors.textMuted} />
              <T variant="small" style={{ fontWeight: '700' }}>{eventKind(c.kind).label.toUpperCase()}</T>
            </View>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <T variant="subtitle" style={{ flex: 1 }}>{c.title}</T>
              <Badge label={`${ok} de ${list.length} cientes`} tone={ok === list.length ? 'success' : 'warning'} />
            </View>
            <T variant="muted">{eventWhen(c)}{c.location ? ` · ${c.location}` : ''}</T>
            <T variant="small" color={colors.primary} style={{ fontWeight: '700' }}>{isOpen ? 'Ocultar atletas' : 'Ver quem deu ciência'}</T>
            {isOpen && list.map((x) => (
              <View key={x.athlete_id} style={[styles.row, { gap: 8, minHeight: 32 }]}>
                <Ionicons name={x.acknowledged_at ? 'checkmark-circle' : 'time-outline'} size={20} color={x.acknowledged_at ? colors.success : colors.warning} />
                <Text style={{ flex: 1, color: colors.text }}>{x.athletes?.full_name}</Text>
                <T variant="small">{x.acknowledged_at ? `Ciente em ${new Date(x.acknowledged_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : 'Aguardando ciência'}</T>
              </View>
            ))}
          </Card>
        );
      })}
    </Screen>
  );
}
