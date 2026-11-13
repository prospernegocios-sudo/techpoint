// Perfil: dados da conta, aparência (paleta e modo) e biometria.
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Button, Card, Chip, Field, Notice, Screen, T, styles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { roleLabels, useMe } from '@/lib/me';
import { palettes, useTheme, type ModePref, type PaletteId } from '@/lib/theme';

export default function Perfil() {
  const { signOut, biometricAvailable, biometricEnabled, setBiometricEnabled, session } = useAuth();
  // Conta com e-mail e senha: permite trocar a senha (inclusive depois do "Esqueci a senha").
  const isEmailAccount = session?.user.app_metadata?.provider === 'email';
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const changePassword = async () => {
    if (newPw.length < 8 || !/[A-Za-z]/.test(newPw) || !/\d/.test(newPw)) return setPwMsg({ tone: 'danger', text: 'A senha precisa ter pelo menos 8 caracteres, com letras e números.' });
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) return setPwMsg({ tone: 'danger', text: 'Não foi possível trocar a senha. Entre de novo e tente outra vez.' });
    setNewPw('');
    setPwMsg({ tone: 'success', text: 'Senha alterada.' });
  };
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

      {isEmailAccount && (
        <Card>
          <T variant="subtitle">Senha</T>
          <Field label="Nova senha" value={newPw} onChangeText={setNewPw} secureTextEntry autoComplete="new-password" hint="Pelo menos 8 caracteres, com letras e números." />
          {pwMsg && <Notice tone={pwMsg.tone} text={pwMsg.text} />}
          <Button title="Trocar senha" kind="outline" onPress={changePassword} />
        </Card>
      )}
      <Button title="Sair da conta" kind="outline" onPress={signOut} />
      <T variant="small" style={{ textAlign: 'center' }}>TechPoint · versão de teste</T>
    </Screen>
  );
}
