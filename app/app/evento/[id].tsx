// Lista de presença de um treino (gestor/treinador): quem chegou e saiu, fotos,
// sinais de suspeita, aprovação de pendências e presença manual.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Modal, Pressable, View } from 'react-native';
import { Badge, Button, Card, Chip, Field, Loading, Notice, Screen, T, styles } from '@/components/ui';
import { flagLabels, toFriendlyError } from '@/lib/errors';
import { formatDay, formatTime } from '@/lib/format';
import { formatDistance } from '@/lib/geo';
import { useMe } from '@/lib/me';
import { signedPhotoUrl, useEvent, useEventRoster, type AttendanceRow } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

function RecordLine({ rec, title, onPhoto, onReview, allowReject }: {
  rec?: AttendanceRow; title: string; onPhoto: (p: string) => void; onReview: (r: AttendanceRow, ok: boolean) => void; allowReject?: boolean;
}) {
  const { colors } = useTheme();
  if (!rec) return <T variant="small">{title}: —</T>;
  const tone = rec.status === 'valid' ? 'success' : rec.status === 'pending' ? 'warning' : 'danger';
  const statusLabel = { valid: 'Válido', pending: 'Pendente', rejected: 'Rejeitado' }[rec.status];
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.wrap}>
        <T variant="body">{title}: <T variant="body" style={{ fontWeight: '700' }}>{formatTime(rec.server_at)}</T></T>
        <Badge label={statusLabel} tone={tone} />
        {rec.distance_m != null && <Badge label={formatDistance(rec.distance_m)} />}
      </View>
      {rec.flags.length > 0 && (
        <View style={styles.wrap}>
          {rec.flags.map((f) => <Badge key={f} label={flagLabels[f] ?? f} tone={f === 'manual' || f === 'offline_sync' ? 'muted' : f === 'late' ? 'warning' : 'danger'} />)}
        </View>
      )}
      {rec.justification && <T variant="small">Justificativa: “{rec.justification}”</T>}
      {rec.manual_reason && <T variant="small">Motivo (manual): “{rec.manual_reason}”</T>}
      <View style={styles.wrap}>
        {rec.photo_path && (
          <Pressable accessibilityRole="button" onPress={() => onPhoto(rec.photo_path!)} style={{ paddingVertical: 8 }}>
            <T variant="small" color={colors.primary} style={{ fontWeight: '700' }}>Ver foto</T>
          </Pressable>
        )}
      </View>
      {rec.status === 'valid' && allowReject && <Button title={`Recusar ${title.toLowerCase()}`} kind="danger" onPress={() => onReview(rec, false)} />}
      {rec.status === 'pending' && (
        <View style={[styles.row]}>
          <Button title="Aprovar" style={{ flex: 1 }} onPress={() => onReview(rec, true)} />
          <Button title="Rejeitar" kind="danger" style={{ flex: 1 }} onPress={() => onReview(rec, false)} />
        </View>
      )}
    </View>
  );
}

