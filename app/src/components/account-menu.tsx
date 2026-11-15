// Foto da conta no canto superior direito e menu da conta no estilo Google/Gmail (D103):
// nome, e-mail, entidade e papel, troca de entidade/modo, "Meu perfil" e "Sair".
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useAthleteHeader } from '@/lib/athlete-header';
import { useAuth } from '@/lib/auth';
import { cvImageUrls, useAthleteCv } from '@/lib/cv';
import { modeLabels, roleLabels, useMe } from '@/lib/me';
import { useTheme } from '@/lib/theme';

const initials = (name: string) =>
  name.split(/\s+/).filter((w) => w && !w.startsWith('(')).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

/** Foto da conta: a do Google, senão a foto do currículo (atleta), senão as iniciais. */
function useAccountPhoto() {
  const { session } = useAuth();
  const me = useMe();
  const meta = (session?.user?.user_metadata ?? {}) as { avatar_url?: string; picture?: string };
  const google = meta.avatar_url ?? meta.picture ?? null;
  const cv = useAthleteCv(me.athlete?.id);
  const cvPhoto = useQuery({
    queryKey: ['account-photo', cv.data?.profile?.photo_path ?? null],
    enabled: Boolean(cv.data?.profile?.photo_path),
    staleTime: 50 * 60_000,
    queryFn: async () => (await cvImageUrls(cv.data!)).photo,
  });
  // Atleta: a foto que ele subiu no perfil vale mais que a do Google.
  return cvPhoto.data ?? google ?? null;
}

function Avatar({ size, name, photo }: { size: number; name: string; photo: string | null }) {
  const { colors } = useTheme();
  if (photo) return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityIgnoresInvertColors />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.onPrimary, fontWeight: '600', fontSize: size * 0.4 }}>{initials(name)}</Text>
    </View>
  );
}

export function AccountButton() {
  const { session, signOut } = useAuth();
  const me = useMe();
  const { colors } = useTheme();
  const photo = useAccountPhoto();
  const ath = useAthleteHeader(me.mode === 'athlete' ? me.athlete?.id : undefined);
  const [open, setOpen] = useState(false);
  if (!session) return null;
  const name = me.profile?.full_name ?? session.user.email ?? 'Minha conta';
  const email = me.profile?.email ?? session.user.email ?? '';
  const role = me.mode === 'athlete' ? (ath.data?.teams.length ? ath.data.teams.join(', ') : 'Atleta') : me.mode === 'guardian' ? 'Responsável' : me.role ? roleLabels[me.role] : null;
  const go = (fn: () => void) => () => { setOpen(false); fn(); };

  const Row = ({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) => (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48, paddingHorizontal: 18,
        backgroundColor: pressed || hovered ? colors.surfaceContainerHigh : 'transparent',
      })}>
      <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.textMuted} />
      <Text style={{ color: danger ? colors.danger : colors.text, fontSize: 15, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`Conta: ${name}. Abrir menu da conta`} onPress={() => setOpen(true)}
        style={({ pressed }) => ({ marginRight: 12, padding: 4, borderRadius: 999, opacity: pressed ? 0.8 : 1 })}>
        <Avatar size={36} name={name} photo={photo} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Fechar menu da conta" onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' }}>
          <Pressable onPress={() => {}} accessibilityViewIsModal
            style={{ position: 'absolute', top: 56, right: 10, width: 360, maxWidth: '94%', maxHeight: '88%', borderRadius: 28, overflow: 'hidden',
              backgroundColor: colors.surfaceContainer, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 16 }}>
            <ScrollView contentContainerStyle={{ paddingBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12 }}>
                <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', color: colors.text, fontSize: 14, fontWeight: '500', marginLeft: 36 }}>{email}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={() => setOpen(false)} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </Pressable>
              </View>
              <View style={{ alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16 }}>
                <Avatar size={80} name={name} photo={photo} />
                <Text style={{ color: colors.text, fontSize: 21, fontWeight: '500', textAlign: 'center' }}>Olá, {name.split(' ')[0]}!</Text>
                {me.org && <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>{me.org.name}{role ? ` · ${role}` : ''}{me.asGuest ? ' (gestor master)' : ''}</Text>}
                <Pressable accessibilityRole="button" onPress={go(() => router.push('/perfil'))}
                  style={({ pressed }) => ({ marginTop: 6, minHeight: 44, paddingHorizontal: 22, borderRadius: 999, borderWidth: 1, borderColor: colors.outline,
                    alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
                  <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>{me.mode === 'athlete' ? 'Gerenciar o meu perfil de atleta' : 'Gerenciar meus dados'}</Text>
                </Pressable>
              </View>

              <View style={{ marginHorizontal: 8, borderRadius: 20, backgroundColor: colors.surface, overflow: 'hidden', paddingVertical: 6 }}>
                {me.modes.length > 1 && (
                  <View style={{ paddingHorizontal: 18, paddingVertical: 8, gap: 8 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>USAR O APP COMO</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {me.modes.map((m) => {
                        const sel = m === me.mode;
                        return (
                          <Pressable key={m} accessibilityRole="button" accessibilityState={{ selected: sel }} onPress={go(() => me.setMode(m))}
                            style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: 8, justifyContent: 'center', borderWidth: 1,
                              borderColor: sel ? 'transparent' : colors.outline, backgroundColor: sel ? colors.primaryContainer : 'transparent' }}>
                            <Text style={{ color: sel ? colors.onPrimaryContainer : colors.text, fontWeight: '600', fontSize: 13 }}>{modeLabels[m]}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
                {me.orgs.length > 1 && (
                  <View style={{ paddingVertical: 4 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', paddingHorizontal: 18, paddingVertical: 6 }}>ENTIDADES</Text>
                    {me.orgs.slice(0, 8).map((o) => (
                      <Pressable key={o.id} accessibilityRole="button" accessibilityState={{ selected: o.id === me.org?.id }} onPress={go(() => me.setOrgId(o.id))}
                        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 46, paddingHorizontal: 18, backgroundColor: pressed ? colors.surfaceContainerHigh : 'transparent' })}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: o.theme_primary ?? colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{o.name.slice(0, 2).toUpperCase()}</Text>
                        </View>
                        <Text style={{ flex: 1, color: colors.text, fontSize: 15 }}>{o.name}</Text>
                        {o.id === me.org?.id && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                      </Pressable>
                    ))}
                  </View>
                )}
 {(me.isManager || me.isPlatformAdmin || me.hasModule('investimentos')) && me.mode === 'team' && <Row icon="business-outline" label="Gestão do clube" onPress={go(() => router.push('/gestao'))} />}
                {me.isPlatformAdmin && <Row icon="shield-outline" label="Painel do gestor master" onPress={go(() => router.push('/entidade/analise'))} />}
                <Row icon="log-out-outline" label="Sair da conta" danger onPress={go(() => { signOut(); })} />
              </View>

              <Pressable accessibilityRole="link" onPress={go(() => router.push('/privacidade'))} style={{ alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>Política de privacidade</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
