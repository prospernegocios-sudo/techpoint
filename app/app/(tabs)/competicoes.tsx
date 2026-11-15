// Competições do atleta (D95): convocações do treinador com "Ciente da convocação" (auditoria, item 05; sem
// aceitar/recusar) e as competições do currículo (próximas e disputadas).
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { toast } from '@/components/toast';
import { Button, Loading, Notice, Screen } from '@/components/ui';
import { acknowledgeConvocation, useMyConvocations } from '@/lib/convocations';
import { toFriendlyError } from '@/lib/errors';
import { cvKindLabel, monthLabel, useAthleteCv, type CvEntry } from '@/lib/cv';
import { useMe } from '@/lib/me';
import { useTheme } from '@/lib/theme';

export default function Competicoes() {
  const me = useMe();
  const { colors } = useTheme();
  const cv = useAthleteCv(me.athlete?.id);
  const convs = useMyConvocations(me.athlete?.id);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const ack = async (id: string) => {
    setBusy(id);
    try { await acknowledgeConvocation(id, me.athlete!.id); await qc.invalidateQueries({ queryKey: ['my-convocations'] }); toast('Ciência confirmada. O treinador já pode ver.'); }
    catch (e) { toast(toFriendlyError(e).message, 'danger'); } finally { setBusy(null); }
  };
  if (!me.athlete) return <Screen><Notice tone="info" text="As competições aparecem para quem tem cadastro de atleta." /></Screen>;
  if (cv.isLoading) return <Loading />;
  const month = new Date(); month.setDate(1);
  const iso = month.toISOString().slice(0, 10);
  const comps = (cv.data?.entries ?? []).filter((e) => ['competicao', 'titulo', 'selecao'].includes(e.kind));
  const next = comps.filter((e) => e.started_on >= iso).sort((a, b) => a.started_on.localeCompare(b.started_on));
  const past = comps.filter((e) => e.started_on < iso);

  const List = ({ title, items, empty }: { title: string; items: CvEntry[]; empty: string }) => (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.textMuted }}>{title} ({items.length})</Text>
      <View style={{ backgroundColor: colors.surfaceContainer, borderRadius: 24, paddingHorizontal: 16 }}>
        {items.length === 0 && <Text style={{ color: colors.textMuted, paddingVertical: 14 }}>{empty}</Text>}
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
    </View>
  );

  return (
    <Screen>
      <View style={{ gap: 18, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.textMuted }}>Convocações ({convs.data?.length ?? 0})</Text>
          {convs.isLoading && <Loading />}
          {!convs.isLoading && (convs.data?.length ?? 0) === 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 20, backgroundColor: colors.tertiaryContainer }}>
              <Ionicons name="megaphone-outline" size={22} color={colors.onTertiaryContainer} />
              <Text style={{ flex: 1, color: colors.onTertiaryContainer }}>Suas convocações para competições aparecerão aqui. Ao receber uma convocação, confirme sua ciência.</Text>
            </View>
          )}
          {(convs.data ?? []).map((c) => {
            const day = (d: string) => d.split('-').reverse().join('/');
            return (
              <View key={c.id} style={{ backgroundColor: c.acknowledged_at ? colors.surfaceContainer : colors.primaryContainer, borderRadius: 24, padding: 18, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="megaphone" size={20} color={c.acknowledged_at ? colors.textMuted : colors.onPrimaryContainer} />
                  <Text style={{ color: c.acknowledged_at ? colors.textMuted : colors.onPrimaryContainer, fontWeight: '700', fontSize: 13 }}>{c.acknowledged_at ? 'CONVOCAÇÃO' : 'VOCÊ FOI CONVOCADO'}</Text>
                </View>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 19 }}>{c.title}</Text>
                <Text style={{ color: colors.text, fontSize: 14 }}>{day(c.starts_on)}{c.ends_on && c.ends_on !== c.starts_on ? ` a ${day(c.ends_on)}` : ''}{c.location ? ` · ${c.location}` : ''}</Text>
                {c.notes ? <Text style={{ color: colors.textMuted, fontSize: 14 }}>{c.notes}</Text> : null}
                {c.acknowledged_at ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text style={{ color: colors.text, fontWeight: '600' }}>Ciente desde {new Date(c.acknowledged_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</Text>
                  </View>
                ) : (
                  <Button title="Ciente da convocação" icon="checkmark-done" kind="accent" loading={busy === c.id} onPress={() => ack(c.id)} />
                )}
              </View>
            );
          })}
        </View>
        <List title="Próximas no currículo" items={next} empty="Nenhuma competição marcada." />
        <List title="Disputadas no currículo" items={past} empty="Nenhuma competição no currículo ainda." />
        <Button title="Adicionar competição no currículo" kind="outline" onPress={() => router.push('/curriculo')} />
      </View>
    </Screen>
  );
}
