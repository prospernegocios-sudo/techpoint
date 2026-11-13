// Formulário dos dados da entidade (usado no cadastro inicial e na edição) e dos responsáveis legais.
import { DateField } from '@/components/date-field';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, Field, Notice, T, styles } from '@/components/ui';
import {
  UFS, digits, lookupCep, lookupCnpj, maskCep, maskCnpj, maskCpf, maskPhone, validCnpj, validCpf, validEmail, validPhone,
} from '@/lib/br';
import { parseBrDate, toIsoDate } from '@/lib/format';
import { isoDayToBr } from '@/lib/report';

export type OrgFields = {
  cnpj: string; legal_name: string; trade_name: string; state_registration: string; ie_exempt: boolean; municipal_registration: string;
  cep: string; street: string; street_number: string; complement: string; district: string; city: string; uf: string;
  phone: string; email: string; website: string; receita_status: string;
};
export const emptyOrg: OrgFields = {
  cnpj: '', legal_name: '', trade_name: '', state_registration: '', ie_exempt: false, municipal_registration: '',
  cep: '', street: '', street_number: '', complement: '', district: '', city: '', uf: '', phone: '', email: '', website: '', receita_status: '',
};

/** Converte o registro do banco para o formulário. */
export function orgFromDb(o: Record<string, string | null>): OrgFields {
  return {
    cnpj: maskCnpj(o.cnpj ?? ''), legal_name: o.legal_name ?? '', trade_name: o.trade_name ?? '',
    state_registration: o.state_registration === 'ISENTO' ? '' : o.state_registration ?? '', ie_exempt: o.state_registration === 'ISENTO',
    municipal_registration: o.municipal_registration ?? '', cep: maskCep(o.cep ?? ''), street: o.street ?? '', street_number: o.street_number ?? '',
    complement: o.complement ?? '', district: o.district ?? '', city: o.city ?? '', uf: o.uf ?? '', phone: maskPhone(o.phone ?? ''),
    email: o.email ?? '', website: o.website ?? '', receita_status: o.receita_status ?? '',
  };
}

/** Converte o formulário para gravar no banco. */
export function orgToDb(f: OrgFields) {
  const n = (s: string) => s.trim() || null;
  return {
    legal_name: n(f.legal_name), trade_name: n(f.trade_name),
    state_registration: f.ie_exempt ? 'ISENTO' : n(f.state_registration.toUpperCase()), municipal_registration: n(f.municipal_registration),
    cep: digits(f.cep) || null, street: n(f.street), street_number: n(f.street_number), complement: n(f.complement),
    district: n(f.district), city: n(f.city), uf: n(f.uf.toUpperCase()), phone: digits(f.phone) || null,
    email: f.email.trim().toLowerCase() || null, website: n(f.website),
  };
}

export function validateOrg(f: OrgFields): string | null {
  if (!validCnpj(f.cnpj)) return 'Confira o CNPJ: os dígitos não conferem.';
  if (f.legal_name.trim().length < 3) return 'Informe a razão social.';
  if (!f.ie_exempt && !f.state_registration.trim()) return 'Informe a Inscrição Estadual ou marque "Isento".';
  if (digits(f.cep).length !== 8) return 'Informe o CEP (8 números).';
  if (!f.street.trim() || !f.street_number.trim() || !f.city.trim() || !UFS.includes(f.uf.toUpperCase())) return 'Complete o endereço: rua, número, cidade e UF.';
  if (!validPhone(f.phone)) return 'Informe o telefone com DDD.';
  if (!validEmail(f.email)) return 'Confira o e-mail da entidade.';
  return null;
}

/** Erro de um campo, para mostrar ao lado dele assim que perde o foco (achado de UX nº 6). */
export function orgFieldError(f: OrgFields, k: keyof OrgFields): string | undefined {
  switch (k) {
    case 'cnpj': return validCnpj(f.cnpj) ? undefined : 'CNPJ inválido: confira os números.';
    case 'legal_name': return f.legal_name.trim().length >= 3 ? undefined : 'Informe a razão social.';
    case 'state_registration': return f.ie_exempt || f.state_registration.trim() ? undefined : 'Informe a IE ou marque "Isento".';
    case 'cep': return digits(f.cep).length === 8 ? undefined : 'CEP com 8 números.';
    case 'street': return f.street.trim() ? undefined : 'Informe a rua.';
    case 'street_number': return f.street_number.trim() ? undefined : 'Informe o número.';
    case 'city': return f.city.trim() ? undefined : 'Informe a cidade.';
    case 'uf': return UFS.includes(f.uf.toUpperCase()) ? undefined : 'UF inválida.';
    case 'phone': return validPhone(f.phone) ? undefined : 'Telefone com DDD.';
    case 'email': return validEmail(f.email) ? undefined : 'E-mail inválido.';
    default: return undefined;
  }
}

