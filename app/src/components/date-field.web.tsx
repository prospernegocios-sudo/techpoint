// Versão do site: campo digitado com máscara (dd/mm/aaaa e HH:MM), igual em qualquer navegador e idioma.
import { View } from 'react-native';
import { Field } from '@/components/ui';
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
  return (
    <View>
      <Field
        label={label}
        value={value}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={mode === 'date' ? 10 : 5}
        placeholder={mode === 'date' ? 'dd/mm/aaaa' : 'HH:MM'}
        onChangeText={(v) => onChange(mode === 'date' ? maskDate(v) : maskTime(v))}
        hint={hint}
        error={error}
      />
    </View>
  );
}
