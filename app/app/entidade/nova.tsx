// Cadastro de nova entidade pelo próprio interessado (D55): entra funcionando e vai para análise.
import { useQueryClient } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { OrgForm, RepCard, emptyOrg, emptyRep, orgToDb, repToDb, validateOrg, validateRep, type OrgFields, type Rep } from '@/components/org-form';
import { Badge, Button, Card, Chip, Field, Notice, Screen, T, styles } from '@/components/ui';
import { digits, maskCpf, maskPhone, validCpf, validPhone } from '@/lib/br';
import { toFriendlyError } from '@/lib/errors';
import { useMe } from '@/lib/me';
import { supabase } from '@/lib/supabase';

const TERMS_VERSION = '2026-11-teste';
const steps = ['Seus dados', 'Entidade', 'Responsáveis', 'Termos'];

export default function NovaEntidade() {
  const me = useMe();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [admin, setAdmin] = useState({ full_name: me.profile?.full_name ?? '', cpf: '', phone: '', title: '' });
  const [org, setOrg] = useState<OrgFields>(emptyOrg);
  const [reps, setReps] = useState<Rep[]>([]);
  const [partners, setPartners] = useState<{ name: string; role: string }[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const next = () => {
    setError(null);
    if (step === 0) {
      if (admin.full_name.trim().length < 3) return setError('Informe seu nome completo.');
      if (!validCpf(admin.cpf)) return setError('Confira seu CPF: os dígitos não conferem.');
      if (!validPhone(admin.phone)) return setError('Informe seu telefone com DDD.');
      if (admin.title.trim().length < 2) return setError('Informe seu cargo na entidade.');
    }
    if (step === 1) {
      const e = validateOrg(org);
      if (e) return setError(e);
    }
    if (step === 2) {
      if (reps.length === 0) return setError('Informe pelo menos um responsável legal pelo CNPJ.');
      for (const r of reps) { const e = validateRep(r); if (e) return setError(e); }
    }
    setStep((s) => s + 1);
  };

  const addMeAsRep = () =>
    setReps((r) => [...r, { ...emptyRep, full_name: admin.full_name, cpf: admin.cpf, phone: admin.phone, role_title: admin.title, email: me.profile?.email ?? '', is_me: true }]);

  const submit = async () => {
    if (!accepted) return setError('É preciso aceitar os termos para concluir.');
    setSaving(true);
    setError(null);
    const { data, error: e } = await supabase.rpc('register_organization', {
      p_admin: { full_name: admin.full_name.trim(), cpf: digits(admin.cpf), phone: digits(admin.phone), title: admin.title.trim() },
      p_org: { ...orgToDb(org), cnpj: digits(org.cnpj), receita_status: org.receita_status || null },
      p_reps: reps.map((r) => ({ ...repToDb(r), is_me: Boolean(r.is_me) })),
      p_terms_version: TERMS_VERSION,
    });
    setSaving(false);
    if (e) return setError(toFriendlyError(e).message);
    await qc.invalidateQueries({ queryKey: ['me'] });
    me.setOrgId((data as { org_id: string }).org_id);
    me.setRole('admin');
    router.replace('/(tabs)');
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Cadastrar minha entidade' }} />
      <View style={styles.wrap}>
        {steps.map((s, i) => <Badge key={s} label={`${i + 1}. ${s}`} tone={i === step ? 'primary' : i < step ? 'success' : 'muted'} />)}
      </View>

      {step === 0 && (
        <Card>
          <T variant="subtitle">Seus dados (administrador)</T>
          <T variant="small">Você será o administrador da entidade no TechPoint. Depois pode convidar outros administradores.</T>
          <Field label="Nome completo" value={admin.full_name} onChangeText={(v) => setAdmin({ ...admin, full_name: v })} maxLength={160} />
          <Field label="CPF" keyboardType="number-pad" value={admin.cpf} onChangeText={(v) => setAdmin({ ...admin, cpf: maskCpf(v) })}
            error={admin.cpf.length === 14 && !validCpf(admin.cpf) ? 'CPF inválido' : undefined} />
          <Field label="Telefone (WhatsApp)" keyboardType="phone-pad" value={admin.phone} onChangeText={(v) => setAdmin({ ...admin, phone: maskPhone(v) })} />
          <Field label="Cargo na entidade" value={admin.title} onChangeText={(v) => setAdmin({ ...admin, title: v })} placeholder="Ex.: Presidente, Diretor esportivo" maxLength={80} />
          <Field label="E-mail (da sua conta Google)" value={me.profile?.email ?? ''} editable={false} />
        </Card>
      )}

      {step === 1 && <OrgForm value={org} onChange={setOrg} onPartners={setPartners} />}

      {step === 2 && (
        <View style={{ gap: 14 }}>
          <T variant="muted">Quem responde legalmente pelo CNPJ (quem assina pela entidade). Pode ser mais de uma pessoa.</T>
          {partners.length > 0 && (
            <Card>
              <T variant="small">Sócios/dirigentes na Receita (toque para adicionar):</T>
              <View style={styles.wrap}>
                {partners.map((p) => (
                  <Chip key={p.name} label={`+ ${p.name}`} onPress={() => setReps((r) => [...r, { ...emptyRep, full_name: p.name, role_title: p.role }])} />
                ))}
              </View>
            </Card>
          )}
          {!reps.some((r) => r.is_me) && <Button title="Eu sou um dos responsáveis legais" kind="outline" onPress={addMeAsRep} />}
          {reps.map((r, i) => (
            <RepCard key={i} value={r} onChange={(v) => setReps((all) => all.map((x, j) => (j === i ? v : x)))}
              onRemove={() => setReps((all) => all.filter((_, j) => j !== i))} />
          ))}
          <Button title="Adicionar responsável" kind="outline" onPress={() => setReps((r) => [...r, emptyRep])} />
        </View>
      )}

      {step === 3 && (
        <Card>
          <T variant="subtitle">Termos de uso (versão de teste)</T>
          <T variant="body">• Você declara que representa a entidade e que os dados informados são verdadeiros.</T>
          <T variant="body">• A entidade já pode usar o TechPoint. A equipe do TechPoint vai analisar o cadastro e pode entrar em contato pelo telefone informado.</T>
          <T variant="body">• Dados de atletas menores só podem ser usados com o consentimento dos responsáveis.</T>
          <T variant="body">• Fotos de check-in ficam guardadas por 24 meses.</T>
          <T variant="small">Os termos definitivos serão publicados antes do lançamento.</T>
          <Chip label={accepted ? '✓ Li e aceito' : 'Li e aceito'} selected={accepted} onPress={() => setAccepted(!accepted)} />
        </Card>
      )}

      {error && <Notice tone="danger" text={error} />}
      <View style={styles.row}>
        {step > 0 && <Button title="Voltar" kind="ghost" style={{ flex: 1 }} onPress={() => { setError(null); setStep(step - 1); }} />}
        {step < 3
          ? <Button title="Continuar" style={{ flex: 2 }} onPress={next} />
          : <Button title="Concluir cadastro" kind="accent" style={{ flex: 2 }} loading={saving} onPress={submit} />}
      </View>
    </Screen>
  );
}
