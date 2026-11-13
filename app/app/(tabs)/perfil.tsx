// Perfil: dados da conta, aparência (paleta e modo) e biometria.
import { Switch, View } from 'react-native';
import { Button, Card, Chip, Screen, T, styles } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { roleLabels, useMe } from '@/lib/me';
import { palettes, useTheme, type ModePref, type PaletteId } from '@/lib/theme';

export default function Perfil() {
  const { signOut, biometricAvailable, biometricEnabled, setBiometricEnabled } = useAuth();
  const me = useMe();
  const { colors, palette, setPalette, mode, setMode, clubColors } = useTheme();
  const modes: { id: ModePref; label: string }[] = [
    { id: 'system', label: 'Automático' }, { id: 'light', label: 'Claro' }, { id: 'dark', label: 'Escuro' },
  ];
  return (
    <Screen>
      <Card>
        <T variant="subtitle">{me.profile?.full_name ?? 'Minha conta'}</T>
        <T variant="muted">{me.profile?.email}</T>
        {me.org && <T variant="small">{me.org.name} · {me.roles.map((r) => roleLabels[r]).join(', ')}</T>}
        {me.isPlatformAdmin && <T variant="small" color={colors.primary}>Administrador da plataforma</T>}
      </Card>

      <Card>
        <T variant="subtitle">Aparência</T>
        <T variant="small">Paleta de cores</T>
        <View style={styles.wrap}>
          {clubColors && <Chip label="Cores do clube" selected={palette === 'clube'} onPress={() => setPalette('clube')} />}
          {(Object.keys(palettes) as Exclude<PaletteId, 'clube'>[]).map((p) => (
            <Chip key={p} label={palettes[p].name} selected={palette === p} onPress={() => setPalette(p)} />
          ))}
        </View>
        <T variant="small">Modo</T>
        <View style={styles.wrap}>
          {modes.map((m) => <Chip key={m.id} label={m.label} selected={mode === m.id} onPress={() => setMode(m.id)} />)}
        </View>
      </Card>

      <Card>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <View style={{ flex: 1 }}>
            <T variant="subtitle">Abrir com biometria</T>
            <T variant="small">{biometricAvailable ? 'Digital ou reconhecimento facial ao abrir o app.' : 'Cadastre uma digital ou rosto nas configurações do celular para usar.'}</T>
          </View>
          <Switch
            accessibilityLabel="Abrir com biometria"
            value={biometricAvailable && biometricEnabled}
            disabled={!biometricAvailable}
            onValueChange={(v) => setBiometricEnabled(v)}
          />
        </View>
      </Card>

      <Button title="Sair da conta" kind="outline" onPress={signOut} />
      <T variant="small" style={{ textAlign: 'center' }}>TechPoint · versão de teste</T>
    </Screen>
  );
}
