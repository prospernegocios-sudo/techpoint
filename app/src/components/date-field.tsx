// Campo de data ou hora que abre o calendário/relógio do celular ao tocar.
// O valor continua em texto brasileiro: "dd/mm/aaaa" (data) ou "hh:mm" (hora).
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { T, styles } from '@/components/ui';
import { parseBrDate, parseTime } from '@/lib/format';
import { useTheme } from '@/lib/theme';

export type DateFieldProps = {
  label: string; mode: 'date' | 'time'; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string; error?: string; minimumDate?: Date;
};

const pad = (n: number) => String(n).padStart(2, '0');
export const toBrDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
export const toBrTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Converte o texto atual para Date (para abrir o seletor já no valor escolhido). */
export function fieldToDate(mode: 'date' | 'time', value: string): Date {
  const now = new Date();
  if (mode === 'date') return parseBrDate(value) ?? now;
  const t = parseTime(value);
  if (t) now.setHours(t[0], t[1], 0, 0);
  return now;
}

export function DateField({ label, mode, value, onChange, placeholder, hint, error, minimumDate }: DateFieldProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const onPick = (e: DateTimePickerEvent, d?: Date) => {
    setOpen(false);
    if (e.type === 'set' && d) onChange(mode === 'date' ? toBrDate(d) : toBrTime(d));
  };
  return (
    <View style={{ gap: 6 }}>
      <T variant="small" style={{ fontWeight: '600', color: colors.text }}>{label}</T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || 'escolher'}`}
        onPress={() => setOpen(true)}
        style={[styles.input, { borderColor: error ? colors.danger : colors.border, backgroundColor: colors.surface, justifyContent: 'center' }]}
      >
        <Text style={{ fontSize: 16, color: value ? colors.text : colors.textMuted }}>
          {value || placeholder || (mode === 'date' ? 'Toque para escolher a data' : 'Toque para escolher a hora')}
        </Text>
      </Pressable>
      {error ? <T variant="small" color={colors.danger}>{error}</T> : hint ? <T variant="small">{hint}</T> : null}
      {open && (
        <DateTimePicker
          value={fieldToDate(mode, value)}
          mode={mode}
          is24Hour
          display="default"
          minimumDate={minimumDate}
          onChange={onPick}
        />
      )}
    </View>
  );
}
