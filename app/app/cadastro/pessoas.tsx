// Administradores, gestores e treinadores: o acesso é dado pelo e-mail Google da pessoa.
// Só administrador dá ou tira acesso de administrador (regra também no banco).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Badge, Button, Card, Chip, Field, Notice, Screen, T, styles } from '@/components/ui';
import { toFriendlyError } from '@/lib/errors';
import { roleLabels, useMe, type Role } from '@/lib/me';
import { supabase } from '@/lib/supabase';

type Row = { id: string; role: Role; invited_email: string | null; profile_id: string | null; profiles: { full_name: string | null; email: string | null } | null };

export default function Pessoas() {
  const { org, isManager, isAdmin, profile } = useMe();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['memberships', org?.id],
    enabled: Boolean(org),
    queryFn: async () => {
      const { data, error } = await supabase.from('memberships').select('id, role, invited_email, profile_id, profiles(full_name, email)')
        .eq('org_id', org!.id).in('role', ['admin', 'manager', 'coach']).eq('active', true).order('role');
      if (error) throw error;
      return data as unknown as Row[];
    },
  });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('coach');
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    const mail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return setError('E-mail inválido.');
    setError(null);
    const { error: e } = await supabase.from('memberships').insert({ org_id: org!.id, invited_email: mail, role });
    if (e) return setError(/duplicate|unique/i.test(e.message) ? 'Essa pessoa já tem esse papel.' : toFriendlyError(e).message);
    setEmail('');
    qc.invalidateQueries({ queryKey: ['memberships'] });
  };

  const remove = (r: Row) => {
    if (r.profile_id === profile?.id && r.role !== 'admin') return Alert.alert('Atenção', 'Você não pode remover o seu próprio acesso.');
    if (r.role === 'admin' && !isAdmin) return Alert.alert('Atenção', 'Só um administrador remove outro administrador.');
    Alert.alert('Remover acesso?', 'A pessoa deixa de ver os dados desta entidade.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        const { error: e } = await supabase.from('memberships').update({ active: false }).eq('id', r.id);
        if (e) Alert.alert('Erro', toFriendlyError(e).message);
        qc.invalidateQueries({ queryKey: ['memberships'] });
      } },
    ]);
  };

  if (!isManager) return <Screen><Notice tone="danger" text="Apenas o gestor gerencia acessos." /></Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Pessoas com acesso' }} />
      <Card>
        <T variant="subtitle">Dar acesso</T>
        <Field label="E-mail Google da pessoa" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <View style={styles.wrap}>
          {((isAdmin ? ['coach', 'manager', 'admin'] : ['coach', 'manager']) as Role[]).map((r) => <Chip key={r} label={roleLabels[r]} selected={role === r} onPress={() => setRole(r)} />)}
        </View>
        {error && <Notice tone="danger" text={error} />}
        <Button title="Adicionar" onPress={add} />
        <T variant="small">Quando a pessoa entrar no app com esse e-mail, o acesso é liberado automaticamente.</T>
        {isAdmin && <T variant="small">Administrador: responde pela entidade, edita os dados do CNPJ e gerencia outros administradores. Cada entidade pode ter vários; o último não pode ser removido.</T>}
      </Card>
      {(list.data ?? []).map((r) => (
        <Card key={r.id} onPress={() => remove(r)}>
          <T variant="subtitle">{r.profiles?.full_name ?? r.invited_email}</T>
          <T variant="muted">{r.profiles?.email ?? r.invited_email}</T>
          <View style={styles.wrap}>
            <Badge label={roleLabels[r.role]} tone="primary" />
            {!r.profile_id && <Badge label="Aguardando 1º login" tone="warning" />}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
