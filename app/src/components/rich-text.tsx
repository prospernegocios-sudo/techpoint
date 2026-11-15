// Texto com formatação básica (D89): **negrito**, *itálico*, linhas com "• " viram lista; alinhamento.
// Guardado como texto simples (fácil de importar, copiar e mostrar em qualquer lugar).
import { useRef, useState } from 'react';
import { Pressable, Text, View, type TextStyle } from 'react-native';
import { Field } from '@/components/ui';
import { toast } from '@/components/toast';
import { clearFormat, parseInline, toggleBullets, toggleWrap, type Sel } from '@/lib/rich';
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

/** Campo com barra de formatação: Negrito, Itálico e Lista (ligam e desligam), alinhamento,
 *  Desfazer/Refazer e Limpar formatação. */
export function RichField({ label, value, onChange, align, onAlign, maxLength }: {
  label: string; value: string; onChange: (v: string) => void; align: Align; onAlign: (a: Align) => void; maxLength?: number;
}) {
  const { colors } = useTheme();
  const [sel, setSel] = useState<Sel>({ start: value.length, end: value.length });
  const lastRange = useRef<{ sel: Sel; at: number } | null>(null); // a seleção some ao tocar no botão (no site)
  const past = useRef<string[]>([]);
  const future = useRef<string[]>([]);
  const lastTyped = useRef(0);
  const [, force] = useState(0);

  const apply = (next: string, typing = false) => {
    if (next === value) return;
    const now = Date.now();
    if (!typing || now - lastTyped.current > 800) { past.current.push(value); if (past.current.length > 60) past.current.shift(); }
    if (typing) lastTyped.current = now;
    future.current = [];
    onChange(next);
    force((x) => x + 1);
  };
  const range = (): Sel => (sel.start !== sel.end ? sel : lastRange.current && Date.now() - lastRange.current.at < 8000 ? lastRange.current.sel : sel);
  const wrap = (mark: '**' | '*') => {
    const r = toggleWrap(value, range(), mark);
    if (!r) return toast('Selecione um trecho do texto primeiro.', 'danger');
    apply(r.value); lastRange.current = { sel: r.sel, at: Date.now() }; setSel(r.sel);
  };
  const undo = () => { const prev = past.current.pop(); if (prev === undefined) return; future.current.push(value); onChange(prev); force((x) => x + 1); };
  const redo = () => { const next = future.current.pop(); if (next === undefined) return; past.current.push(value); onChange(next); force((x) => x + 1); };

  const Btn = ({ label: l, a11y, onPress, active, disabled, style }: { label: string; a11y?: string; onPress: () => void; active?: boolean; disabled?: boolean; style?: TextStyle }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y ?? l} onPress={onPress} disabled={disabled}
      style={{ minWidth: 40, height: 36, paddingHorizontal: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1,
        backgroundColor: active ? colors.primary : colors.background, borderWidth: 1, borderColor: colors.border }}>
      <Text style={[{ color: active ? colors.onPrimary : colors.text, fontSize: 15, fontWeight: '700' }, style]}>{l}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Btn label="↶" a11y="Desfazer" onPress={undo} disabled={!past.current.length} />
        <Btn label="↷" a11y="Refazer" onPress={redo} disabled={!future.current.length} />
        <Btn label="N" a11y="Negrito" onPress={() => wrap('**')} style={{ fontWeight: '900' }} />
        <Btn label="I" a11y="Itálico" onPress={() => wrap('*')} style={{ fontStyle: 'italic' }} />
        <Btn label="• Lista" onPress={() => apply(toggleBullets(value, range()))} />
        <Btn label="Limpar" a11y="Limpar formatação" onPress={() => apply(clearFormat(value, range()))} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Btn label="Esquerda" active={align === 'left'} onPress={() => onAlign('left')} />
        <Btn label="Justificado" active={align === 'justify'} onPress={() => onAlign('justify')} />
        <Btn label="Centro" active={align === 'center'} onPress={() => onAlign('center')} />
      </View>
      <Field label={label} value={value} onChangeText={(v) => apply(v, true)} multiline numberOfLines={8} maxLength={maxLength}
        onSelectionChange={(e) => { const s = e.nativeEvent.selection; setSel(s); if (s.start !== s.end) lastRange.current = { sel: s, at: Date.now() }; }}
        style={{ minHeight: 200, height: 200 }}
        hint="Selecione um trecho e toque em N ou I. Toque de novo para tirar. ↶ desfaz." />
      {value.trim() ? (
        <View style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>PRÉVIA</Text>
          <RichText text={value} align={align} />
        </View>
      ) : null}
    </View>
  );
}
