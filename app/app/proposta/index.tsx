// Projetos Técnicos (Revelar Talentos): lista e criação. Gestor/administrador com o módulo Gestão de Investimentos.
import { useQueryClient } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { toast } from '@/components/toast';
import { Badge, Button, Card, Chip, Field, Loading, Notice, Screen, T } from '@/components/ui';
import { toFriendlyError } from '@/lib/errors';
import { useMe } from '@/lib/me';
import { AXES, axisCheck, brl, createProposal, useProposals, type Axis } from '@/lib/proposal';

const STATUS: Record<string, { label: string; tone: 'muted' | 'primary' | 'success' | 'warning' }> = {
  rascunho: { label: 'Rascunho', tone: 'muted' }, enviada: { label: 'Enviada', tone: 'primary' }, aprovada: { label: 'Aprovada', tone: 'success' }, arquivada: { label: 'Arquivada', tone: 'warning' },
};

export default function Propostas() {
  const me = useMe();
  const orgId = me.org?.id;
  const allowed = (me.isManager || me.isPlatformAdmin) && me.hasModule('investimentos');
  const q = useProposals(allowed ? orgId : undefined);
  const qc = useQueryClient();
  const [form, setForm] = useState<{ title: string; axis: Axis } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!allowed) return <Screen><Stack.Screen options={{ title: 'Projeto Técnico' }} /><Notice tone="info" text="Disponível para gestores e administradores com o módulo de Gestão de Investimentos." /></Screen>;
  if (q.isLoading) return <Loading />;

  const create = async () => {
    if (!form || form.title.trim().length < 3) { toast('Dê um nome ao projeto.', 'danger'); return; }
    setBusy(true);
    try {
      const id = await createProposal(orgId!, form.title.trim(), form.axis);
      qc.invalidateQueries({ queryKey: ['proposals', orgId] });
      setForm(null);
      router.push({ pathname: '/proposta/[id]', params: { id } });
    } catch (e) { toast(toFriendlyError(e).message, 'danger'); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Projeto Técnico' }} />
      <T variant="title">Projeto Técnico</T>
      <T variant="small">Monte o Projeto Técnico / Plano de Trabalho do Revelar Talentos no modelo do Ministério: textos, público-alvo, metas, orçamento com 3 cotações e cronogramas. Sai em Word e em planilha.</T>
      {!form && <Button icon="add" title="Novo Projeto Técnico" onPress={() => setForm({ title: '', axis: 'nucleo' })} />}
      {form && (
        <Card style={{ gap: 10 }}>
          <Field label="Nome do projeto" value={form.title} onChangeText={(t) => setForm({ ...form, title: t })} placeholder="Ex.: Núcleo de vôlei de base 2027" />
          <T variant="small" style={{ fontWeight: '700' }}>Eixo</T>
          <View style={{ gap: 8 }}>
            {AXES.map((a) => <Chip key={a.key} label={`${a.label} (${brl(a.min)} a ${brl(a.max)})`} selected={form.axis === a.key} onPress={() => setForm({ ...form, axis: a.key })} />)}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Button title="Criar" onPress={create} loading={busy} />
            <Button kind="outline" title="Cancelar" onPress={() => setForm(null)} />
          </View>
        </Card>
      )}
      {(q.data ?? []).length === 0 && !form && <Notice tone="info" text="Nenhum Projeto Técnico ainda." />}
      {(q.data ?? []).map((p) => {
        const st = STATUS[p.status];
        const ax = axisCheck(p.axis, Number(p.mesp_value));
        return (
          <Card key={p.id} onPress={() => router.push({ pathname: '/proposta/[id]', params: { id: p.id } })} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <T variant="body" style={{ fontWeight: '700', flexShrink: 1 }}>{p.title}</T>
              <Badge label={st.label} tone={st.tone} />
            </View>
            <T variant="small">{AXES.find((a) => a.key === p.axis)?.label} · {brl(Number(p.mesp_value))}{Number(p.counterpart_value) ? ` + contrapartida ${brl(Number(p.counterpart_value))}` : ''}{p.months ? ` · ${p.months} meses` : ''}</T>
            {!ax.ok && Number(p.mesp_value) > 0 && <Badge label="Valor fora da faixa do eixo" tone="warning" />}
          </Card>
        );
      })}
    </Screen>
  );
}
