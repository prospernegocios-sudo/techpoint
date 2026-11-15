// Porta de entrada da entidade (white label): techpoint.app.br/dfvolei mostra a marca do DF Vôlei.
// Usada pela rota /[slug] e pela página de "não encontrado" (alguns servidores não entregam /[slug]).
import { useQuery } from '@tanstack/react-query';
import { Redirect, Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { Image, Text, View } from 'react-native';
import { Button, Loading, Notice, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { fetchBrand, saveBrand } from '@/lib/brand';
import { useMe } from '@/lib/me';
import { useTheme } from '@/lib/theme';

export function BrandEntry({ slug }: { slug: string }) {
  const { session } = useAuth();
  const me = useMe();
  const { colors, setClubColors } = useTheme();
  const q = useQuery({ queryKey: ['brand', slug], queryFn: () => fetchBrand(slug!) });
  const b = q.data;
  useEffect(() => {
    if (!b) return;
    saveBrand(b);
    me.setOrgId(b.id);
    if (b.primary && b.accent) setClubColors({ primary: b.primary, accent: b.accent });
  }, [b?.id]);
  if (q.isLoading) return <Loading />;
  if (!b) return <Screen><Stack.Screen options={{ title: 'Não encontrado' }} /><Notice tone="warning" text="Página não encontrada. Confira o link que você recebeu." /><Button title="Ir para o início" kind="outline" onPress={() => router.replace('/')} /></Screen>;
  if (session) return <Redirect href="/(tabs)" />;
  return (
    <Screen style={{ justifyContent: 'center' }}>
      <Stack.Screen options={{ headerShown: false, title: b.name }} />
      <View style={{ alignItems: 'center', gap: 18, paddingVertical: 32 }}>
        {b.logo_url
          ? <Image source={{ uri: b.logo_url }} style={{ width: 220, height: 220, maxWidth: '70%' }} resizeMode="contain" accessibilityLabel={`Logo ${b.name}`} />
          : <View style={{ width: 180, height: 180, borderRadius: 48, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.onPrimary, fontSize: 64, fontWeight: '700' }}>{b.name.slice(0, 2).toUpperCase()}</Text>
            </View>}
        <Text style={{ color: colors.text, fontSize: 44, fontWeight: '700', letterSpacing: -1, textAlign: 'center', lineHeight: 50 }}>{b.name}</Text>
        <T variant="muted" style={{ textAlign: 'center', fontSize: 17, maxWidth: 420 }}>Presença nos treinos, documentos e currículo esportivo dos atletas.</T>
      </View>
      <Button title="Entrar" big onPress={() => router.push('/login')} style={{ width: '100%', maxWidth: 420, alignSelf: 'center' }} />
      <T variant="small" style={{ textAlign: 'center', marginTop: 24 }}>Feito com TechPoint</T>
    </Screen>
  );
}
