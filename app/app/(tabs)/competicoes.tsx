// Competições do atleta (D95): próximas e disputadas, a partir do currículo. Na Fase 4, as convocações do
// treinador (vou/não vou, autorização de viagem, logística) aparecem aqui também.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Button, Loading, Notice, Screen } from '@/components/ui';
import { cvKindLabel, monthLabel, useAthleteCv, type CvEntry } from '@/lib/cv';
import { useMe } from '@/lib/me';
import { useTheme } from '@/lib/theme';

export default function Competicoes() {
  const me = useMe();
  const { colors } = useTheme();
  const cv = useAthleteCv(me.athlete?.id);
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
      <View style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16 }}>
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
        <Pressable accessibilityRole="button" onPress={() => router.push('/curriculo')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <Ionicons name="megaphone-outline" size={22} color={colors.primary} />
          <Text style={{ flex: 1, color: colors.text }}>Convocações do treinador aparecem aqui em breve, com "vou / não vou" e autorização de viagem.</Text>
        </Pressable>
        <List title="Próximas" items={next} empty="Nenhuma competição marcada." />
        <List title="Disputadas" items={past} empty="Nenhuma competição no currículo ainda." />
        <Button title="Adicionar competição no currículo" kind="outline" onPress={() => router.push('/curriculo')} />
      </View>
    </Screen>
  );
}
