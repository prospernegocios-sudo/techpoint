// Versão do site: campo digitado com máscara (dd/mm/aaaa e HH:MM), igual em qualquer navegador e idioma.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { MiniCalendar } from '@/components/mini-calendar';
import { Field, T } from '@/components/ui';
import { useTheme } from '@/lib/theme';
import { maskDate, maskTime, parseBrDate, parseTime } from '@/lib/format';
import type { DateFieldProps } from './date-field';

const pad = (n: number) => String(n).padStart(2, '0');
export const toBrDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
export const toBrTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export function fieldToDate(mode: 'date' | 'time', value: string): Date {
  const now = new Date();
  if (mode === 'date') return parseBrDate(value) ?? now;
  const t = parseTime(value);
  if (t) now.setHours(t[0], t[1], 0, 0);
  return now;
}

export function DateField({ label, mode, value, onChange, hint, error }: DateFieldProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field
            label={label}
            value={value}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={mode === 'date' ? 10 : 5}
            placeholder={mode === 'date' ? 'dd/mm/aaaa' : 'HH:MM'}
            onChangeText={(v) => onChange(mode === 'date' ? maskDate(v) : maskTime(v))}
            error={error}
          />
        </View>
        {mode === 'date' && (
          <Pressable accessibilityRole="button" accessibilityLabel="Abrir calendário" onPress={() => setOpen(!open)}
            style={{ width: 52, height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: open ? colors.primary : colors.surface }}>
            <Ionicons name="calendar-outline" size={22} color={open ? colors.onPrimary : colors.text} />
          </Pressable>
        )}
      </View>
      {open && mode === 'date' && <MiniCalendar value={parseBrDate(value)} onPick={(d) => { onChange(toBrDate(d)); setOpen(false); }} />}
      {hint && !error ? <T variant="small">{hint}</T> : null}
    </View>
  );
}
