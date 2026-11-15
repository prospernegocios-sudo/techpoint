// Calendário embutido (D92): mês em grade, hoje destacado, toque para escolher. Igual no site e no celular.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const same = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function MiniCalendar({ value, onPick }: { value: Date | null; onPick: (d: Date) => void }) {
  const { colors } = useTheme();
  const today = new Date();
  const [view, setView] = useState(() => { const d = value ?? today; return new Date(d.getFullYear(), d.getMonth(), 1); });
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1))];
  while (cells.length % 7) cells.push(null);
  const move = (n: number) => setView(new Date(view.getFullYear(), view.getMonth() + n, 1));
  return (
    <View style={{ borderRadius: 24, padding: 14, backgroundColor: colors.surfaceContainerHigh, gap: 6, maxWidth: 340 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" onPress={() => move(-1)} hitSlop={8}><Ionicons name="chevron-back" size={20} color={colors.text} /></Pressable>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{MESES[view.getMonth()]} {view.getFullYear()}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" onPress={() => move(1)} hitSlop={8}><Ionicons name="chevron-forward" size={20} color={colors.text} /></Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {DIAS.map((d, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>{d}</Text>)}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
            if (!d) return <View key={i} style={{ flex: 1, height: 36 }} />;
            const sel = value && same(d, value), now = same(d, today);
            return (
              <Pressable key={i} accessibilityRole="button" accessibilityLabel={d.toLocaleDateString('pt-BR')} onPress={() => onPick(d)}
                style={{ flex: 1, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: sel ? colors.primary : 'transparent', borderWidth: now && !sel ? 1.5 : 0, borderColor: colors.primary }}>
                  <Text style={{ color: sel ? colors.onPrimary : colors.text, fontWeight: now || sel ? '800' : '400' }}>{d.getDate()}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      <Pressable accessibilityRole="button" onPress={() => onPick(today)} style={{ alignSelf: 'center', paddingVertical: 4 }}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>Hoje</Text>
      </Pressable>
    </View>
  );
}
