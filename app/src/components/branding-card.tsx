// Logo da entidade + cores do clube (D57): o app sugere as cores lidas do logo e o
// administrador confirma ou ajusta, vendo uma prévia, antes de salvar.
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Button, Card, Notice, T, styles } from '@/components/ui';
import { clubPalette, readableOn, suggestTheme } from '@/lib/colors';
import { pickLogo, type PickedLogo } from '@/lib/logo';

export type Branding = { logo: PickedLogo | null; logoUrl: string | null; primary: string | null; accent: string | null; candidates: string[] };

function Swatch({ color, selected, onPress }: { color: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Cor ${color}`} accessibilityState={{ selected }} onPress={onPress}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: color, borderWidth: selected ? 4 : 1, borderColor: selected ? '#0E1116' : '#DDE3EC' }} />
  );
}

export function BrandingCard({ value, onChange }: { value: Branding; onChange: (b: Branding) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = async () => {
    setError(null);
    setBusy(true);
    try {
      const logo = await pickLogo();
      if (!logo) return;
      const s = suggestTheme(logo.colors);
      onChange({ ...value, logo, candidates: logo.colors, primary: s?.primary ?? value.primary, accent: s?.accent ?? value.accent });
      if (!s) setError('Não encontramos cores marcantes neste logo. Escolha as cores abaixo ou mantenha as atuais.');
    } catch {
      setError('Não foi possível abrir a imagem. Tente outra.');
    } finally {
      setBusy(false);
    }
  };

  const preview = value.logo?.previewUri ?? value.logoUrl;
  const options = [...new Set([...(value.candidates ?? []), ...[value.primary, value.accent].filter((x): x is string => Boolean(x)), '#0B3D91', '#C6F432', '#0E7C86', '#FF7A3D', '#DC2626', '#16A34A'])].slice(0, 10);
  const pal = value.primary && value.accent ? clubPalette(value.primary, value.accent).light : null;

  return (
    <Card>
      <T variant="subtitle">Logo e cores do clube</T>
      <T variant="small">Todos da entidade verão o app nas cores do clube. O app sugere as cores lidas do logo; você confirma ou troca.</T>
      <View style={[styles.row, { alignItems: 'center' }]}>
        {preview
          ? <Image source={{ uri: preview }} style={{ width: 88, height: 88, borderRadius: 16 }} accessibilityLabel="Logo da entidade" />
          : <View style={{ width: 88, height: 88, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#A3ACBB', alignItems: 'center', justifyContent: 'center' }}><T variant="small">Sem logo</T></View>}
        <View style={{ flex: 1 }}><Button title={preview ? 'Trocar logo' : 'Escolher logo'} kind="outline" loading={busy} onPress={choose} /></View>
      </View>
      {error && <Notice text={error} />}
      <T variant="small" style={{ fontWeight: '600' }}>Cor principal (cabeçalho, botões, menu)</T>
      <View style={styles.wrap}>{options.map((c) => <Swatch key={`p${c}`} color={c} selected={value.primary === c} onPress={() => onChange({ ...value, primary: c })} />)}</View>
      <T variant="small" style={{ fontWeight: '600' }}>Cor de destaque (botão de check-in)</T>
      <View style={styles.wrap}>{options.map((c) => <Swatch key={`a${c}`} color={c} selected={value.accent === c} onPress={() => onChange({ ...value, accent: c })} />)}</View>
      {pal && (
        <View style={{ gap: 8, padding: 12, borderRadius: 14, backgroundColor: pal.background, borderWidth: 1, borderColor: pal.border }}>
          <T variant="small">Prévia</T>
          <View style={{ backgroundColor: pal.primary, borderRadius: 12, padding: 12 }}>
            <Text style={{ color: pal.onPrimary, fontWeight: '700', fontSize: 16 }}>Treino de hoje · 17:00</Text>
          </View>
          <View style={{ backgroundColor: pal.accent, borderRadius: 16, padding: 16, alignItems: 'center' }}>
            <Text style={{ color: readableOn(pal.accent), fontWeight: '800', fontSize: 18 }}>Fazer check-in</Text>
          </View>
        </View>
      )}
      {value.primary && <Button title="Usar cores padrão do TechPoint" kind="ghost" onPress={() => onChange({ ...value, primary: null, accent: null })} />}
    </Card>
  );
}
