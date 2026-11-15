// Página pública do currículo (link gerado pelo atleta ou responsável). Sem CPF, endereço, documentos ou nascimento.
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Badge, Card, Loading, Notice, Screen, T, styles } from '@/components/ui';
import { cvKindIcon, cvKindLabel, handLabel, monthLabel, sportTime, type Cv } from '@/lib/cv';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

export default function CvPublico() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { colors } = useTheme();
  const q = useQuery({
    queryKey: ['public-cv', token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('public_cv', { p_token: token! });
      if (error) throw error;
      return data as Cv | null;
    },
  });
  if (q.isLoading) return <Loading />;
  const c = q.data;
  if (!c) return <Screen><Notice tone="warning" text="Este link de currículo expirou ou foi cancelado." /></Screen>;
  const body = c.body ? [c.body.height_cm ? `${c.body.height_cm} cm` : '', c.body.weight_kg ? `${String(c.body.weight_kg).replace('.', ',')} kg` : '', handLabel(c.body.dominant_hand)].filter(Boolean).join(' · ') : '';
  return (
    <Screen>
      <Stack.Screen options={{ title: `Currículo · ${c.full_name}` }} />
      <Card style={{ backgroundColor: colors.primary }}>
        <T variant="title" color={colors.onPrimary}>{c.full_name}</T>
        <T variant="body" color={colors.onPrimary}>{[c.modality, c.position, `${c.age} anos`, c.org].filter(Boolean).join(' · ')}</T>
        {body ? <T variant="small" color={colors.onPrimary}>{body}</T> : null}
      </Card>
      <View style={styles.wrap}>
        {c.sport_started_on && <Card style={{ flexGrow: 1, flexBasis: 150 }}><T variant="subtitle">{sportTime(c.sport_started_on)}</T><T variant="small">no esporte, desde {monthLabel(c.sport_started_on)}</T></Card>}
        {c.attendance_12m.pct != null && <Card style={{ flexGrow: 1, flexBasis: 150 }}><T variant="subtitle">{String(c.attendance_12m.pct).replace('.', ',')}%</T><T variant="small">assiduidade nos treinos (12 meses, com GPS e foto)</T></Card>}
      </View>
      {c.teams.length > 0 && <Card><T variant="subtitle">Equipes</T>{c.teams.map((t, i) => <T key={i} variant="body">• {t.name}{t.category ? ` (${t.category})` : ''} · desde {monthLabel(t.since)}</T>)}</Card>}
      <Card>
        <T variant="subtitle">Trajetória</T>
        {c.entries.length === 0 && <T variant="muted">Nenhum item cadastrado.</T>}
        {c.entries.map((e) => (
          <View key={e.id} style={{ gap: 4, paddingVertical: 8, borderLeftWidth: 3, borderLeftColor: colors.border, paddingLeft: 10 }}>
            <T variant="small" color={colors.primary}>{monthLabel(e.started_on)}{e.ended_on ? ` – ${monthLabel(e.ended_on)}` : ''} · {cvKindIcon(e.kind)} {cvKindLabel(e.kind)}</T>
            <T variant="body" style={{ fontWeight: '700' }}>{e.title}</T>
            {(e.institution || e.category || e.location) && <T variant="small">{[e.institution, e.category, e.location].filter(Boolean).join(' · ')}</T>}
            {e.description && <T variant="small">{e.description}</T>}
            {e.verified && <Badge label={`✓ Confirmado por ${e.verified_by_org ?? 'entidade'}`} tone="success" />}
          </View>
        ))}
      </Card>
      <T variant="small" style={{ textAlign: 'center' }}>Currículo esportivo · TechPoint</T>
    </Screen>
  );
}
