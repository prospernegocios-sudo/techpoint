import { useAthleteHeader } from '@/lib/athlete-header';
import { ageOn } from '@/lib/format';
// Perfil / Meus dados: dados pessoais e do atleta, aparência, biometria, senha, privacidade e conta.
import { toast } from '@/components/toast';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { DocumentsCard } from '@/components/documents-card';
import { AthleteDataForm, MyDataForm } from '@/components/personal-data';
import { Button, Card, Chip, Field, Notice, Screen, T, styles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { RELOCK_OPTIONS, useAuth } from '@/lib/auth';
import { roleLabels, useMe } from '@/lib/me';
import { palettes, useTheme, type ModePref, type PaletteId } from '@/lib/theme';

export default function Perfil() {
  const { signOut, biometricAvailable, biometricEnabled, setBiometricEnabled, session, relockMinutes, setRelockMinutes } = useAuth();
  // Conta com e-mail e senha: permite trocar a senha (inclusive depois do "Esqueci a senha").
  const isEmailAccount = session?.user.app_metadata?.provider === 'email';
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const changePassword = async () => {
    if (newPw.length < 8 || !/[A-Za-z]/.test(newPw) || !/\d/.test(newPw)) return setPwMsg({ tone: 'danger', text: 'A senha precisa ter pelo menos 8 caracteres, com letras e números.' });
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) return setPwMsg({ tone: 'danger', text: /password should|weak/i.test(error.message) ? 'A senha precisa ter pelo menos 8 caracteres, com letras e números.' : /same|different from the old/i.test(error.message) ? 'A nova senha precisa ser diferente da atual.' : 'Não foi possível trocar a senha. Entre de novo e tente outra vez.' });
    setNewPw('');
    setPwMsg(null); toast('Senha alterada.');
  };
  const me = useMe();
  // Cabeçalho do atleta: idade, sexo e categoria (auditoria, item 08).
  const ath = useAthleteHeader(me.mode === 'athlete' ? me.athlete?.id : undefined);
  const { colors, palette, setPalette, mode, setMode, clubColors } = useTheme();
  const modes: { id: ModePref; label: string }[] = [
    { id: 'system', label: 'Automático' }, { id: 'light', label: 'Claro' }, { id: 'dark', label: 'Escuro' },
  ];
  return (
    <Screen>
      <Card>
        <T variant="subtitle">{me.profile?.full_name ?? 'Minha conta'}</T>
        {me.mode === 'athlete' && me.athlete && (
          <T variant="body">{[`${ageOn(new Date(me.athlete.birth_date + 'T12:00:00'))} anos`, ath.data?.sex === 'M' ? 'Masculino' : ath.data?.sex === 'F' ? 'Feminino' : null].filter(Boolean).join(' · ')}</T>
        )}
        <T variant="muted">{me.profile?.email}</T>
        {me.org && <T variant="small">{me.org.name} · {me.mode === 'athlete' && ath.data?.teams.length ? ath.data.teams.join(', ') : me.roles.map((r) => roleLabels[r]).join(', ')}</T>}
        {me.isPlatformAdmin && <T variant="small" color={colors.primary}>Administrador da plataforma</T>}
      </Card>

      {me.mode === 'athlete' && me.athlete ? (
        <>
          <AthleteDataForm athleteId={me.athlete.id} orgId={me.athlete.org_id} birthDate={me.athlete.birth_date} canSeeBody />
          {me.profile && <DocumentsCard orgId={me.athlete.org_id} athleteId={me.athlete.id} meId={me.profile.id} isStaff={false} />}
        </>
      ) : (
        me.profile && <MyDataForm profileId={me.profile.id} name={me.profile.full_name} />
      )}

      <T variant="subtitle">Configurações</T>
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
        {biometricAvailable && biometricEnabled && (
          <View style={{ gap: 6 }}>
            <T variant="small">Pedir de novo depois de ficar fora do app por:</T>
            <View style={styles.wrap}>
              {RELOCK_OPTIONS.map((m) => <Chip key={m} label={`${m} min`} selected={relockMinutes === m} onPress={() => setRelockMinutes(m)} />)}
            </View>
          </View>
        )}
      </Card>

      {isEmailAccount && (
        <Card>
          <T variant="subtitle">Senha</T>
          <Field label="Nova senha" value={newPw} onChangeText={setNewPw} secureTextEntry autoComplete="new-password" hint="Pelo menos 8 caracteres, com letras e números." />
          {pwMsg && <Notice tone={pwMsg.tone} text={pwMsg.text} />}
          <Button title="Trocar senha" kind="outline" onPress={changePassword} />
        </Card>
      )}
      {me.athlete && (
        <Button title="Responsáveis e autorização" kind="outline" onPress={() => router.push({ pathname: '/atleta/[id]', params: { id: me.athlete!.id } })} />
      )}
      <Button title="Sair da conta" kind="outline" onPress={signOut} />
      <Button title="Política de privacidade" kind="ghost" onPress={() => router.push('/privacidade')} />
      <Button title="Excluir minha conta" kind="ghost" onPress={() => router.push('/excluir-conta')} />
      <T variant="small" style={{ textAlign: 'center' }}>Versão {Constants.expoConfig?.version} · Feito com TechPoint</T>
    </Screen>
  );
}
