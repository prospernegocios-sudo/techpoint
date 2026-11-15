// Entidades cadastradas: análise posterior pela equipe TechPoint (D55). Só administradores da plataforma.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { toast } from '@/components/toast';
import { Badge, Button, Card, Field, Loading, Notice, Screen, T, styles } from '@/components/ui';
import { maskCnpj, maskCpf, maskPhone } from '@/lib/br';
import { toFriendlyError } from '@/lib/errors';
import { useMe } from '@/lib/me';
import { brDateTime } from '@/lib/report';
import { supabase } from '@/lib/supabase';

type Item = {
  org: Record<string, string | null> & { id: string; review_status: 'pending' | 'approved' | 'suspended' };
  admins: { full_name: string | null; email: string | null; title: string | null; phone: string | null; cpf: string | null }[];
  athletes: number; users: number;
};
const statusLabel = { pending: 'Em análise', approved: 'Verificada', suspended: 'Suspensa' } as const;

export default function Analise() {
  const me = useMe();
  const { isPlatformAdmin } = me;
  const modules = useQuery({ queryKey: ['all-modules'], enabled: isPlatformAdmin, queryFn: async () => ((await supabase.from('org_modules').select('org_id, module, status')).data ?? []) as { org_id: string; module: string; status: string }[] });
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['org-review'],
    enabled: isPlatformAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('platform_org_review_list');
      if (error) throw error;
      return data as Item[];
    },
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  if (!isPlatformAdmin) return <Screen><Notice tone="danger" text="Apenas a equipe TechPoint vê esta lista." /></Screen>;
  if (q.isLoading) return <Loading />;

  const review = async (it: Item, status: Item['org']['review_status']) => {
    setError(null);
    const { error: e } = await supabase.rpc('review_organization', { p_org_id: it.org.id, p_status: status, p_notes: notes[it.org.id] ?? it.org.review_notes ?? '' });
    if (e) return setError(toFriendlyError(e).message);
    qc.invalidateQueries({ queryKey: ['org-review'] });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Entidades cadastradas' }} />
      <T variant="muted">As entidades já funcionam ao se cadastrar. Aqui vocês fazem o contato, anotam e verificam ou suspendem (suspender bloqueia o acesso).</T>
      {error && <Notice tone="danger" text={error} />}
      {(q.data ?? []).map((it) => {
        const o = it.org;
        return (
          <Card key={o.id}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <T variant="subtitle" style={{ flex: 1 }}>{o.trade_name || o.name}</T>
              <Badge label={statusLabel[o.review_status]} tone={o.review_status === 'approved' ? 'success' : o.review_status === 'pending' ? 'warning' : 'danger'} />
            </View>
            <T variant="small">{o.legal_name}{o.cnpj ? ` · CNPJ ${maskCnpj(o.cnpj)}` : ''}{o.receita_status ? ` · Receita: ${o.receita_status}` : ''}</T>
            <T variant="small">{[o.city, o.uf].filter(Boolean).join('/')}{o.phone ? ` · ${maskPhone(o.phone)}` : ''}{o.email ? ` · ${o.email}` : ''}</T>
            <T variant="small">{it.athletes} atleta(s) ativo(s) · {it.users} usuário(s) · cadastrada {o.created_via === 'self_signup' ? 'pela própria entidade' : 'pela equipe'} em {brDateTime(o.created_at!)}</T>
            {it.admins.map((a, i) => (
              <View key={i} style={{ gap: 4 }}>
                <T variant="body">Administrador: {a.full_name}{a.title ? ` (${a.title})` : ''}</T>
                <T variant="small">{[a.email, a.phone && maskPhone(a.phone), a.cpf && `CPF ${maskCpf(a.cpf)}`].filter(Boolean).join(' · ')}</T>
                {a.phone && (
                  <Button title="Chamar no WhatsApp" kind="outline"
                    onPress={() => Linking.openURL(`https://wa.me/55${a.phone}?text=${encodeURIComponent(`Olá, ${a.full_name?.split(' ')[0] ?? ''}! Aqui é da equipe TechPoint. Vimos o cadastro da ${o.trade_name || o.name} e queremos te ajudar a começar.`)}`)} />
                )}
              </View>
            ))}
            <Field label="Anotações do contato" value={notes[o.id] ?? o.review_notes ?? ''} onChangeText={(v) => setNotes({ ...notes, [o.id]: v })} multiline maxLength={4000} />
            {o.reviewed_at && <T variant="small">Última análise: {brDateTime(o.reviewed_at)}</T>}
            <View style={styles.row}>
              <Button title="Entrar nesta entidade" style={{ flex: 1 }} onPress={() => { me.setOrgId(o.id); me.setMode('team'); router.replace('/(tabs)'); }} />
            </View>
            {(() => {
              const on = (modules.data ?? []).some((m) => m.org_id === o.id && m.module === 'investimentos' && m.status !== 'suspended');
              return (
                <View style={[styles.row, { justifyContent: 'space-between' }]}>
                  <T variant="small" style={{ flex: 1 }}>Módulo Gestão de Investimentos: <T variant="small" style={{ fontWeight: '800' }}>{on ? 'contratado' : 'desligado'}</T></T>
                  <Button title={on ? 'Desligar' : 'Ligar'} kind="outline" onPress={async () => {
                    const { error: e } = await supabase.rpc('set_org_module', { p_org_id: o.id, p_module: 'investimentos', p_status: on ? 'suspended' : 'active' });
                    if (e) return setError(toFriendlyError(e).message);
                    toast(on ? 'Módulo desligado.' : 'Módulo ligado.'); modules.refetch(); me.refetch();
                  }} />
                </View>
              );
            })()}
            <View style={styles.wrap}>
              <Button title="Verificar" onPress={() => review(it, 'approved')} />
              <Button title="Manter em análise" kind="outline" onPress={() => review(it, 'pending')} />
              <Button title="Suspender" kind="danger" onPress={() => review(it, 'suspended')} />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
