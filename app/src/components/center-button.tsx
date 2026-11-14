// Botão central da barra (D62): um toque e ele decide — check-in, check-out ou a presença de agora.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useCenterAction } from '@/lib/next-action';
import { useTheme } from '@/lib/theme';

export function CenterButton({ wide }: { wide: boolean }) {
  const a = useCenterAction();
  const { colors } = useTheme();
  const active = a.kind !== 'none';
  const icon = a.kind === 'roster' || (a.kind === 'none' && a.label === 'Presença') ? 'people' : a.kind === 'checkout' ? 'exit-outline' : 'finger-print';
  const go = () => {
    if (a.kind === 'checkin' || a.kind === 'checkout') {
      router.push({ pathname: '/checkin/[eventId]', params: { eventId: a.eventId, kind: a.kind === 'checkin' ? 'check_in' : 'check_out' } });
    } else if (a.kind === 'roster') {
      router.push({ pathname: '/evento/[id]', params: { id: a.eventId } });
    } else {
      router.navigate('/(tabs)/acao');
    }
  };
  const label = a.kind === 'none' ? a.label : a.label;
  if (wide) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={go}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, margin: 8, padding: 12, borderRadius: 14, backgroundColor: active ? colors.accent : colors.background }}>
        <Ionicons name={icon} size={22} color={active ? colors.onAccent : colors.textMuted} />
        <Text style={{ fontWeight: '800', fontSize: 15, color: active ? colors.onAccent : colors.textMuted }}>{label}</Text>
      </Pressable>
    );
  }
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={active ? label : `${label}: ${a.kind === 'none' ? a.hint : ''}`}
        onPress={go}
        style={({ pressed }) => ({
          marginTop: -26, width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center',
          backgroundColor: active ? colors.accent : colors.border, borderWidth: 4, borderColor: colors.surface,
          shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        })}
      >
        <Ionicons name={icon} size={32} color={active ? colors.onAccent : colors.textMuted} />
      </Pressable>
      <Text style={{ fontSize: 12, fontWeight: '800', marginTop: 2, color: active ? colors.text : colors.textMuted }}>{label}</Text>
    </View>
  );
}
