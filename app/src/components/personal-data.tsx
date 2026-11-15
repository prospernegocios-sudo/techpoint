// Formulários de "Meus dados": dados pessoais e endereço (com CEP automático), esporte e corpo do atleta.
// CPF e endereço são opcionais (D78, 1a); altura/peso/mão só atleta e responsáveis veem (3a).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { Button, Card, Chip, Field, Loading, Notice, T, styles } from '@/components/ui';
import { UFS, digits, lookupCep, maskCep, maskCpf, maskPhone, validCpf, validPhone } from '@/lib/br';
import { maskMonthYear, parseMonthYear, toMonthYear } from '@/lib/cv';
import { toFriendlyError } from '@/lib/errors';
import { isoDayToBr } from '@/lib/report';
import { supabase } from '@/lib/supabase';

type Addr = { cep: string; street: string; street_number: string; complement: string; district: string; city: string; uf: string };
const emptyAddr: Addr = { cep: '', street: '', street_number: '', complement: '', district: '', city: '', uf: '' };
const addrFrom = (r: Partial<Record<keyof Addr, string | null>> | null): Addr =>
  Object.fromEntries(Object.keys(emptyAddr).map((k) => [k, (r?.[k as keyof Addr] ?? '') as string])) as Addr;
const addrRow = (a: Addr) => ({
  cep: digits(a.cep) || null, street: a.street.trim() || null, street_number: a.street_number.trim() || null,
  complement: a.complement.trim() || null, district: a.district.trim() || null, city: a.city.trim() || null, uf: a.uf || null,
});

