// Eventos do atleta (D110): o que o time marcou além do treino (competição, reunião, palestra, outro).
// Abas "Próximos" (com "Ciente", sem aceitar/recusar) e "Realizados" (o atleta escolhe se entra no currículo),
// mais o histórico das competições que o próprio atleta cadastrou no currículo, numa parte separada.
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { toast } from '@/components/toast';
import { Button, Chip, Loading, Notice, Screen, styles } from '@/components/ui';
import { cvKindLabel, monthLabel, useAthleteCv, type CvEntry } from '@/lib/cv';
import { acknowledgeConvocation, eventKind, eventPast, eventWhen, setEventInCv, useMyConvocations } from '@/lib/convocations';
import { toFriendlyError } from '@/lib/errors';
import { useMe } from '@/lib/me';
import { useTheme } from '@/lib/theme';

export default function Eventos() {
  const me = useMe();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const cv = useAthleteCv(me.athlete?.id);
  const convs = useMyConvocations(me.athlete?.id);
  const [tab, setTab] = useState<'proximos' | 'realizados'>('proximos');
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key);
    try { await fn(); await qc.invalidateQueries({ queryKey: ['my-convocations'] }); await qc.invalidateQueries({ queryKey: ['cv', me.athlete?.id] }); toast(ok); }
    catch (e) { toast(toFriendlyError(e).message, 'danger'); } finally { setBusy(null); }
  };
  if (!me.athlete) return <Screen><Notice tone="info" text="Os eventos aparecem para quem tem cadastro de atleta." /></Screen>;
  if (convs.isLoading) return <Loading />;
  const all = convs.data ?? [];
  const next = all.filter((c) => !eventPast(c)).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const past = all.filter((c) => eventPast(c));
  const cvComps = (cv.data?.entries ?? []).filter((e) => ['competicao', 'titulo', 'selecao'].includes(e.kind));
  const Label = ({ t }: { t: string }) => <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.textMuted }}>{t}</Text>;

  const EventCard = ({ c }: { c: (typeof all)[number] }) => {
    const k = eventKind(c.kind);
    const isPast = eventPast(c);
    const highlight = !isPast && !c.acknowledged_at;
    const fg = highlight ? colors.onPrimaryContainer : colors.textMuted;
    return (
      <View style={{ backgroundColor: highlight ? colors.primaryContainer : colors.surfaceContainer, borderRadius: 24, padding: 18, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name={k.icon} size={20} color={fg} />
          <Text style={{ color: fg, fontWeight: '700', fontSize: 13 }}>{k.label.toUpperCase()}{highlight ? ' · VOCÊ FOI CONVOCADO' : ''}</Text>
        </View>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 19 }}>{c.title}</Text>
        <Text style={{ color: colors.text, fontSize: 14 }}>{eventWhen(c)}{c.location ? ` · ${c.location}` : ''}</Text>
        {c.notes ? <Text style={{ color: colors.textMuted, fontSize: 14 }}>{c.notes}</Text> : null}
        {c.acknowledged_at ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={{ color: colors.text, fontWeight: '600' }}>Ciente desde {new Date(c.acknowledged_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</Text>
          </View>
        ) : isPast ? (
          <Text style={{ color: colors.textMuted }}>Sem ciência registrada.</Text>
        ) : (
          <Button title="Ciente" icon="checkmark-done" kind="accent" loading={busy === `ack-${c.id}`}
            onPress={() => run(`ack-${c.id}`, () => acknowledgeConvocation(c.id, me.athlete!.id), 'Ciência confirmada. O treinador já pode ver.')} />
        )}
        {isPast && (
          <View style={[styles.row, { justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 2 }]}>
            <Text style={{ color: colors.text, flex: 1 }}>Incluir no meu currículo</Text>
            <Switch accessibilityLabel={`Incluir ${c.title} no currículo`} value={Boolean(c.cv_entry_id)} disabled={busy === `cv-${c.id}`}
              onValueChange={(v) => run(`cv-${c.id}`, () => setEventInCv(c.id, me.athlete!.id, v), v ? 'Incluído no currículo.' : 'Retirado do currículo.')} />
          </View>
        )}
      </View>
    );
  };

  const CvList = ({ items }: { items: CvEntry[] }) => (
    <View style={{ backgroundColor: colors.surfaceContainer, borderRadius: 24, paddingHorizontal: 16 }}>
      {items.length === 0 && <Text style={{ color: colors.textMuted, paddingVertical: 14 }}>Nenhuma competição no currículo ainda.</Text>}
      {items.map((e, i) => (
        <View key={e.id} style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: i === items.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
          <Text style={{ width: 64, color: colors.textMuted, fontSize: 13 }}>{monthLabel(e.started_on)}</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{e.title}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{[cvKindLabel(e.kind), e.category, e.result, e.location].filter(Boolean).join(' · ')}</Text>
          </View>
          {e.verified && <Ionicons name="checkmark-circle" size={18} color={colors.success} accessibilityLabel="Confirmado pela entidade" />}
        </View>
      ))}
    </View>
  );

  return (
    <Screen>
      <View style={{ gap: 16, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
        <View style={styles.wrap}>
          <Chip label={`Próximos eventos (${next.length})`} selected={tab === 'proximos'} onPress={() => setTab('proximos')} />
          <Chip label={`Eventos realizados (${past.length})`} selected={tab === 'realizados'} onPress={() => setTab('realizados')} />
        </View>
        {tab === 'proximos' && (
          <View style={{ gap: 12 }}>
            {next.length === 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 20, backgroundColor: colors.tertiaryContainer }}>
                <Ionicons name="calendar-outline" size={22} color={colors.onTertiaryContainer} />
                <Text style={{ flex: 1, color: colors.onTertiaryContainer }}>Seus eventos com a equipe (competições, reuniões, palestras) aparecerão aqui. Ao receber um, confirme sua ciência.</Text>
              </View>
            )}
            {next.map((c) => <EventCard key={c.id} c={c} />)}
          </View>
        )}
        {tab === 'realizados' && (
          <View style={{ gap: 12 }}>
            <Label t="Eventos da equipe" />
            {past.length === 0 && <Text style={{ color: colors.textMuted }}>Nenhum evento realizado ainda.</Text>}
            {past.map((c) => <EventCard key={c.id} c={c} />)}
            <Label t="Histórico do seu currículo" />
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Competições que você cadastrou no currículo.</Text>
            <CvList items={cvComps} />
            <Button title="Adicionar competição no currículo" kind="outline" onPress={() => router.push('/curriculo')} />
          </View>
        )}
      </View>
    </Screen>
  );
}
