// Dirigentes da entidade (relação nominal do Anexo IX). Dados pessoais com acesso restrito:
// só gestor e administrador; leitura e gravação pelo servidor, e cada consulta fica no histórico.
import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { DateField } from '@/components/date-field';
import { toast } from '@/components/toast';
import { Badge, Button, Card, Chip, Field, Loading, Notice, Screen, T } from '@/components/ui';
import { digits, maskCpf, maskPhone, validCpf, validEmail, validPhone } from '@/lib/br';
import { toFriendlyError } from '@/lib/errors';
import { parseBrDate, toIsoDate } from '@/lib/format';
import { deleteOfficer, saveOfficer, useOfficers, type Officer } from '@/lib/habilitation';
import { useMe } from '@/lib/me';

type Form = { id?: string; full_name: string; role_title: string; cpf: string; rg: string; rg_issuer: string; birth_date: string;
  address: string; phone: string; email: string; term_start: string; term_end: string; is_signatory: boolean };
const EMPTY: Form = { full_name: '', role_title: '', cpf: '', rg: '', rg_issuer: '', birth_date: '', address: '', phone: '', email: '', term_start: '', term_end: '', is_signatory: false };
const ROLES = ['Presidente', 'Vice-presidente', 'Diretor(a) financeiro(a)', 'Secretário(a)', 'Diretor(a) técnico(a)'];
const br = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');
const iso = (s: string) => { const d = parseBrDate(s); return d ? toIsoDate(d) : ''; };