export default function EventRosterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const me = useMe();
  const qc = useQueryClient();
  const event = useEvent(id);
  const roster = useEventRoster(event.data);
  const [photo, setPhoto] = useState<string | null>(null);
  const [manual, setManual] = useState<{ athleteId: string; name: string; kind: 'check_in' | 'check_out' } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const corrections = useQuery({
    queryKey: ['corrections', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await supabase.from('attendance_correction_requests')
        .select('id, athlete_id, record_id, reason, created_at, attendance_records!inner(event_id)')
        .eq('status', 'open').eq('attendance_records.event_id', id!);
      return (data ?? []) as unknown as { id: string; athlete_id: string; reason: string }[];
    },
  });
  const resolveCorrection = async (cid: string) => {
    await supabase.from('attendance_correction_requests').update({ status: 'resolved', resolved_by: me.profile?.id, resolved_at: new Date().toISOString() }).eq('id', cid);
    corrections.refetch();
  };
  const [filter, setFilter] = useState<'all' | 'pending' | 'alert' | 'absent'>('all');
  const [error, setError] = useState<string | null>(null);

  if (!me.isStaff) return <Screen><Notice tone="danger" text="Apenas gestor ou treinador podem ver a lista de presença." /></Screen>;
  if (event.isLoading || roster.isLoading) return <Loading />;
  if (event.error || !event.data) return <Screen><Notice tone="danger" text="Treino não encontrado ou sem internet." /></Screen>;

  const ev = event.data;
  const rows = roster.data ?? [];
  const present = rows.filter((r) => r.checkIn && r.checkIn.status === 'valid').length;
  const pending = rows.filter((r) => r.checkIn?.status === 'pending' || r.checkOut?.status === 'pending').length;
  const isPending = (r: (typeof rows)[number]) => r.checkIn?.status === 'pending' || r.checkOut?.status === 'pending';
  const hasAlert = (r: (typeof rows)[number]) => [r.checkIn, r.checkOut].some((x) => x?.flags.some((f) => !['manual', 'offline_sync', 'late'].includes(f)));
  const isAbsent = (r: (typeof rows)[number]) => !r.checkIn || r.checkIn.status === 'rejected';
  const suspicious = rows.filter(hasAlert).length;
  const absent = rows.filter(isAbsent).length;
  // Pendências primeiro, depois alertas, depois o resto (achado de UX nº 7).
  const shown = rows
    .filter((r) => filter === 'all' || (filter === 'pending' && isPending(r)) || (filter === 'alert' && hasAlert(r)) || (filter === 'absent' && isAbsent(r)))
    .sort((a, b) => Number(isPending(b)) - Number(isPending(a)) || Number(hasAlert(b)) - Number(hasAlert(a)));

  const openPhoto = async (path: string) => {
    const url = await signedPhotoUrl(path);
    if (url) setPhoto(url);
    else Alert.alert('Foto indisponível', 'Não foi possível abrir a foto agora. Verifique a internet.');
  };

  const review = (rec: AttendanceRow, ok: boolean) => {
    Alert.alert(ok ? 'Aprovar registro?' : 'Rejeitar registro?', ok ? 'O registro passará a contar como presença.' : 'O registro deixará de contar como presença.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: ok ? 'Aprovar' : 'Rejeitar',
        style: ok ? 'default' : 'destructive',
        onPress: async () => {
          const { error: e } = await supabase.rpc('review_attendance', { p_record_id: rec.id, p_approve: ok, p_note: null });
          if (e) Alert.alert('Não foi possível', toFriendlyError(e).message);
          qc.invalidateQueries({ queryKey: ['roster', ev.id] });
        },
      },
    ]);
  };

  const saveManual = async () => {
    if (!manual) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc('record_manual_attendance', {
      p_event_id: ev.id, p_athlete_id: manual.athleteId, p_kind: manual.kind, p_reason: reason,
    });
    setBusy(false);
    if (e) return setError(toFriendlyError(e).message);
    setManual(null);
    setReason('');
    qc.invalidateQueries({ queryKey: ['roster', ev.id] });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Lista de presença' }} />
      <Card>
        <T variant="subtitle">{ev.teams?.name}</T>
        <T variant="muted">{formatDay(ev.starts_at)} · {formatTime(ev.starts_at)}–{formatTime(ev.ends_at)} · {ev.venues?.name}</T>
        <View style={styles.wrap}>
          <Badge label={`${present}/${rows.length} presentes`} tone="success" />
          {pending > 0 && <Badge label={`${pending} pendente(s)`} tone="warning" />}
          {suspicious > 0 && <Badge label={`${suspicious} com alerta`} tone="danger" />}
        </View>
      </Card>
      {roster.error && <Notice tone="danger" text="Não foi possível atualizar a lista. Verifique a internet." />}
      <View style={styles.wrap}>
        <Chip label={`Todos (${rows.length})`} selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label={`Pendentes (${pending})`} selected={filter === 'pending'} onPress={() => setFilter('pending')} />
        <Chip label={`Com alerta (${suspicious})`} selected={filter === 'alert'} onPress={() => setFilter('alert')} />
        <Chip label={`Ausentes (${absent})`} selected={filter === 'absent'} onPress={() => setFilter('absent')} />
      </View>
      {shown.length === 0 && <T variant="muted">Ninguém nesta situação.</T>}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      {shown.map((r) => (
        <Card key={r.athlete.id} style={{ flexGrow: 1, flexBasis: 320 }}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <T variant="subtitle" style={{ flex: 1 }}>{r.jersey != null ? `#${r.jersey} ` : ''}{r.athlete.full_name}</T>
            {!r.athlete.profile_id && <Badge label="Sem conta" />}
          </View>
          {(corrections.data ?? []).filter((c) => c.athlete_id === r.athlete.id).map((c) => (
            <View key={c.id} style={{ gap: 6 }}>
              <Notice tone="warning" text={`Correção pedida pelo atleta: “${c.reason}”. Se for o caso, recuse o registro abaixo ou lance a presença manual.`} />
              <Button title="Marcar pedido como resolvido" kind="outline" onPress={() => resolveCorrection(c.id)} />
            </View>
          ))}
          <RecordLine rec={r.checkIn} title="Chegada" onPhoto={openPhoto} onReview={review} allowReject={(corrections.data ?? []).some((c) => c.athlete_id === r.athlete.id)} />
          <RecordLine rec={r.checkOut} title="Saída" onPhoto={openPhoto} onReview={review} allowReject={(corrections.data ?? []).some((c) => c.athlete_id === r.athlete.id)} />
          <View style={styles.wrap}>
            {(!r.checkIn || r.checkIn.status === 'rejected') && (
              <Button title="Presença manual" kind="outline" onPress={() => setManual({ athleteId: r.athlete.id, name: r.athlete.full_name, kind: 'check_in' })} />
            )}
            {r.checkIn && r.checkIn.status !== 'rejected' && (!r.checkOut || r.checkOut.status === 'rejected') && (
              <Button title="Saída manual" kind="outline" onPress={() => setManual({ athleteId: r.athlete.id, name: r.athlete.full_name, kind: 'check_out' })} />
            )}
          </View>
        </Card>
      ))}
      </View>

      <Modal visible={Boolean(photo)} transparent animationType="fade" onRequestClose={() => setPhoto(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 16 }} onPress={() => setPhoto(null)}>
          {photo && <Image source={{ uri: photo }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 16 }} accessibilityLabel="Foto do registro" />}
          <T variant="body" color="#FFF" style={{ textAlign: 'center', marginTop: 12 }}>Toque para fechar</T>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(manual)} transparent animationType="slide" onRequestClose={() => setManual(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: colors.surface, padding: 16, gap: 12, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <T variant="subtitle">{manual?.kind === 'check_in' ? 'Presença manual' : 'Saída manual'}: {manual?.name}</T>
            <T variant="small">O registro fica marcado como "manual", com seu nome e o motivo, para auditoria.</T>
            {error && <Notice tone="danger" text={error} />}
            <Field label="Motivo" placeholder="Ex.: atleta sem celular" value={reason} onChangeText={setReason} maxLength={200} />
            <Button title="Registrar" loading={busy} disabled={reason.trim().length < 3} onPress={saveManual} />
            <Button title="Cancelar" kind="ghost" onPress={() => { setManual(null); setError(null); }} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
