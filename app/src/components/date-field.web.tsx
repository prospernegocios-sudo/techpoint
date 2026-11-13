// Versão do site: usa o calendário e o relógio do próprio navegador.
import { createElement } from 'react';
import { View } from 'react-native';
import { T } from '@/components/ui';
import { parseBrDate, parseTime } from '@/lib/format';
import { useTheme } from '@/lib/theme';
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

export function DateField({ label, mode, value, onChange, hint, error, minimumDate }: DateFieldProps) {
  const { colors } = useTheme();
  const d = mode === 'date' ? parseBrDate(value) : null;
  const t = mode === 'time' ? parseTime(value) : null;
  const htmlValue = d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : t ? `${pad(t[0])}:${pad(t[1])}` : '';
  const min = minimumDate && mode === 'date' ? `${minimumDate.getFullYear()}-${pad(minimumDate.getMonth() + 1)}-${pad(minimumDate.getDate())}` : undefined;
  return (
    <View style={{ gap: 6 }}>
      <T variant="small" style={{ fontWeight: '600', color: colors.text }}>{label}</T>
      {createElement('input', {
        type: mode, value: htmlValue, min, 'aria-label': label,
        onChange: (e: { target: { value: string } }) => {
          const v = e.target.value;
          if (!v) return onChange('');
          if (mode === 'date') { const [y, m, dd] = v.split('-'); onChange(`${dd}/${m}/${y}`); } else onChange(v.slice(0, 5));
        },
        style: {
          minHeight: 52, borderRadius: 12, border: `1.5px solid ${error ? colors.danger : colors.border}`, padding: '0 14px',
          fontSize: 16, color: colors.text, background: colors.surface, fontFamily: 'inherit', colorScheme: 'light dark',
        },
      })}
      {error ? <T variant="small" color={colors.danger}>{error}</T> : hint ? <T variant="small">{hint}</T> : null}
    </View>
  );
}