export default function Dirigentes() {
  const me = useMe();
  const orgId = me.org?.id;
  const allowed = (me.isManager || me.isPlatformAdmin) && me.hasModule('investimentos');
  const q = useOfficers(allowed ? orgId : undefined);
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [busy, setBusy] = useState(false);

  if (!allowed) return <Screen><Stack.Screen options={{ title: 'Dirigentes' }} /><Notice tone="info" text="Disponível para gestores e administradores com o módulo de Gestão de Investimentos." /></Screen>;
  if (q.isLoading) return <Loading />;
  const list = q.data ?? [];
  const set = <K extends keyof Form>(k: K, val: Form[K]) => setForm((f) => (f ? { ...f, [k]: val } : f));

  const edit = (o: Officer) => setForm({
    id: o.id, full_name: o.full_name, role_title: o.role_title, cpf: o.cpf ? maskCpf(o.cpf) : '', rg: o.rg ?? '', rg_issuer: o.rg_issuer ?? '',
    birth_date: br(o.birth_date), address: o.address ?? '', phone: o.phone ? maskPhone(o.phone) : '', email: o.email ?? '',
    term_start: br(o.term_start), term_end: br(o.term_end), is_signatory: o.is_signatory,
  });

  const save = async () => {
    if (!form) return;
    const e: typeof errors = {};
    if (form.full_name.trim().length < 3) e.full_name = 'Informe o nome completo.';
    if (form.role_title.trim().length < 2) e.role_title = 'Informe o cargo.';
    if (form.cpf && !validCpf(form.cpf)) e.cpf = 'CPF inválido.';
    if (form.phone && !validPhone(form.phone)) e.phone = 'Telefone com DDD.';
    if (form.email && !validEmail(form.email)) e.email = 'E-mail inválido.';
    if (form.birth_date && !iso(form.birth_date)) e.birth_date = 'Data inválida.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      // Só um dirigente assina: ao marcar este, os outros deixam de ser o signatário.
      if (form.is_signatory) {
        for (const o of list.filter((x) => x.is_signatory && x.id !== form.id)) await saveOfficer(orgId!, { ...o, is_signatory: false });
      }
      await saveOfficer(orgId!, {
        id: form.id, full_name: form.full_name.trim(), role_title: form.role_title.trim(), cpf: digits(form.cpf) || null,
        rg: form.rg, rg_issuer: form.rg_issuer, birth_date: iso(form.birth_date) || null, address: form.address,
        phone: digits(form.phone) || null, email: form.email.trim().toLowerCase() || null,
        term_start: iso(form.term_start) || null, term_end: iso(form.term_end) || null, is_signatory: form.is_signatory,
      });
      toast('Dirigente salvo.');
      setForm(null);
      qc.invalidateQueries({ queryKey: ['org-officers', orgId] });
    } catch (err) { toast(toFriendlyError(err).message, 'danger'); }
    finally { setBusy(false); }
  };

  const remove = (o: Officer) => {
    const go = async () => {
      try { await deleteOfficer(o.id); toast('Dirigente removido.'); qc.invalidateQueries({ queryKey: ['org-officers', orgId] }); }
      catch (err) { toast(toFriendlyError(err).message, 'danger'); }
    };
    if (Platform.OS === 'web') { if (window.confirm(`Remover ${o.full_name}?`)) go(); }
    else Alert.alert(`Remover ${o.full_name}?`, undefined, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Remover', style: 'destructive', onPress: go }]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Dirigentes' }} />
      <T variant="title">Dirigentes da entidade</T>
      <Notice tone="info" text="Dados pessoais protegidos: só gestores e administradores veem, e cada consulta fica registrada no histórico da entidade." />
      <T variant="small">Cadastre todos os dirigentes conforme o estatuto. Eles entram na relação do Anexo IX, e quem assina pela entidade preenche as demais declarações.</T>

      {!form && <Button icon="person-add-outline" title="Adicionar dirigente" onPress={() => { setErrors({}); setForm({ ...EMPTY, is_signatory: list.length === 0 }); }} />}

      {form && (
        <Card style={{ gap: 12 }}>
          <T variant="body" style={{ fontWeight: '700' }}>{form.id ? 'Editar dirigente' : 'Novo dirigente'}</T>
          <Field label="Nome completo" value={form.full_name} onChangeText={(t) => set('full_name', t)} error={errors.full_name} />
          <Field label="Cargo (conforme o estatuto)" value={form.role_title} onChangeText={(t) => set('role_title', t)} error={errors.role_title} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ROLES.map((r) => <Chip key={r} label={r} selected={form.role_title === r} onPress={() => set('role_title', r)} />)}
          </View>
          <Field label="CPF" value={form.cpf} onChangeText={(t) => set('cpf', maskCpf(t))} keyboardType="number-pad" error={errors.cpf} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <View style={{ flexGrow: 1, flexBasis: 160 }}><Field label="RG" value={form.rg} onChangeText={(t) => set('rg', t)} /></View>
            <View style={{ flexGrow: 1, flexBasis: 140 }}><Field label="Órgão expedidor" value={form.rg_issuer} onChangeText={(t) => set('rg_issuer', t.toUpperCase())} placeholder="SSP/DF" /></View>
          </View>
          <DateField label="Data de nascimento" mode="date" value={form.birth_date} onChange={(t) => set('birth_date', t)} placeholder="dd/mm/aaaa" error={errors.birth_date} />
          <Field label="Endereço residencial" value={form.address} onChangeText={(t) => set('address', t)} placeholder="Rua, número, bairro, cidade/UF, CEP" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <View style={{ flexGrow: 1, flexBasis: 160 }}><Field label="Telefone" value={form.phone} onChangeText={(t) => set('phone', maskPhone(t))} keyboardType="phone-pad" error={errors.phone} /></View>
            <View style={{ flexGrow: 1, flexBasis: 200 }}><Field label="E-mail" value={form.email} onChangeText={(t) => set('email', t)} keyboardType="email-address" autoCapitalize="none" error={errors.email} /></View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <View style={{ flexGrow: 1, flexBasis: 160 }}><DateField label="Início do mandato" mode="date" value={form.term_start} onChange={(t) => set('term_start', t)} placeholder="dd/mm/aaaa" /></View>
            <View style={{ flexGrow: 1, flexBasis: 160 }}><DateField label="Fim do mandato" mode="date" value={form.term_end} onChange={(t) => set('term_end', t)} placeholder="dd/mm/aaaa" /></View>
          </View>
          <Chip label="Assina pela entidade (representante legal)" selected={form.is_signatory} onPress={() => set('is_signatory', !form.is_signatory)} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Button title="Salvar" onPress={save} loading={busy} />
            <Button kind="outline" title="Cancelar" onPress={() => setForm(null)} />
          </View>
        </Card>
      )}

      {list.length === 0 && !form && <Notice text="Nenhum dirigente cadastrado ainda." />}
      {list.map((o) => (
        <Card key={o.id} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <T variant="body" style={{ fontWeight: '700', flexShrink: 1 }}>{o.full_name}</T>
            {o.is_signatory && <Badge label="Assina" tone="primary" />}
          </View>
          <T variant="small">{o.role_title}{o.term_end ? ` · mandato até ${br(o.term_end)}` : ''}</T>
          <T variant="small">CPF {o.cpf ? maskCpf(o.cpf) : '—'} · RG {o.rg ? `${o.rg}${o.rg_issuer ? ` ${o.rg_issuer}` : ''}` : '—'}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
            <Button kind="tonal" icon="create-outline" title="Editar" onPress={() => { setErrors({}); edit(o); }} />
            <Button kind="outline" icon="trash-outline" title="Remover" onPress={() => remove(o)} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
