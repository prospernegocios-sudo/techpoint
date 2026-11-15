// Texto com formatação básica (D89): **negrito**, *itálico*, linhas com "• " viram lista; alinhamento.
// Guardado como texto simples (fácil de importar, copiar e mostrar em qualquer lugar).
import { useState } from 'react';
import { Pressable, Text, View, type TextStyle } from 'react-native';
import { Field } from '@/components/ui';
import { parseInline } from '@/lib/rich';
import { useTheme } from '@/lib/theme';
export { richToHtml } from '@/lib/rich';

export type Align = 'left' | 'justify' | 'center';

/** "**a** e *b*" → pedaços com negrito/itálico. */
export function RichText({ text, align = 'justify', style }: { text: string; align?: Align; style?: TextStyle }) {
  const { colors } = useTheme();
  const base: TextStyle = { color: colors.text, fontSize: 15, lineHeight: 22, textAlign: align, ...style };
  const paras = text.split(/\n/);
  return (
    <View style={{ gap: 6 }}>
      {paras.map((p, k) => {
        const bullet = /^\s*[•\-*]\s+/.test(p) && !/^\s*\*\*/.test(p);
        const body = bullet ? p.replace(/^\s*[•\-*]\s+/, '') : p;
        if (!body.trim()) return <View key={k} style={{ height: 4 }} />;
        const pieces = parseInline(body).map((x, j) => <Text key={j} style={{ fontWeight: x.b ? '800' : undefined, fontStyle: x.i ? 'italic' : undefined }}>{x.t}</Text>);
        return bullet
          ? <View key={k} style={{ flexDirection: 'row', gap: 8 }}><Text style={base}>•</Text><Text style={[base, { flex: 1, textAlign: align === 'justify' ? 'left' : align }]}>{pieces}</Text></View>
          : <Text key={k} style={base}>{pieces}</Text>;
      })}
    </View>
  );
}

/** Campo com barra de formatação: Negrito, Itálico, Lista e alinhamento. */
export function RichField({ label, value, onChange, align, onAlign, maxLength }: {
  label: string; value: string; onChange: (v: string) => void; align: Align; onAlign: (a: Align) => void; maxLength?: number;
}) {
  const { colors } = useTheme();
  const [sel, setSel] = useState({ start: value.length, end: value.length });
  const wrap = (mark: string) => {
    const { start, end } = sel;
    const chosen = value.slice(start, end) || 'texto';
    onChange(value.slice(0, start) + mark + chosen + mark + value.slice(end));
  };
  const bullet = () => {
    const lineStart = value.lastIndexOf('\n', sel.start - 1) + 1;
    onChange(value.slice(0, lineStart) + '• ' + value.slice(lineStart));
  };
  const Btn = ({ label: l, onPress, active, style }: { label: string; onPress: () => void; active?: boolean; style?: TextStyle }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={l} onPress={onPress}
      style={{ minWidth: 40, height: 36, paddingHorizontal: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
        backgroundColor: active ? colors.primary : colors.background, borderWidth: 1, borderColor: colors.border }}>
      <Text style={[{ color: active ? colors.onPrimary : colors.text, fontSize: 15, fontWeight: '700' }, style]}>{l}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Btn label="N" onPress={() => wrap('**')} style={{ fontWeight: '900' }} />
        <Btn label="I" onPress={() => wrap('*')} style={{ fontStyle: 'italic' }} />
        <Btn label="• Lista" onPress={bullet} />
        <View style={{ width: 8 }} />
        <Btn label="Esquerda" active={align === 'left'} onPress={() => onAlign('left')} />
        <Btn label="Justificado" active={align === 'justify'} onPress={() => onAlign('justify')} />
        <Btn label="Centro" active={align === 'center'} onPress={() => onAlign('center')} />
      </View>
      <Field label={label} value={value} onChangeText={onChange} multiline maxLength={maxLength}
        onSelectionChange={(e) => setSel(e.nativeEvent.selection)} style={{ minHeight: 200 }} hint="Selecione um trecho e toque em N (negrito) ou I (itálico)." />
      {value.trim() ? (
        <View style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>PRÉVIA</Text>
          <RichText text={value} align={align} />
        </View>
      ) : null}
    </View>
  );
}

