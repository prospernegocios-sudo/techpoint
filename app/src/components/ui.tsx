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
import { Ionicons } from '@expo/vector-icons';
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
    title: { fontSize: 26, fontWeight: '600', letterSpacing: -0.3, color: colors.text },
    subtitle: { fontSize: 17, fontWeight: '600', color: colors.text },
    body: { fontSize: 16, color: colors.text },
    muted: { fontSize: 15, color: colors.textMuted },
    small: { fontSize: 13, color: colors.textMuted },
  };
  return <Text style={[base[variant], color ? { color } : null, style]}>{children}</Text>;
}

type ButtonKind = 'primary' | 'accent' | 'tonal' | 'outline' | 'danger' | 'ghost';
/** Botões no padrão Material You: formato de pílula, mesma altura em todo o app. */
export function Button({
  title, onPress, kind = 'primary', loading, disabled, big, style, accessibilityHint, icon,
}: {
  title: string; onPress: () => void; kind?: ButtonKind; loading?: boolean; disabled?: boolean; big?: boolean;
  style?: ViewStyle; accessibilityHint?: string; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { colors } = useTheme();
  const bg: Record<ButtonKind, string> = {
    primary: colors.primary, accent: colors.accent, tonal: colors.primaryContainer, outline: 'transparent', danger: colors.danger, ghost: 'transparent',
  };
  const fg: Record<ButtonKind, string> = {
    primary: colors.onPrimary, accent: colors.onAccent, tonal: colors.onPrimaryContainer, outline: colors.primary, danger: '#FFFFFF', ghost: colors.primary,
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
        { backgroundColor: bg[kind], borderColor: kind === 'outline' ? colors.outline : 'transparent', opacity: isDisabled ? 0.45 : pressed ? 0.82 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg[kind]} /> : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon && <Ionicons name={icon} size={big ? 24 : 20} color={fg[kind]} />}
          <Text style={[styles.buttonText, big && { fontSize: 19 }, { color: fg[kind] }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const { colors } = useTheme();
  const s = [styles.card, { backgroundColor: colors.surfaceContainer }, style];
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [...s, { opacity: pressed ? 0.85 : 1 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={s}>{children}</View>;
}

export function Field({ label, hint, error, style, ...props }: TextInputProps & { label: string; hint?: string; error?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T variant="small" style={{ fontWeight: '600', color: colors.text, marginLeft: 4 }}>{label}</T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { borderColor: error ? colors.danger : colors.outline, color: colors.text, backgroundColor: 'transparent' }, props.multiline ? { minHeight: 120, textAlignVertical: 'top', paddingTop: 12 } : null, style]}
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
      style={({ pressed }) => [styles.chip, {
        borderColor: selected ? 'transparent' : colors.outline,
        backgroundColor: selected ? colors.primaryContainer : 'transparent',
        paddingLeft: selected ? 10 : 16, opacity: pressed ? 0.8 : 1,
      }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {selected && <Ionicons name="checkmark" size={18} color={colors.onPrimaryContainer} />}
        <Text style={{ color: selected ? colors.onPrimaryContainer : colors.textMuted, fontWeight: '600' }}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function Badge({ label, tone = 'muted' }: { label: string; tone?: 'success' | 'warning' | 'danger' | 'muted' | 'primary' }) {
  const { colors } = useTheme();
  const [bg, fg] = {
    success: [colors.successContainer, colors.onSuccessContainer], warning: [colors.warningContainer, colors.onWarningContainer],
    danger: [colors.dangerContainer, colors.onDangerContainer], muted: [colors.surfaceContainerHigh, colors.textMuted],
    primary: [colors.primaryContainer, colors.onPrimaryContainer],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Notice({ text, tone = 'warning' }: { text: string; tone?: 'warning' | 'danger' | 'success' | 'info' }) {
  const { colors } = useTheme();
  const [bg, fg, icon] = ({
    warning: [colors.warningContainer, colors.onWarningContainer, 'alert-circle-outline'],
    danger: [colors.dangerContainer, colors.onDangerContainer, 'warning-outline'],
    success: [colors.successContainer, colors.onSuccessContainer, 'checkmark-circle-outline'],
    info: [colors.primaryContainer, colors.onPrimaryContainer, 'information-circle-outline'],
  } as const)[tone];
  return (
    <View accessibilityRole="alert" style={[styles.notice, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={22} color={fg} />
      <Text style={{ color: fg, fontSize: 15, flex: 1 }}>{text}</Text>
    </View>
  );
}

/** Carregando: com texto (ex.: "Buscando sua localização...") mostra o indicador;
 * sem texto mostra blocos no formato do conteúdo (achado de UX nº 12). */
export function Loading({ text }: { text?: string }) {
  const { colors } = useTheme();
  if (text) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <T variant="muted">{text}</T>
      </View>
    );
  }
  const bar = (w: number | `${number}%`, h = 14) => <View style={{ width: w, height: h, borderRadius: 7, backgroundColor: colors.border, opacity: 0.7 }} />;
  return (
    <View accessibilityLabel="Carregando" accessibilityRole="progressbar" style={{ gap: 14, padding: 16, backgroundColor: colors.background }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.card, { backgroundColor: colors.surfaceContainer, gap: 10 }]}>
          {bar('55%', 18)}
          {bar('85%')}
          {bar('40%')}
        </View>
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  // No computador o conteúdo fica centralizado com largura confortável de leitura.
  screenInner: { flex: 1, padding: 16, gap: 14, width: '100%', maxWidth: 1000, alignSelf: 'center' },
  button: { minHeight: 52, borderRadius: 999, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  buttonBig: { minHeight: 64 },
  buttonText: { fontSize: 16, fontWeight: '600', letterSpacing: 0.1 },
  card: { borderRadius: 24, padding: 18, gap: 8 },
  input: { minHeight: 56, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 16 },
  chip: { minHeight: 40, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  notice: { borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