export function OrgForm({ value, onChange, cnpjLocked, onPartners }: {
  value: OrgFields; onChange: (v: OrgFields) => void; cnpjLocked?: boolean;
  onPartners?: (p: { name: string; role: string }[]) => void;
}) {
  const [info, setInfo] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<keyof OrgFields, boolean>>>({});
  const touch = (k: keyof OrgFields) => () => setTouched((t) => ({ ...t, [k]: true }));
  const err = (k: keyof OrgFields) => (touched[k] ? orgFieldError(value, k) : undefined);
  const set = (k: keyof OrgFields) => (v: string) => onChange({ ...value, [k]: v });

  const searchCnpj = async () => {
    if (!validCnpj(value.cnpj)) return setInfo('CNPJ inválido: confira os números.');
    setSearching(true);
    setInfo(null);
    const r = await lookupCnpj(value.cnpj);
    setSearching(false);
    if (!r) return setInfo('Não encontramos os dados públicos agora. Preencha à mão.');
    onChange({
      ...value, legal_name: r.legal_name || value.legal_name, trade_name: r.trade_name || value.trade_name,
      cep: maskCep(r.cep) || value.cep, street: r.street || value.street, street_number: r.street_number || value.street_number,
      complement: r.complement || value.complement, district: r.district || value.district, city: r.city || value.city,
      uf: r.uf || value.uf, phone: r.phone ? maskPhone(r.phone) : value.phone, email: r.email || value.email, receita_status: r.status,
    });
    onPartners?.(r.partners);
    setInfo(`Dados da Receita preenchidos. Situação cadastral: ${r.status || 'não informada'}. Confira tudo antes de salvar.`);
  };

  const onCep = async (v: string) => {
    const masked = maskCep(v);
    onChange({ ...value, cep: masked });
    if (digits(masked).length === 8) {
      const r = await lookupCep(masked);
      if (r) onChange({ ...value, cep: masked, street: r.street || value.street, district: r.district || value.district, city: r.city || value.city, uf: r.uf || value.uf });
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <T variant="subtitle">Entidade</T>
        <Field label="CNPJ" keyboardType="number-pad" value={value.cnpj} editable={!cnpjLocked}
          onChangeText={(v) => onChange({ ...value, cnpj: maskCnpj(v) })} placeholder="00.000.000/0000-00"
          onBlur={touch('cnpj')} error={(value.cnpj.length === 18 && !validCnpj(value.cnpj)) ? 'CNPJ inválido' : err('cnpj')} />
        {!cnpjLocked && <Button title="Buscar dados na Receita" kind="outline" loading={searching} onPress={searchCnpj} />}
        {info && <Notice tone="info" text={info} />}
        {value.receita_status !== '' && cnpjLocked && <T variant="small">Situação na Receita (último cadastro): {value.receita_status}</T>}
        <Field label="Razão social" onBlur={touch('legal_name')} error={err('legal_name')} value={value.legal_name} onChangeText={set('legal_name')} maxLength={200} />
        <Field label="Nome fantasia" value={value.trade_name} onChangeText={set('trade_name')} maxLength={200} />
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          <View style={{ flex: 1, minWidth: 180 }}>
            <Field label="Inscrição Estadual" onBlur={touch('state_registration')} error={err('state_registration')} value={value.ie_exempt ? 'ISENTO' : value.state_registration} editable={!value.ie_exempt}
              onChangeText={set('state_registration')} maxLength={30} />
          </View>
          <Chip label="Isento" selected={value.ie_exempt} onPress={() => onChange({ ...value, ie_exempt: !value.ie_exempt })} />
        </View>
        <Field label="Inscrição Municipal (opcional)" value={value.municipal_registration} onChangeText={set('municipal_registration')} maxLength={30} />
      </Card>
      <Card>
        <T variant="subtitle">Endereço</T>
        <Field label="CEP" onBlur={touch('cep')} error={err('cep')} keyboardType="number-pad" value={value.cep} onChangeText={onCep} placeholder="00000-000" />
        <Field label="Rua / avenida" onBlur={touch('street')} error={err('street')} value={value.street} onChangeText={set('street')} maxLength={200} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Field label="Número" onBlur={touch('street_number')} error={err('street_number')} value={value.street_number} onChangeText={set('street_number')} maxLength={20} /></View>
          <View style={{ flex: 2 }}><Field label="Complemento" value={value.complement} onChangeText={set('complement')} maxLength={100} /></View>
        </View>
        <Field label="Bairro" value={value.district} onChangeText={set('district')} maxLength={100} />
        <View style={styles.row}>
          <View style={{ flex: 3 }}><Field label="Cidade" onBlur={touch('city')} error={err('city')} value={value.city} onChangeText={set('city')} maxLength={100} /></View>
          <View style={{ flex: 1 }}><Field label="UF" onBlur={touch('uf')} error={err('uf')} value={value.uf} autoCapitalize="characters" onChangeText={(v) => set('uf')(v.toUpperCase().slice(0, 2))} /></View>
        </View>
      </Card>
      <Card>
        <T variant="subtitle">Contato</T>
        <Field label="Telefone" onBlur={touch('phone')} error={err('phone')} keyboardType="phone-pad" value={value.phone} onChangeText={(v) => onChange({ ...value, phone: maskPhone(v) })} placeholder="(61) 99999-0000" />
        <Field label="E-mail da entidade" onBlur={touch('email')} error={err('email')} keyboardType="email-address" autoCapitalize="none" value={value.email} onChangeText={set('email')}
          hint="A confirmação do e-mail por código será ligada antes do lançamento." />
        <Field label="Site (opcional)" autoCapitalize="none" value={value.website} onChangeText={set('website')} maxLength={200} />
      </Card>
    </View>
  );
}

// ---------------- Responsáveis legais ----------------
export type Rep = {
  id?: string; full_name: string; cpf: string; role_title: string; email: string; phone: string;
  term_start: string; term_end: string; is_me?: boolean;
};
export const emptyRep: Rep = { full_name: '', cpf: '', role_title: '', email: '', phone: '', term_start: '', term_end: '' };

export function repFromDb(r: Record<string, string | null>): Rep {
  return {
    id: r.id ?? undefined, full_name: r.full_name ?? '', cpf: maskCpf(r.cpf ?? ''), role_title: r.role_title ?? '', email: r.email ?? '',
    phone: maskPhone(r.phone ?? ''), term_start: r.term_start ? isoDayToBr(r.term_start) : '', term_end: r.term_end ? isoDayToBr(r.term_end) : '',
  };
}

export function repToDb(r: Rep) {
  const d = (s: string) => { const x = parseBrDate(s); return x ? toIsoDate(x) : null; };
  return {
    full_name: r.full_name.trim(), cpf: digits(r.cpf) || null, role_title: r.role_title.trim() || null,
    email: r.email.trim().toLowerCase() || null, phone: digits(r.phone) || null, term_start: d(r.term_start), term_end: d(r.term_end),
  };
}

export function validateRep(r: Rep): string | null {
  if (r.full_name.trim().length < 3) return 'Informe o nome do responsável.';
  if (r.cpf && !validCpf(r.cpf)) return `CPF de ${r.full_name || 'um responsável'} não confere.`;
  if (r.email && !validEmail(r.email)) return `Confira o e-mail de ${r.full_name}.`;
  if (r.phone && !validPhone(r.phone)) return `Confira o telefone de ${r.full_name}.`;
  if ((r.term_start && !parseBrDate(r.term_start)) || (r.term_end && !parseBrDate(r.term_end))) return 'Confira as datas do mandato (dd/mm/aaaa).';
  return null;
}

export function RepCard({ value, onChange, onRemove }: { value: Rep; onChange: (r: Rep) => void; onRemove?: () => void }) {
  const set = (k: keyof Rep) => (v: string) => onChange({ ...value, [k]: v });
  return (
    <Card>
      <Field label="Nome completo" value={value.full_name} onChangeText={set('full_name')} maxLength={160} />
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <View style={{ flex: 1, minWidth: 160 }}>
          <Field label="CPF" keyboardType="number-pad" value={value.cpf} onChangeText={(v) => onChange({ ...value, cpf: maskCpf(v) })}
            error={value.cpf.length === 14 && !validCpf(value.cpf) ? 'CPF inválido' : undefined} />
        </View>
        <View style={{ flex: 1, minWidth: 160 }}><Field label="Cargo" value={value.role_title} onChangeText={set('role_title')} placeholder="Presidente" maxLength={80} /></View>
      </View>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <View style={{ flex: 1, minWidth: 160 }}><Field label="E-mail" keyboardType="email-address" autoCapitalize="none" value={value.email} onChangeText={set('email')} /></View>
        <View style={{ flex: 1, minWidth: 160 }}><Field label="Telefone" keyboardType="phone-pad" value={value.phone} onChangeText={(v) => onChange({ ...value, phone: maskPhone(v) })} /></View>
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}><DateField mode="date" label="Início do mandato" value={value.term_start} onChange={(v) => set('term_start')(v)} /></View>
        <View style={{ flex: 1 }}><DateField mode="date" label="Fim do mandato" value={value.term_end} onChange={(v) => set('term_end')(v)} /></View>
      </View>
      {onRemove && <Button title="Remover responsável" kind="ghost" onPress={onRemove} />}
    </Card>
  );
}
