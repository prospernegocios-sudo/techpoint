// Página pública do currículo (link gerado pelo atleta ou responsável). Sem CPF, endereço, documentos ou nascimento.
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Badge, Card, Loading, Notice, Screen, T, styles } from '@/components/ui';
import { cvImageUrls, cvKindIcon, cvKindLabel, handLabel, monthLabel, sportTime, type Cv } from '@/lib/cv';
import { Image } from 'react-native';
import { RichText } from '@/components/rich-text';
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
  const imgs = useQuery({ queryKey: ['public-cv-imgs', token], enabled: Boolean(q.data), queryFn: () => cvImageUrls(q.data!) });
  if (q.isLoading) return <><Stack.Screen options={{ title: 'Currículo esportivo' }} /><Loading /></>;
  const c = q.data;
  if (!c) return <Screen><Stack.Screen options={{ title: 'Currículo esportivo' }} /><Notice tone="warning" text="Este link de currículo expirou ou foi cancelado." /></Screen>;
  const body = c.body ? [c.body.height_cm ? `${c.body.height_cm} cm` : '', c.body.weight_kg ? `${String(c.body.weight_kg).replace('.', ',')} kg` : '', handLabel(c.body.dominant_hand)].filter(Boolean).join(' · ') : '';
  return (
    <Screen>
      <Stack.Screen options={{ title: `Currículo · ${c.full_name}` }} />
      <Card style={{ backgroundColor: '#1E2B4A' }}>
        {imgs.data?.photo ? <Image source={{ uri: imgs.data.photo }} style={{ width: 120, height: 150, borderRadius: 12, alignSelf: 'center', borderWidth: 4, borderColor: '#fff' }} accessibilityLabel={`Foto de ${c.full_name}`} /> : null}
        <T variant="title" color="#FFFFFF" style={{ textAlign: 'center' }}>{c.full_name}</T>
        <T variant="body" color="#E9C46A" style={{ textAlign: 'center', fontWeight: '700' }}>{c.profile?.headline || [c.modality, c.position].filter(Boolean).join(' · ')}</T>
        <T variant="small" color="#EEF1F7" style={{ textAlign: 'center' }}>{[`${c.age} anos`, c.org ? `atualmente em ${c.org}` : ''].filter(Boolean).join(' · ')}</T>
        {body ? <T variant="small" color={colors.onPrimary}>{body}</T> : null}
      </Card>
      <View style={styles.wrap}>
        {c.sport_started_on && <Card style={{ flexGrow: 1, flexBasis: 150 }}><T variant="subtitle">{sportTime(c.sport_started_on)}</T><T variant="small">no esporte, desde {monthLabel(c.sport_started_on)}</T></Card>}
        {c.attendance_12m.pct != null && <Card style={{ flexGrow: 1, flexBasis: 150 }}><T variant="subtitle">{String(c.attendance_12m.pct).replace('.', ',')}%</T><T variant="small">assiduidade nos treinos (12 meses, com GPS e foto)</T></Card>}
      </View>
      {c.profile?.about && <Card><T variant="subtitle">Sobre mim</T><RichText text={c.profile.about} align={c.profile.about_align ?? 'justify'} /></Card>}
      {(c.profile?.goals?.length ?? 0) > 0 && <Card><T variant="subtitle">Metas</T>{c.profile!.goals.map((g, i) => <T key={i} variant="body">{(c.profile!.goals_done ?? []).includes(g) ? '✅' : '○'} {g}</T>)}</Card>}
      {(c.trainings_total ?? 0) > 0 && <Card><T variant="subtitle">{c.trainings_total} treinos registrados</T><T variant="small">com GPS, foto e hora do servidor</T></Card>}
      {c.teams.length > 0 && <Card><T variant="subtitle">Equipes</T>{c.teams.map((t, i) => <T key={i} variant="body">• {t.name}{t.category ? ` (${t.category})` : ''} · desde {monthLabel(t.since)}</T>)}</Card>}
      <Card>
        <T variant="subtitle">Trajetória</T>
        {c.entries.length === 0 && <T variant="muted">Nenhum item cadastrado.</T>}
        {c.entries.map((e) => (
          <View key={e.id} style={{ gap: 4, paddingVertical: 8, borderLeftWidth: 3, borderLeftColor: colors.border, paddingLeft: 10 }}>
            <T variant="small" color={colors.primary}>{monthLabel(e.started_on)}{e.ended_on ? ` – ${monthLabel(e.ended_on)}` : ''} · {cvKindIcon(e.kind)} {cvKindLabel(e.kind)}</T>
            <T variant="body" style={{ fontWeight: '700' }}>{e.title}</T>
            {(e.institution || e.category || e.location) && <T variant="small">{[e.institution, e.category, e.location].filter(Boolean).join(' · ')}</T>}
            {e.result && <T variant="small" style={{ fontWeight: '700' }}>Conquista: {e.result}</T>}
            {e.description && <T variant="small">{e.description}</T>}
            {e.verified && <Badge label={`✓ Confirmado por ${e.verified_by_org ?? 'entidade'}`} tone="success" />}
          </View>
        ))}
      </Card>
      {(imgs.data?.gallery.length ?? 0) > 0 && (
        <Card><T variant="subtitle">Fotos</T><View style={styles.wrap}>{imgs.data!.gallery.map((u, i) => <Image key={u} source={{ uri: u }} style={{ width: 160, height: 120, borderRadius: 8 }} accessibilityLabel={`Foto ${i + 1}`} />)}</View></Card>
      )}
      {(c.profile?.contact_phone || c.profile?.contact_email || c.profile?.instagram) && (
        <Card><T variant="subtitle">Contato</T>{[c.profile?.contact_phone, c.profile?.contact_email, c.profile?.instagram, c.profile?.city].filter(Boolean).map((x, i) => <T key={i} variant="body">{x}</T>)}</Card>
      )}
      {(c.profile?.references?.length ?? 0) > 0 && (
        <Card><T variant="subtitle">Referências</T>{c.profile!.references.map((r, i) => <T key={i} variant="body">{r.name}{r.role ? ` · ${r.role}` : ''}{r.phone ? ` · ${r.phone}` : ''}</T>)}</Card>
      )}
      <T variant="small" style={{ textAlign: 'center' }}>Currículo esportivo · Feito com TechPoint</T>
    </Screen>
  );
}
