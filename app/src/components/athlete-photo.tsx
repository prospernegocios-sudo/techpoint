// Foto do atleta no Perfil (mesma foto do currículo e da bolinha da conta no canto superior direito).
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { toast } from '@/components/toast';
import { cvImageUrls, useAthleteCv } from '@/lib/cv';
import { pickAndUploadCvImage, removeCvImage } from '@/lib/cv-media';
import { toFriendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

export function AthletePhoto({ athleteId, name, size = 96 }: { athleteId: string; name: string; size?: number }) {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const cv = useAthleteCv(athleteId);
  const path = cv.data?.profile?.photo_path ?? null;
  const url = useQuery({ queryKey: ['account-photo', path], enabled: Boolean(path), staleTime: 50 * 60_000, queryFn: async () => (await cvImageUrls(cv.data!)).photo });
  const [busy, setBusy] = useState(false);
  const pick = async () => {
    setBusy(true);
    try {
      const p = await pickAndUploadCvImage(athleteId, 'foto');
      if (!p) return;
      const { error } = await supabase.from('athlete_cv_profile').upsert({ athlete_id: athleteId, photo_path: p, updated_at: new Date().toISOString() });
      if (error) throw error;
      if (path) await removeCvImage(path);
      await qc.invalidateQueries({ queryKey: ['cv', athleteId] });
      await qc.invalidateQueries({ queryKey: ['cv-imgs'] });
      await qc.invalidateQueries({ queryKey: ['account-photo'] });
      toast('Foto salva.');
    } catch (e) { toast(toFriendlyError(e).message, 'danger'); } finally { setBusy(false); }
  };
  const initials = name.split(/\s+/).filter((w) => w && !w.startsWith('(')).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={url.data ? 'Trocar foto' : 'Adicionar foto'} onPress={pick} disabled={busy} style={{ alignItems: 'center', gap: 6 }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' }}>
        {url.data ? <Image source={{ uri: url.data }} style={{ width: size, height: size }} accessibilityLabel={`Foto de ${name}`} />
          : <Text style={{ color: colors.onPrimaryContainer, fontSize: size * 0.36, fontWeight: '700' }}>{initials}</Text>}
        {busy && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#FFFFFF" /></View>}
      </View>
      <View style={{ position: 'absolute', right: 0, top: size - 30, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface }}>
        <Ionicons name="camera" size={16} color={colors.onPrimary} />
      </View>
      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>{url.data ? 'Trocar foto' : 'Adicionar foto'}</Text>
    </Pressable>
  );
}
