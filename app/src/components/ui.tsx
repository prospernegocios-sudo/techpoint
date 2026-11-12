// Componentes visuais básicos, já com o tema e pensados para uso com uma mão
// (botões grandes, área de toque mínima de 48 px).
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';

export function Screen({ children, scroll = true, style }: { children: ReactNode; scroll?: boolean; style?: ViewStyle }) {
  const { colors } = useTheme();
  const inner = <View style={[styles.screenInner, style]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['left', 'right', 'bottom']}>
      {scroll ? <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

type TextVariant = 'title' | 'subtitle' | 'body' | 'muted' | 'small';
export function T({ children, variant = 'body', style, color }: { children: ReactNode; variant?: TextVariant; style?: TextStyle; color?: string }) {
  const { colors } = useTheme();
  const base: Record<TextVariant, TextStyle> = {
    title: { fontSize: 24, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    body: { fontSize: 16, color: colors.text },
    muted: { fontSize: 15, color: colors.textMuted },
    small: { fontSize: 13, color: colors.textMuted },
  };
  return <Text style={[base[variant], color ? { color } : null, style]}>{children}</Text>;
}

type ButtonKind = 'primary' | 'accent' | 'outline' | 'danger' | 'ghost';
export function Button({
  title, onPress, kind = 'primary', loading, disabled, big, style, accessibilityHint,
}: {
  title: string; onPress: () => void; kind?: ButtonKind; loading?: boolean; disabled?: boolean; big?: boolean;
  style?: ViewStyle; accessibilityHint?: string;
}) {
  const { colors } = useTheme();
  const bg: Record<ButtonKind, string> = {
    primary: colors.primary, accent: colors.accent, outline: 'transparent', danger: colors.danger, ghost: 'transparent',
  };
  const fg: Record<ButtonKind, string> = {
    primary: colors.onPrimary, accent: colors.onAccent, outline: colors.primary, danger: '#FFFFFF', ghost: colors.primary,
  };
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        big && styles.buttonBig,
        { backgroundColor: bg[kind], borderColor: kind === 'outline' ? colors.primary : 'transparent', opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg[kind]} /> : <Text style={[styles.buttonText, big && { fontSize: 22 }, { color: fg[kind] }]}>{title}</Text>}
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const { colors } = useTheme();
  const s = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style];
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [...s, { opacity: pressed ? 0.85 : 1 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={s}>{children}</View>;
}

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T variant="small" style={{ fontWeight: '600', color: colors.text }}>{label}</T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { borderColor: error ? colors.danger : colors.border, color: colors.text, backgroundColor: colors.surface }]}
        {...props}
      />
      {error ? <T variant="small" color={colors.danger}>{error}</T> : hint ? <T variant="small">{hint}</T> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.surface }]}
    >
      <Text style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'muted' }: { label: string; tone?: 'success' | 'warning' | 'danger' | 'muted' | 'primary' }) {
  const { colors } = useTheme();
  const c = { success: colors.success, warning: colors.warning, danger: colors.danger, muted: colors.textMuted, primary: colors.primary }[tone];
  return (
    <View style={[styles.badge, { borderColor: c }]}>
      <Text style={{ color: c, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Notice({ text, tone = 'warning' }: { text: string; tone?: 'warning' | 'danger' | 'success' | 'info' }) {
  const { colors } = useTheme();
  const c = { warning: colors.warning, danger: colors.danger, success: colors.success, info: colors.primary }[tone];
  return (
    <View accessibilityRole="alert" style={[styles.notice, { borderColor: c, backgroundColor: colors.surface }]}>
      <Text style={{ color: colors.text, fontSize: 15 }}>{text}</Text>
    </View>
  );
}

export function Loading({ text = 'Carregando...' }: { text?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <T variant="muted">{text}</T>
    </View>
  );
}

export const styles = StyleSheet.create({
  screenInner: { flex: 1, padding: 16, gap: 14 },
  button: { minHeight: 52, borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  buttonBig: { minHeight: 76, borderRadius: 20 },
  buttonText: { fontSize: 17, fontWeight: '700' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  input: { minHeight: 52, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  badge: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  notice: { borderLeftWidth: 5, borderWidth: 1, borderRadius: 12, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
