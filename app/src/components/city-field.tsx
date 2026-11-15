// Campo de cidade (D91): ao tocar, mostra as 27 capitais; ao digitar, sugere entre todas as cidades do país.
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Field } from '@/components/ui';
import { searchCities, type City } from '@/lib/cities';
import { useTheme } from '@/lib/theme';

type Props = { label?: string; value: string; onChange: (label: string, city?: City) => void; hint?: string };

export function CityField({ label = 'Cidade', value, onChange, hint }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const list = useMemo(() => searchCities(value, value.trim() ? 8 : 27), [value]);
  const pick = (c: City) => { onChange(c.label, c); setOpen(false); };
  return (
    <View style={{ gap: 4, zIndex: open ? 50 : 0 }}>
      <Field label={label} value={value} hint={hint} placeholder="Digite a cidade" autoCorrect={false}
        onChangeText={(v) => { onChange(v); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)} />
      {open && list.length > 0 && (
        <View style={{ borderRadius: 16, backgroundColor: colors.surfaceContainerHigh, maxHeight: 260, overflow: 'hidden' }}>
          {!value.trim() && <Text style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4, color: colors.textMuted, fontSize: 12, fontWeight: '800' }}>CAPITAIS</Text>}
          <View style={{ maxHeight: 240, overflow: 'scroll' as never }}>
            {list.map((c) => (
              <Pressable key={c.label} accessibilityRole="button" onPress={() => pick(c)}
                style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: pressed ? colors.background : 'transparent' })}>
                <Text style={{ color: colors.text, fontSize: 15 }}>{c.name} <Text style={{ color: colors.textMuted }}>- {c.uf}</Text></Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