function AddressFields({ a, set }: { a: Addr; set: (a: Addr) => void }) {
  const [looking, setLooking] = useState(false);
  const onCep = async (v: string) => {
    const masked = maskCep(v);
    set({ ...a, cep: masked });
    if (digits(masked).length === 8) {
      setLooking(true);
      const info = await lookupCep(masked);
      setLooking(false);
      if (info) set({ ...a, cep: masked, street: info.street || a.street, district: info.district || a.district, city: info.city || a.city, uf: info.uf || a.uf });
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <Field label="CEP" keyboardType="number-pad" value={a.cep} onChangeText={onCep} hint={looking ? 'Buscando endereço...' : 'Preenche rua, bairro, cidade e estado sozinho.'} />
      <Field label="Rua" value={a.street} onChangeText={(v) => set({ ...a, street: v })} maxLength={160} />
      <View style={styles.row}>
        <View style={{ flex: 1 }}><Field label="Número" value={a.street_number} onChangeText={(v) => set({ ...a, street_number: v })} maxLength={20} /></View>
        <View style={{ flex: 2 }}><Field label="Complemento" value={a.complement} onChangeText={(v) => set({ ...a, complement: v })} maxLength={80} /></View>
      </View>
      <Field label="Bairro" value={a.district} onChangeText={(v) => set({ ...a, district: v })} maxLength={80} />
      <View style={styles.row}>
        <View style={{ flex: 3 }}><Field label="Cidade" value={a.city} onChangeText={(v) => set({ ...a, city: v })} maxLength={80} /></View>
        <View style={{ flex: 1 }}><Field label="UF" autoCapitalize="characters" maxLength={2} value={a.uf} onChangeText={(v) => set({ ...a, uf: v.toUpperCase() })} /></View>
      </View>
    </View>
  );
}

const checkCommon = (cpf: string, phone: string, a: Addr): string | null => {
  if (cpf && !validCpf(cpf)) return 'CPF inválido. Confira os números.';
  if (phone && !validPhone(phone)) return 'Telefone inválido. Use DDD + número.';
  if (a.uf && !UFS.includes(a.uf)) return 'UF inválida.';
  if (a.cep && digits(a.cep).length !== 8) return 'CEP precisa ter 8 números.';
  return null;
};

/** Dados da própria conta (responsável, treinador, gestor). */
export function MyDataForm({ profileId, name }: { profileId: string; name: string | null }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['my-private', profileId],
    queryFn: async () => {
      const { data, error } = await supabase.from('profile_private').select('*').eq('profile_id', profileId).maybeSingle();
      if (error) throw error;
      return data as Record<string, string | null> | null;
    },
  });
  const [f, setF] = useState({ name: name ?? '', cpf: '', phone: '', birth: '' });
  const [a, setA] = useState<Addr>(emptyAddr);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  useEffect(() => {
    if (!q.data) return;
    setF((x) => ({ ...x, cpf: q.data?.cpf ? maskCpf(q.data.cpf) : '', phone: q.data?.phone ? maskPhone(q.data.phone) : '', birth: q.data?.birth_date ? isoDayToBr(q.data.birth_date) : '' }));
    setA(addrFrom(q.data));
  }, [q.data]);
  if (q.isLoading) return <Loading />;

  const save = async () => {
    setMsg(null);
    const err = checkCommon(f.cpf, f.phone, a);
    if (err) return setMsg({ tone: 'danger', text: err });
    let birth: string | null = null;
    if (f.birth.trim()) {
      const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(f.birth.trim());
      if (!m) return setMsg({ tone: 'danger', text: 'Data de nascimento no formato dd/mm/aaaa.' });
      birth = `${m[3]}-${m[2]}-${m[1]}`;
    }
    if (f.name.trim().length >= 3 && f.name.trim() !== name) {
      const { error } = await supabase.from('profiles').update({ full_name: f.name.trim() }).eq('id', profileId);
      if (error) return setMsg({ tone: 'danger', text: toFriendlyError(error).message });
    }
    const { error } = await supabase.from('profile_private').upsert({
      profile_id: profileId, cpf: digits(f.cpf) || null, phone: digits(f.phone) || null, birth_date: birth, ...addrRow(a), updated_at: new Date().toISOString(),
    });
    if (error) return setMsg({ tone: 'danger', text: toFriendlyError(error).message });
    setMsg({ tone: 'success', text: 'Dados salvos.' });
    qc.invalidateQueries({ queryKey: ['my-private', profileId] });
    qc.invalidateQueries({ queryKey: ['me'] });
  };

  return (
    <Card>
      <T variant="subtitle">Dados pessoais</T>
      <T variant="small">CPF e endereço são opcionais. O app só pede quando alguma função precisar.</T>
      <Field label="Nome completo" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} maxLength={120} />
      <View style={styles.row}>
        <View style={{ flex: 1 }}><Field label="CPF" keyboardType="number-pad" value={f.cpf} onChangeText={(v) => setF({ ...f, cpf: maskCpf(v) })} /></View>
        <View style={{ flex: 1 }}><Field label="Nascimento" keyboardType="number-pad" placeholder="dd/mm/aaaa" value={f.birth} maxLength={10}
          onChangeText={(v) => { const d = v.replace(/\D/g, '').slice(0, 8); setF({ ...f, birth: [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/') }); }} /></View>
      </View>
      <Field label="Celular (WhatsApp)" keyboardType="phone-pad" value={f.phone} onChangeText={(v) => setF({ ...f, phone: maskPhone(v) })} />
      <T variant="subtitle">Endereço</T>
      <AddressFields a={a} set={setA} />
      {msg && <Notice tone={msg.tone} text={msg.text} />}
      <Button title="Salvar meus dados" kind="accent" onPress={save} />
    </Card>
  );
}

const HANDS = [{ k: 'direita', l: 'Destro' }, { k: 'esquerda', l: 'Canhoto' }, { k: 'ambas', l: 'Ambidestro' }];

/** Dados do atleta: pessoais, endereço, esporte e (para atleta/responsável) corpo. */
export function AthleteDataForm({ athleteId, orgId, birthDate, canSeeBody }: { athleteId: string; orgId: string; birthDate: string; canSeeBody: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['athlete-details', athleteId],
    queryFn: async () => {
      const [d, b] = await Promise.all([
        supabase.from('athlete_details').select('*').eq('athlete_id', athleteId).maybeSingle(),
        canSeeBody ? supabase.from('athlete_body').select('*').eq('athlete_id', athleteId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);
      if (d.error) throw d.error;
      return { d: d.data as Record<string, string | null> | null, b: b.data as { height_cm: number | null; weight_kg: number | null; dominant_hand: string | null; show_in_cv: boolean } | null };
    },
  });
  const [f, setF] = useState({ cpf: '', phone: '', modality: '', position: '', started: '' });
  const [a, setA] = useState<Addr>(emptyAddr);
  const [body, setBody] = useState({ height: '', weight: '', hand: '', show: false });
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  useEffect(() => {
    if (!q.data) return;
    const d = q.data.d;
    setF({ cpf: d?.cpf ? maskCpf(d.cpf) : '', phone: d?.phone ? maskPhone(d.phone) : '', modality: d?.modality ?? '', position: d?.position ?? '', started: toMonthYear(d?.sport_started_on) });
    setA(addrFrom(d));
    const b = q.data.b;
    setBody({ height: b?.height_cm ? String(b.height_cm) : '', weight: b?.weight_kg ? String(b.weight_kg).replace('.', ',') : '', hand: b?.dominant_hand ?? '', show: b?.show_in_cv ?? false });
  }, [q.data]);
  if (q.isLoading) return <Loading />;

  const save = async () => {
    setMsg(null);
    const err = checkCommon(f.cpf, f.phone, a);
    if (err) return setMsg({ tone: 'danger', text: err });
    const started = f.started.trim() ? parseMonthYear(f.started) : null;
    if (f.started.trim() && !started) return setMsg({ tone: 'danger', text: 'Início no esporte no formato mês/ano (ex.: 03/2019).' });
    const { error } = await supabase.from('athlete_details').upsert({
      athlete_id: athleteId, org_id: orgId, cpf: digits(f.cpf) || null, phone: digits(f.phone) || null, ...addrRow(a),
      modality: f.modality.trim() || null, position: f.position.trim() || null, sport_started_on: started, updated_at: new Date().toISOString(),
    });
    if (error) return setMsg({ tone: 'danger', text: toFriendlyError(error).message });
    if (canSeeBody) {
      const h = body.height ? Number(body.height) : null;
      const w = body.weight ? Number(body.weight.replace(',', '.')) : null;
      if ((h != null && (!Number.isInteger(h) || h < 80 || h > 250)) || (w != null && (Number.isNaN(w) || w < 15 || w > 250))) {
        return setMsg({ tone: 'danger', text: 'Confira altura (em cm) e peso (em kg).' });
      }
      const { error: e2 } = await supabase.from('athlete_body').upsert({ athlete_id: athleteId, height_cm: h, weight_kg: w, dominant_hand: body.hand || null, show_in_cv: body.show, updated_at: new Date().toISOString() });
      if (e2) return setMsg({ tone: 'danger', text: toFriendlyError(e2).message });
    }
    setMsg({ tone: 'success', text: 'Dados salvos.' });
    qc.invalidateQueries({ queryKey: ['athlete-details', athleteId] });
    qc.invalidateQueries({ queryKey: ['cv', athleteId] });
  };

  return (
    <>
      <Card>
        <T variant="subtitle">Dados pessoais</T>
        <T variant="small">Nascimento: {isoDayToBr(birthDate)} (a entidade corrige, se estiver errado). CPF e endereço são opcionais.</T>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Field label="CPF" keyboardType="number-pad" value={f.cpf} onChangeText={(v) => setF({ ...f, cpf: maskCpf(v) })} /></View>
          <View style={{ flex: 1 }}><Field label="Celular" keyboardType="phone-pad" value={f.phone} onChangeText={(v) => setF({ ...f, phone: maskPhone(v) })} /></View>
        </View>
        <T variant="subtitle">Endereço</T>
        <AddressFields a={a} set={setA} />
      </Card>
      <Card>
        <T variant="subtitle">Esporte</T>
        <Field label="Modalidade" value={f.modality} onChangeText={(v) => setF({ ...f, modality: v })} maxLength={60} placeholder="Ex.: Vôlei de praia" />
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Field label="Posição" value={f.position} onChangeText={(v) => setF({ ...f, position: v })} maxLength={60} placeholder="Ex.: Levantador" /></View>
          <View style={{ flex: 1 }}><Field label="Início no esporte" keyboardType="number-pad" placeholder="mm/aaaa" value={f.started} onChangeText={(v) => setF({ ...f, started: maskMonthYear(v) })} /></View>
        </View>
        {canSeeBody && (
          <View style={{ gap: 8 }}>
            <T variant="subtitle">Físico (opcional)</T>
            <View style={styles.row}>
              <View style={{ flex: 1 }}><Field label="Altura (cm)" keyboardType="number-pad" value={body.height} onChangeText={(v) => setBody({ ...body, height: v.replace(/\D/g, '').slice(0, 3) })} /></View>
              <View style={{ flex: 1 }}><Field label="Peso (kg)" keyboardType="decimal-pad" value={body.weight} onChangeText={(v) => setBody({ ...body, weight: v.replace(/[^\d,]/g, '').slice(0, 5) })} /></View>
            </View>
            <View style={styles.wrap}>{HANDS.map((h) => <Chip key={h.k} label={h.l} selected={body.hand === h.k} onPress={() => setBody({ ...body, hand: body.hand === h.k ? '' : h.k })} />)}</View>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <T variant="small" style={{ flex: 1 }}>Mostrar altura, peso e mão no currículo (a equipe e quem receber o link passam a ver)</T>
              <Switch accessibilityLabel="Mostrar físico no currículo" value={body.show} onValueChange={(v) => setBody({ ...body, show: v })} />
            </View>
          </View>
        )}
      </Card>
      {msg && <Notice tone={msg.tone} text={msg.text} />}
      <Button title="Salvar dados do atleta" kind="accent" onPress={save} />
    </>
  );
}
