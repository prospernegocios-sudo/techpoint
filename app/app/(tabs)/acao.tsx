// Tela do botão central quando não há treino para agir agora.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Screen, T } from '@/components/ui';
import { useCenterAction } from '@/lib/next-action';
import { useTheme } from '@/lib/theme';

export default function Acao() {
  const a = useCenterAction();
  const { colors } = useTheme();
  if (a.kind !== 'none') {
    return (
      <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Button title={a.kind === 'roster' ? 'Abrir lista de presença' : `Fazer ${a.label.toLowerCase()}`} kind="accent" big
          onPress={() => (a.kind === 'roster'
            ? router.push({ pathname: '/evento/[id]', params: { id: a.eventId } })
            : router.push({ pathname: '/checkin/[eventId]', params: { eventId: a.eventId, kind: a.kind === 'checkin' ? 'check_in' : 'check_out' } }))} />
      </Screen>
    );
  }
  return (
    <Screen style={{ justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Ionicons name="time-outline" size={56} color={colors.textMuted} />
        <T variant="subtitle" style={{ textAlign: 'center' }}>Não há treino disponível para check-in neste momento.</T>
        <T variant="muted" style={{ textAlign: 'center' }}>{a.hint}</T>
        <T variant="small" style={{ textAlign: 'center' }}>O check-in abre 30 minutos antes do treino e pode ser feito pelo app ou pelo site. O botão do meio fica colorido quando abrir.</T>
      </View>
    </Screen>
  );
}
