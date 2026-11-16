// Passos do Projeto Técnico (Fase B do incentivo). Cada passo grava sozinho e avisa com o pop-up.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { DateField } from '@/components/date-field';
import { toast } from '@/components/toast';
import { Badge, Button, Card, Chip, Field, Notice, T } from '@/components/ui';
import { toFriendlyError } from '@/lib/errors';
import { parseBrDate, toIsoDate } from '@/lib/format';
import {
  AXES, MAX_AGE, RULES, SECTIONS, STAGES, axisCheck, brl, deleteGoal, deleteItem, itemIssues, itemValues, monthlySpend,
  proposalChecks, quoteStats, rhCost, saveGoal, saveItem, stageLabel, totals, updateProposal,
  type AdoptedRule, type AudienceSummary, type BudgetItem, type Contract, type Goal, type Parcel, type Phase, type Proposal,
  type Quote, type ScheduleRow, type Stage,
} from '@/lib/proposal';
import { useTheme } from '@/lib/theme';

export type StepProps = { p: Proposal; goals: Goal[]; items: BudgetItem[]; refresh: () => void };

const num = (s: string) => { const n = Number(String(s).replace(/\./g, '').replace(',', '.')); return String(s).trim() && Number.isFinite(n) ? n : 0; };
const numText = (n: number | null | undefined) => (n ? String(n).replace('.', ',') : '');
const br = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');
const isoOf = (s: string) => { const d = parseBrDate(s); return d ? toIsoDate(d) : null; };
async function guard(fn: () => Promise<void>, ok: string) {
  try { await fn(); toast(ok); return true; } catch (e) { toast(toFriendlyError(e).message, 'danger'); return false; }
}
function confirmThen(msg: string, go: () => void) {
  if (Platform.OS === 'web') { if (window.confirm(msg)) go(); }
  else Alert.alert(msg, undefined, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: go }]);
}
const Row = ({ children }: { children: React.ReactNode }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{children}</View>;
const Col = ({ children, basis = 160 }: { children: React.ReactNode; basis?: number }) => <View style={{ flexGrow: 1, flexBasis: basis }}>{children}</View>;

// ---------------------------------------------------------------------------------------------
// 1. Dados
// ---------------------------------------------------------------------------------------------
export function StepDados({ p, refresh }: StepProps) {
  const [f, setF] = useState({ title: p.title, axis: p.axis, mesp: numText(Number(p.mesp_value)), cp: numText(Number(p.counterpart_value)), start: br(p.starts_on), months: String(p.months ?? '') });
  const [busy, setBusy] = useState(false);
  const check = axisCheck(f.axis, num(f.mesp));
  const global = num(f.mesp) + num(f.cp);
  const save = async () => {
    setBusy(true);
    const ok = await guard(() => updateProposal(p.id, {
      title: f.title.trim(), axis: f.axis, mesp_value: num(f.mesp), counterpart_value: num(f.cp),
      starts_on: isoOf(f.start), months: Number(f.months) || null,
    }), 'Dados salvos.');
    setBusy(false);
    if (ok) refresh();
  };
  return (
    <Card style={{ gap: 12 }}>
      <Field label="Nome do projeto" value={f.title} onChangeText={(t) => setF({ ...f, title: t })} />
      <T variant="small" style={{ fontWeight: '700' }}>Eixo do programa</T>
      <View style={{ gap: 8 }}>
        {AXES.map((a) => <Chip key={a.key} label={`${a.label}: ${brl(a.min)} a ${brl(a.max)}`} selected={f.axis === a.key} onPress={() => setF({ ...f, axis: a.key })} />)}
      </View>
      <Row>
        <Col><Field label="Valor pedido ao Ministério (R$)" value={f.mesp} onChangeText={(t) => setF({ ...f, mesp: t })} keyboardType="decimal-pad" placeholder="400.000,00" /></Col>
        <Col><Field label="Contrapartida (R$)" value={f.cp} onChangeText={(t) => setF({ ...f, cp: t })} keyboardType="decimal-pad" placeholder="0,00" /></Col>
      </Row>
      <Notice tone={check.ok ? 'success' : 'warning'} text={`${check.message} Valor do projeto: ${brl(global)}.`} />
      {global > 1_000_000 && num(f.cp) === 0 && <Notice text="Projeto acima de R$ 1 milhão: o Ministério pede contrapartida (Anexo XIII)." />}
      <Row>
        <Col><DateField label="Início da vigência" mode="date" value={f.start} onChange={(t) => setF({ ...f, start: t })} placeholder="dd/mm/aaaa" /></Col>
        <Col><Field label="Vigência (meses)" value={f.months} onChangeText={(t) => setF({ ...f, months: t.replace(/\D/g, '') })} keyboardType="number-pad" hint="Ex.: 14 = 2 de organização + 12 de execução. Até 36." /></Col>
      </Row>
      <Button title="Salvar dados" onPress={save} loading={busy} />
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// 2. Textos (seções do modelo)
// ---------------------------------------------------------------------------------------------
export function StepTextos({ p, refresh }: StepProps) {
  const [s, setS] = useState<Record<string, string>>({ ...p.sections });
  const [open, setOpen] = useState<string | null>('objeto');
  const [busy, setBusy] = useState(false);
  const { colors } = useTheme();
  const dirty = JSON.stringify(s) !== JSON.stringify(p.sections);
  const save = async () => { setBusy(true); const ok = await guard(() => updateProposal(p.id, { sections: s }), 'Textos salvos.'); setBusy(false); if (ok) refresh(); };
  return (
    <View style={{ gap: 10 }}>
      <T variant="small">As seções seguem o modelo do Ministério. Toque para abrir; o texto de ajuda mostra o que eles pedem. Metas, público, custos e cronogramas têm passos próprios.</T>
      <View style={{ borderRadius: 24, backgroundColor: colors.surfaceContainer, overflow: 'hidden' }}>
        {SECTIONS.map((sec, i) => {
          const filled = (s[sec.key] ?? '').trim().length > 0;
          return (
            <View key={sec.key} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
              <Pressable accessibilityRole="button" onPress={() => setOpen(open === sec.key ? null : sec.key)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 56 }}>
                <T variant="body" style={{ fontWeight: '700', flex: 1 }}>{sec.title}</T>
                <Badge label={filled ? 'Preenchido' : 'Falta'} tone={filled ? 'success' : 'muted'} />
                <Ionicons name={open === sec.key ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
              </Pressable>
              {open === sec.key && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
                  <T variant="small">{sec.hint}</T>
                  <Field label={sec.title} value={s[sec.key] ?? ''} onChangeText={(t) => setS({ ...s, [sec.key]: t })} multiline={!sec.oneLine} />
                </View>
              )}
            </View>
          );
        })}
      </View>
      {dirty && <Button title="Salvar textos" onPress={save} loading={busy} />}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// 3. Público-alvo
// ---------------------------------------------------------------------------------------------
export function StepPublico({ p, refresh, teams, aud }: StepProps & { teams: { id: string; name: string }[]; aud: AudienceSummary | null }) {
  const [a, setA] = useState({ ...p.audience });
  const [busy, setBusy] = useState(false);
  const phaseOf = (id: string) => a.teams?.find((t) => t.team_id === id)?.phase ?? null;
  const setPhase = (id: string, ph: Phase | null) => {
    const rest = (a.teams ?? []).filter((t) => t.team_id !== id);
    setA({ ...a, teams: ph ? [...rest, { team_id: id, phase: ph }] : rest });
  };
  const dirty = JSON.stringify(a) !== JSON.stringify(p.audience);
  const save = async () => { setBusy(true); const ok = await guard(() => updateProposal(p.id, { audience: a }), 'Público-alvo salvo.'); setBusy(false); if (ok) refresh(); };
  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 10 }}>
        <T variant="body" style={{ fontWeight: '700' }}>Equipes do projeto e fase</T>
        <T variant="small">Os atletas das equipes escolhidas entram no quadro do público-alvo, separados por sexo. Especialização: treino sistematizado na modalidade; Aperfeiçoamento: treino especializado para aumentar capacidades.</T>
        {teams.length === 0 && <Notice text="Cadastre as equipes em Gestão do clube › Equipes." />}
        {teams.map((t) => (
          <View key={t.id} style={{ gap: 6 }}>
            <T variant="body">{t.name}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Chip label="Fora do projeto" selected={!phaseOf(t.id)} onPress={() => setPhase(t.id, null)} />
              <Chip label="Especialização" selected={phaseOf(t.id) === 'especializacao'} onPress={() => setPhase(t.id, 'especializacao')} />
              <Chip label="Aperfeiçoamento" selected={phaseOf(t.id) === 'aperfeicoamento'} onPress={() => setPhase(t.id, 'aperfeicoamento')} />
            </View>
          </View>
        ))}
        <Row>
          <Col basis={120}><Field label="Comissão técnica" value={String(a.comissao ?? '')} onChangeText={(t) => setA({ ...a, comissao: Number(t.replace(/\D/g, '')) || 0 })} keyboardType="number-pad" /></Col>
          <Col basis={120}><Field label="Staff" value={String(a.staff ?? '')} onChangeText={(t) => setA({ ...a, staff: Number(t.replace(/\D/g, '')) || 0 })} keyboardType="number-pad" /></Col>
          <Col basis={120}><Field label="Beneficiários indiretos" value={String(a.indirect ?? '')} onChangeText={(t) => setA({ ...a, indirect: Number(t.replace(/\D/g, '')) || 0 })} keyboardType="number-pad" /></Col>
        </Row>
        {dirty && <Button title="Salvar público-alvo" onPress={save} loading={busy} />}
      </Card>
      {aud && <Indicators aud={aud} p={p} />}
    </View>
  );
}

/** Painel com os números que o Ministério acompanha (beneficiados por sexo e idade, valores). */
export function Indicators({ aud, p, items }: { aud: AudienceSummary; p: Proposal; items?: BudgetItem[] }) {
  const { colors } = useTheme();
  const pct = (x: number) => (aud.athletes ? Math.round((x / aud.athletes) * 100) : 0);
  const maxAge = Math.max(1, ...aud.ages.map((x) => x.n));
  return (
    <Card style={{ gap: 12 }}>
      <T variant="body" style={{ fontWeight: '700' }}>Indicadores (como no painel do Ministério)</T>
      <Row>
        {[['Atletas', String(aud.athletes)], ['Homens', `${aud.men} (${pct(aud.men)}%)`], ['Mulheres', `${aud.women} (${pct(aud.women)}%)`], ['Profissionais', String(aud.comissao + aud.staff)], ['Total', String(aud.total)]].map(([k, v]) => (
          <View key={k} style={{ flexGrow: 1, flexBasis: 110, padding: 12, borderRadius: 16, backgroundColor: colors.surfaceContainerHigh }}>
            <T variant="title" style={{ fontSize: 22 }}>{v}</T><T variant="small">{k}</T>
          </View>
        ))}
      </Row>
      {aud.noSex > 0 && <Notice text={`${aud.noSex} atleta(s) sem sexo no cadastro. Complete na ficha do atleta para o quadro sair certo.`} />}
      <T variant="small" style={{ fontWeight: '700' }}>Idade no início da vigência</T>
      {aud.ages.map((x) => (
        <View key={x.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T variant="small" style={{ width: 80 }}>{x.label}</T>
          <View style={{ flex: 1, height: 14, borderRadius: 7, backgroundColor: colors.surfaceContainerHigh, overflow: 'hidden' }}>
            <View style={{ width: `${(x.n / maxAge) * 100}%`, height: 14, backgroundColor: x.label === '22 ou mais' ? colors.danger : colors.primary }} />
          </View>
          <T variant="small" style={{ width: 28, textAlign: 'right' }}>{x.n}</T>
        </View>
      ))}
      {aud.overAge > 0 && <Notice tone="danger" text={`${aud.overAge} atleta(s) com mais de ${MAX_AGE} anos no início: o Eixo 1 atende atletas até ${MAX_AGE}.`} />}
      {items && (
        <Row>
          {[['Valor do projeto', brl(Number(p.mesp_value) + Number(p.counterpart_value))], ['Orçado', brl(totals(items).total)], ['Por atleta/mês', aud.athletes && p.months ? brl(totals(items).total / aud.athletes / p.months) : '—']].map(([k, v]) => (
            <View key={k} style={{ flexGrow: 1, flexBasis: 150, padding: 12, borderRadius: 16, backgroundColor: colors.surfaceContainerHigh }}>
              <T variant="body" style={{ fontWeight: '700' }}>{v}</T><T variant="small">{k}</T>
            </View>
          ))}
        </Row>
      )}
      <T variant="small">Valores repassados e pagos entram na execução (Fase C).</T>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// 4. Metas
// ---------------------------------------------------------------------------------------------
type GoalForm = { id?: string; objective: string; qualitative: string; quantitative: string; expected_result: string; method: string; period: string; indicator: Goal['indicator']; target: string };
const INDICATORS: { key: Goal['indicator']; label: string; unit: string }[] = [
  { key: 'manual', label: 'Medida à mão', unit: '' }, { key: 'avg_frequency', label: 'Frequência média (check-in)', unit: '%' },
  { key: 'unique_beneficiaries', label: 'Atletas atendidos', unit: 'atletas' }, { key: 'attendances', label: 'Presenças registradas', unit: 'presenças' },
];
export function StepMetas({ p, goals, refresh }: StepProps) {
  const [f, setF] = useState<GoalForm | null>(null);
  const [busy, setBusy] = useState(false);
  const edit = (g?: Goal) => setF(g ? {
    id: g.id, objective: g.objective, qualitative: g.qualitative ?? '', quantitative: g.quantitative ?? '', expected_result: g.expected_result ?? '',
    method: g.method ?? '', period: String(g.period_months ?? ''), indicator: g.indicator, target: g.target != null ? String(g.target) : '',
  } : { objective: '', qualitative: '', quantitative: '', expected_result: '', method: '', period: '12', indicator: 'manual', target: '' });
  const save = async () => {
    if (!f || f.objective.trim().length < 3) { toast('Escreva o objetivo.', 'danger'); return; }
    setBusy(true);
    const ok = await guard(() => saveGoal({
      id: f.id, proposal_id: p.id, org_id: p.org_id, position: f.id ? undefined : goals.length + 1, objective: f.objective.trim(),
      qualitative: f.qualitative.trim() || null, quantitative: f.quantitative.trim() || null, expected_result: f.expected_result.trim() || null,
      method: f.method.trim() || null, period_months: Number(f.period) || null, indicator: f.indicator, target: f.target ? num(f.target) : null,
    }), 'Meta salva.');
    setBusy(false);
    if (ok) { setF(null); refresh(); }
  };
  return (
    <View style={{ gap: 12 }}>
      <T variant="small">Cada objetivo específico tem meta qualitativa, meta quantitativa, resultado esperado, forma de medir e período, como no modelo. Metas de frequência e de atletas atendidos podem ser medidas pelo check-in.</T>
      {!f && <Button icon="add" title="Adicionar objetivo e metas" onPress={() => edit()} />}
      {f && (
        <Card style={{ gap: 10 }}>
          <Field label="Objetivo específico" value={f.objective} onChangeText={(t) => setF({ ...f, objective: t })} placeholder="Ex.: Oferecer treinamento sistemático de vôlei a 60 atletas de 13 a 17 anos" />
          <Field label="Meta qualitativa" value={f.qualitative} onChangeText={(t) => setF({ ...f, qualitative: t })} multiline />
          <Field label="Meta quantitativa" value={f.quantitative} onChangeText={(t) => setF({ ...f, quantitative: t })} multiline placeholder="Ex.: frequência média de 75% nos treinos" />
          <Field label="Resultado esperado" value={f.expected_result} onChangeText={(t) => setF({ ...f, expected_result: t })} multiline />
          <Field label="Metodologia / forma de aferição" value={f.method} onChangeText={(t) => setF({ ...f, method: t })} multiline placeholder="Ex.: relatório de frequência do TechPoint (check-in com GPS, foto e hora do servidor)" />
          <Field label="Período de avaliação (meses)" value={f.period} onChangeText={(t) => setF({ ...f, period: t.replace(/\D/g, '') })} keyboardType="number-pad" />
          <T variant="small" style={{ fontWeight: '700' }}>Como medir</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {INDICATORS.map((x) => <Chip key={x.key} label={x.label} selected={f.indicator === x.key} onPress={() => setF({ ...f, indicator: x.key })} />)}
          </View>
          {f.indicator !== 'manual' && <Field label={`Alvo (${INDICATORS.find((x) => x.key === f.indicator)?.unit})`} value={f.target} onChangeText={(t) => setF({ ...f, target: t })} keyboardType="decimal-pad" />}
          <Row><Button title="Salvar meta" onPress={save} loading={busy} /><Button kind="outline" title="Cancelar" onPress={() => setF(null)} /></Row>
        </Card>
      )}
      {goals.map((g, i) => (
        <Card key={g.id} style={{ gap: 6 }}>
          <T variant="body" style={{ fontWeight: '700' }}>Objetivo {i + 1}: {g.objective}</T>
          {g.quantitative ? <T variant="small">Meta: {g.quantitative}</T> : null}
          <T variant="small">{[g.period_months && `${g.period_months} meses`, g.indicator !== 'manual' && `${INDICATORS.find((x) => x.key === g.indicator)?.label}${g.target != null ? `: ${g.target}` : ''}`].filter(Boolean).join(' · ')}</T>
          {(!g.qualitative || !g.quantitative || !g.expected_result || !g.method || !g.period_months) && <Badge label="Faltam campos" tone="warning" />}
          <Row>
            <Button kind="tonal" icon="create-outline" title="Editar" onPress={() => edit(g)} />
            <Button kind="outline" icon="trash-outline" title="Apagar" onPress={() => confirmThen('Apagar este objetivo?', () => guard(() => deleteGoal(g.id), 'Objetivo apagado.').then(refresh))} />
          </Row>
        </Card>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// 5. Orçamento
// ---------------------------------------------------------------------------------------------
type ItemForm = {
  id?: string; goal_id: string | null; action: string; stage: Stage; description: string; gnd: 3 | 4; unit: string; quantity: string;
  quotes: { supplier: string; cnpj: string; value: string }[]; rule: AdoptedRule; justification: string; start: string; end: string;
  rh: { role: string; duties: string; profile: string; contract: Contract; workload: string; months: string; salary: string };
};
const CONTRACTS: Contract[] = ['CLT', 'RPA', 'Bolsa', 'Consultoria', 'Outro'];
const emptyQuotes = () => [0, 1, 2].map(() => ({ supplier: '', cnpj: '', value: '' }));

export function StepOrcamento({ p, goals, items, refresh }: StepProps) {
  const { colors } = useTheme();
  const [f, setF] = useState<ItemForm | null>(null);
  const [busy, setBusy] = useState(false);
  const t = totals(items);
  const global = Number(p.mesp_value) + Number(p.counterpart_value);

  const edit = (i?: BudgetItem) => setF(i ? {
    id: i.id, goal_id: i.goal_id, action: i.action ?? '', stage: i.stage, description: i.description, gnd: i.gnd, unit: i.unit ?? '',
    quantity: String(i.quantity).replace('.', ','), quotes: [0, 1, 2].map((k) => ({ supplier: i.quotes[k]?.supplier ?? '', cnpj: i.quotes[k]?.cnpj ?? '', value: numText(i.quotes[k]?.value) })),
    rule: i.adopted_rule, justification: i.justification ?? '', start: i.start_month ? String(i.start_month) : '', end: i.end_month ? String(i.end_month) : '',
    rh: { role: i.rh?.role ?? '', duties: i.rh?.duties ?? '', profile: i.rh?.profile ?? '', contract: i.rh?.contract ?? 'CLT', workload: i.rh?.workload ?? '', months: String(i.rh?.months ?? ''), salary: numText(i.rh?.salary) },
  } : {
    goal_id: goals[0]?.id ?? null, action: '', stage: 'material', description: '', gnd: 3, unit: 'unidade', quantity: '1', quotes: emptyQuotes(),
    rule: 'menor', justification: '', start: '', end: '', rh: { role: '', duties: '', profile: '', contract: 'CLT', workload: '40h/semana', months: String(p.months ?? 12), salary: '' },
  });

  const quotes: Quote[] = (f?.quotes ?? []).filter((q) => q.supplier.trim() || q.value).map((q) => ({ supplier: q.supplier.trim(), cnpj: q.cnpj.trim() || undefined, value: num(q.value) }));
  const rhInfo = f ? { role: f.rh.role.trim(), duties: f.rh.duties.trim(), profile: f.rh.profile.trim(), contract: f.rh.contract, workload: f.rh.workload.trim(), months: Number(f.rh.months) || 0, salary: num(f.rh.salary) } : null;
  const preview = f ? itemValues({ stage: f.stage, quantity: num(f.quantity) || 1, quotes, adopted_rule: f.rule, rh: f.stage === 'rh' ? rhInfo : null }) : null;
  const stats = quoteStats(quotes);

  const save = async () => {
    if (!f) return;
    const desc = f.stage === 'rh' ? (f.description.trim() || rhInfo!.role) : f.description.trim();
    if (desc.length < 3) { toast(f.stage === 'rh' ? 'Informe o cargo.' : 'Descreva o item.', 'danger'); return; }
    if (f.rule !== 'menor' && f.justification.trim().length < 5) { toast('Explique por que não usar o menor preço.', 'danger'); return; }
    setBusy(true);
    const ok = await guard(() => saveItem({
      id: f.id, proposal_id: p.id, org_id: p.org_id, goal_id: f.goal_id, action: f.action.trim() || null, stage: f.stage, description: desc,
      gnd: f.gnd, unit: f.stage === 'rh' ? 'profissional' : f.unit.trim() || null, quantity: num(f.quantity) || 1,
      quotes: f.stage === 'rh' ? [] : quotes, adopted_rule: f.stage === 'rh' ? 'menor' : f.rule, justification: f.rule === 'menor' ? null : f.justification.trim(),
      rh: f.stage === 'rh' ? rhInfo : null, start_month: Number(f.start) || null, end_month: Number(f.end) || null,
      position: f.id ? undefined : items.length + 1,
    }), 'Item salvo.');
    setBusy(false);
    if (ok) { setF(null); refresh(); }
  };

  const groups = useMemo(() => STAGES.map((s) => ({ s, xs: items.filter((i) => i.stage === s.key) })).filter((g) => g.xs.length), [items]);

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 6, backgroundColor: Math.abs(t.total - global) < 0.01 ? colors.successContainer : colors.surfaceContainer }}>
        <T variant="body" style={{ fontWeight: '700' }}>Orçado {brl(t.total)} de {brl(global)}</T>
        <T variant="small">Custeio (GND 3): {brl(t.gnd3)} · Investimento (GND 4): {brl(t.gnd4)}{Math.abs(t.total - global) >= 0.01 ? ` · ${t.total < global ? 'faltam' : 'passou'} ${brl(Math.abs(global - t.total))}` : ' · fechado'}</T>
      </Card>
      {!f && <Button icon="add" title="Adicionar item" onPress={() => edit()} />}
      {f && (
        <Card style={{ gap: 10 }}>
          <T variant="small" style={{ fontWeight: '700' }}>Meta</T>
          {goals.length === 0 ? <Notice text="Cadastre os objetivos e metas primeiro (passo Metas)." /> : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {goals.map((g, k) => <Chip key={g.id} label={`Objetivo ${k + 1}`} selected={f.goal_id === g.id} onPress={() => setF({ ...f, goal_id: g.id })} />)}
            </View>
          )}
          <Field label="Ação" value={f.action} onChangeText={(t) => setF({ ...f, action: t })} placeholder="Ex.: Viabilizar a contratação da equipe técnica" />
          <T variant="small" style={{ fontWeight: '700' }}>Etapa (tipo de despesa)</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {STAGES.map((s) => <Chip key={s.key} label={s.label} selected={f.stage === s.key} onPress={() => setF({ ...f, stage: s.key, gnd: s.gnd })} />)}
          </View>
          <T variant="small">{STAGES.find((s) => s.key === f.stage)?.hint}</T>
          {f.stage === 'rh' ? (
            <View style={{ gap: 10 }}>
              <Row>
                <Col basis={200}><Field label="Cargo" value={f.rh.role} onChangeText={(t) => setF({ ...f, rh: { ...f.rh, role: t } })} placeholder="Ex.: Auxiliar técnico" /></Col>
                <Col basis={120}><Field label="Quantidade" value={f.quantity} onChangeText={(t) => setF({ ...f, quantity: t })} keyboardType="decimal-pad" /></Col>
              </Row>
              <Field label="Atribuição" value={f.rh.duties} onChangeText={(t) => setF({ ...f, rh: { ...f.rh, duties: t } })} multiline />
              <Field label="Perfil exigido" value={f.rh.profile} onChangeText={(t) => setF({ ...f, rh: { ...f.rh, profile: t } })} placeholder="Ex.: Educação Física (bacharel), 2 anos de experiência" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CONTRACTS.map((c) => <Chip key={c} label={c} selected={f.rh.contract === c} onPress={() => setF({ ...f, rh: { ...f.rh, contract: c } })} />)}
              </View>
              <Row>
                <Col basis={130}><Field label="Carga horária" value={f.rh.workload} onChangeText={(t) => setF({ ...f, rh: { ...f.rh, workload: t } })} /></Col>
                <Col basis={110}><Field label="Meses" value={f.rh.months} onChangeText={(t) => setF({ ...f, rh: { ...f.rh, months: t.replace(/\D/g, '') } })} keyboardType="number-pad" /></Col>
                <Col basis={150}><Field label="Remuneração bruta/mês (R$)" value={f.rh.salary} onChangeText={(t) => setF({ ...f, rh: { ...f.rh, salary: t } })} keyboardType="decimal-pad" /></Col>
              </Row>
              {rhInfo && rhInfo.salary > 0 && rhInfo.months > 0 && (() => {
                const c = rhCost(rhInfo);
                return <Notice tone="info" text={rhInfo.contract === 'CLT'
                  ? `Salários ${brl(c.base)} + 13º ${brl(c.decimo)} + férias e 1/3 ${brl(c.ferias)} + encargos (INSS 26,5%, FGTS 8%, PIS 1%) ${brl(c.encargos)} = ${brl(c.total)} por profissional. Estimativa: confira com o contador.`
                  : `${brl(rhInfo.salary)} × ${rhInfo.months} meses = ${brl(c.total)} por profissional.`} />;
              })()}
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Field label="Descrição do item" value={f.description} onChangeText={(t) => setF({ ...f, description: t })} multiline placeholder="Modelo, tamanho, material, finalidade (sem marca)" />
              <Row>
                <Col basis={110}><Field label="Quantidade" value={f.quantity} onChangeText={(t) => setF({ ...f, quantity: t })} keyboardType="decimal-pad" /></Col>
                <Col basis={110}><Field label="Unidade" value={f.unit} onChangeText={(t) => setF({ ...f, unit: t })} /></Col>
              </Row>
              <T variant="small" style={{ fontWeight: '700' }}>3 cotações (com CNPJ, endereço, telefone, data, validade e assinatura no orçamento)</T>
              {f.quotes.map((q, k) => (
                <Row key={k}>
                  <Col basis={170}><Field label={`Empresa ${k + 1}`} value={q.supplier} onChangeText={(t) => { const qs = [...f.quotes]; qs[k] = { ...q, supplier: t }; setF({ ...f, quotes: qs }); }} /></Col>
                  <Col basis={150}><Field label="CNPJ" value={q.cnpj} onChangeText={(t) => { const qs = [...f.quotes]; qs[k] = { ...q, cnpj: t }; setF({ ...f, quotes: qs }); }} keyboardType="number-pad" /></Col>
                  <Col basis={120}><Field label="Valor unitário (R$)" value={q.value} onChangeText={(t) => { const qs = [...f.quotes]; qs[k] = { ...q, value: t }; setF({ ...f, quotes: qs }); }} keyboardType="decimal-pad" /></Col>
                </Row>
              ))}
              {stats && (
                <View style={{ gap: 8 }}>
                  <T variant="small" style={{ fontWeight: '700' }}>Valor adotado</T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {RULES.map((r) => <Chip key={r.key} label={`${r.label}: ${brl(stats[r.key])}`} selected={f.rule === r.key} onPress={() => setF({ ...f, rule: r.key })} />)}
                  </View>
                  {f.rule !== 'menor' && <Field label="Por que não o menor preço?" value={f.justification} onChangeText={(t) => setF({ ...f, justification: t })} multiline placeholder="Ex.: a cotação mais barata não atende a especificação oficial da federação" />}
                </View>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip label="Custeio (GND 3)" selected={f.gnd === 3} onPress={() => setF({ ...f, gnd: 3 })} />
                <Chip label="Investimento (GND 4)" selected={f.gnd === 4} onPress={() => setF({ ...f, gnd: 4 })} />
              </View>
            </View>
          )}
          <Row>
            <Col basis={120}><Field label="Mês de início" value={f.start} onChangeText={(t) => setF({ ...f, start: t.replace(/\D/g, '') })} keyboardType="number-pad" hint="1 = primeiro mês" /></Col>
            <Col basis={120}><Field label="Mês de fim" value={f.end} onChangeText={(t) => setF({ ...f, end: t.replace(/\D/g, '') })} keyboardType="number-pad" hint="Vazio = toda a vigência" /></Col>
          </Row>
          {preview && <Notice tone="info" text={`Valor unitário ${brl(preview.unit)} · total do item ${brl(preview.total)}`} />}
          <Row><Button title="Salvar item" onPress={save} loading={busy} /><Button kind="outline" title="Cancelar" onPress={() => setF(null)} /></Row>
        </Card>
      )}
      {groups.map(({ s, xs }) => (
        <View key={s.key} style={{ gap: 8 }}>
          <T variant="small" style={{ fontWeight: '700', textTransform: 'uppercase' }}>{s.label} · {brl(xs.reduce((a, i) => a + Number(i.total), 0))}</T>
          {xs.map((i) => {
            const issues = itemIssues(i);
            return (
              <Card key={i.id} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <T variant="body" style={{ fontWeight: '700', flex: 1 }}>{i.stage === 'rh' && i.rh ? `${i.rh.role}${i.quantity > 1 ? ` (${i.quantity})` : ''}` : i.description}</T>
                  <T variant="body" style={{ fontWeight: '700' }}>{brl(Number(i.total))}</T>
                </View>
                <T variant="small">{i.stage === 'rh' && i.rh ? `${i.rh.contract} · ${i.rh.months} meses · ${brl(i.rh.salary)}/mês` : `${i.quantity} ${i.unit ?? ''} × ${brl(Number(i.unit_value))} (${RULES.find((r) => r.key === i.adopted_rule)?.label.toLowerCase()}) · GND ${i.gnd}`}</T>
                {issues.length > 0 && <Badge label={`Falta: ${issues.join(', ')}`} tone="warning" />}
                <Row>
                  <Button kind="tonal" icon="create-outline" title="Editar" onPress={() => edit(i)} />
                  <Button kind="outline" icon="trash-outline" title="Apagar" onPress={() => confirmThen('Apagar este item?', () => guard(() => deleteItem(i.id), 'Item apagado.').then(refresh))} />
                </Row>
              </Card>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// 6. Cronogramas (execução e desembolso)
// ---------------------------------------------------------------------------------------------
const PRESET_ACTIONS = ['Planejamento e organização', 'Processos seletivos e cotações', 'Contratação de profissionais', 'Avaliação técnica dos atletas', 'Treinamentos', 'Competições', 'Ações de comunicação', 'Avaliação dos resultados', 'Prestação de contas'];
export function StepCronogramas({ p, items, refresh }: StepProps) {
  const { colors } = useTheme();
  const months = p.months ?? 12;
  const [rows, setRows] = useState<ScheduleRow[]>(p.schedule ?? []);
  const [parcels, setParcels] = useState<Parcel[]>(p.disbursement ?? []);
  const [busy, setBusy] = useState(false);
  const global = Number(p.mesp_value) + Number(p.counterpart_value);
  const sum = parcels.reduce((s, x) => s + Number(x.value || 0), 0);
  const spend = monthlySpend(items, months);
  const dirty = JSON.stringify(rows) !== JSON.stringify(p.schedule ?? []) || JSON.stringify(parcels) !== JSON.stringify(p.disbursement ?? []);
  const toggle = (r: number, m: number) => setRows(rows.map((x, i) => (i !== r ? x : { ...x, months: x.months.includes(m) ? x.months.filter((y) => y !== m) : [...x.months, m].sort((a, b) => a - b) })));
  const startYear = p.starts_on ? Number(p.starts_on.slice(0, 4)) : new Date().getFullYear();
  const startMonth = p.starts_on ? Number(p.starts_on.slice(5, 7)) : 1;
  const save = async () => {
    setBusy(true);
    const ok = await guard(() => updateProposal(p.id, { schedule: rows.filter((r) => r.action.trim()), disbursement: parcels }), 'Cronogramas salvos.');
    setBusy(false);
    if (ok) refresh();
  };
  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 10 }}>
        <T variant="body" style={{ fontWeight: '700' }}>Cronograma de execução ({months} meses)</T>
        <T variant="small">Toque nos meses em que cada ação acontece.</T>
        {rows.map((r, ri) => (
          <View key={ri} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}><Field label={`Ação ${ri + 1}`} value={r.action} onChangeText={(t) => setRows(rows.map((x, i) => (i === ri ? { ...x, action: t } : x)))} /></View>
              <Button kind="ghost" icon="trash-outline" title="" onPress={() => setRows(rows.filter((_, i) => i !== ri))} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {Array.from({ length: months }, (_, k) => k + 1).map((m) => {
                const on = r.months.includes(m);
                return (
                  <Pressable key={m} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${r.action || 'Ação'}: mês ${m}`} onPress={() => toggle(ri, m)}
                    style={{ width: 38, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.primary : colors.surfaceContainerHigh }}>
                    <T variant="small" color={on ? colors.onPrimary : colors.text} style={{ fontWeight: '700' }}>{m}</T>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PRESET_ACTIONS.filter((a) => !rows.some((r) => r.action === a)).map((a) => <Chip key={a} label={`+ ${a}`} onPress={() => setRows([...rows, { action: a, months: [] }])} />)}
          <Chip label="+ Outra ação" onPress={() => setRows([...rows, { action: '', months: [] }])} />
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <T variant="body" style={{ fontWeight: '700' }}>Cronograma de desembolso (parcelas)</T>
        {parcels.map((x, i) => (
          <View key={i} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <T variant="body" style={{ fontWeight: '700' }}>{i + 1}ª parcela</T>
              <Chip label="Concedente (Ministério)" selected={x.who === 'concedente'} onPress={() => setParcels(parcels.map((y, k) => (k === i ? { ...y, who: 'concedente' } : y)))} />
              <Chip label="Convenente (contrapartida)" selected={x.who === 'convenente'} onPress={() => setParcels(parcels.map((y, k) => (k === i ? { ...y, who: 'convenente' } : y)))} />
            </View>
            <Row>
              <Col basis={90}><Field label="Mês" value={String(x.month)} onChangeText={(t) => setParcels(parcels.map((y, k) => (k === i ? { ...y, month: Number(t.replace(/\D/g, '')) || 0 } : y)))} keyboardType="number-pad" /></Col>
              <Col basis={100}><Field label="Ano" value={String(x.year)} onChangeText={(t) => setParcels(parcels.map((y, k) => (k === i ? { ...y, year: Number(t.replace(/\D/g, '')) || 0 } : y)))} keyboardType="number-pad" /></Col>
              <Col basis={150}><Field label="Valor (R$)" value={numText(x.value)} onChangeText={(t) => setParcels(parcels.map((y, k) => (k === i ? { ...y, value: num(t) } : y)))} keyboardType="decimal-pad" /></Col>
              <Button kind="ghost" icon="trash-outline" title="" onPress={() => setParcels(parcels.filter((_, k) => k !== i))} />
            </Row>
          </View>
        ))}
        <Row>
          <Button kind="tonal" icon="add" title="Parcela" onPress={() => setParcels([...parcels, { who: 'concedente', month: startMonth, year: startYear, value: parcels.length ? 0 : Number(p.mesp_value) }])} />
        </Row>
        <Notice tone={Math.abs(sum - global) < 0.01 ? 'success' : 'warning'} text={`Parcelas: ${brl(sum)} de ${brl(global)}.`} />
      </Card>

      <Card style={{ gap: 6 }}>
        <T variant="body" style={{ fontWeight: '700' }}>Gasto previsto por mês (calculado do orçamento)</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {spend.map((v, k) => (
            <View key={k} style={{ padding: 8, borderRadius: 12, backgroundColor: colors.surfaceContainerHigh, minWidth: 92 }}>
              <T variant="small">Mês {k + 1}</T><T variant="small" style={{ fontWeight: '700' }}>{brl(v)}</T>
            </View>
          ))}
        </View>
        <T variant="small">Cada item é dividido entre o mês de início e o de fim que você informou no orçamento.</T>
      </Card>
      {dirty && <Button title="Salvar cronogramas" onPress={save} loading={busy} />}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// 7. Revisar e exportar
// ---------------------------------------------------------------------------------------------
export function StepRevisar({ p, goals, items, aud, onExportDoc, onExportCsv }: StepProps & { aud: AudienceSummary | null; onExportDoc: () => Promise<void>; onExportCsv: () => Promise<void> }) {
  const { colors } = useTheme();
  const checks = proposalChecks(p, goals, items, aud);
  const errors = checks.filter((c) => !c.ok && c.level === 'erro').length;
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (k: string, fn: () => Promise<void>) => { setBusy(k); try { await fn(); } catch (e) { toast(toFriendlyError(e).message, 'danger'); } finally { setBusy(null); } };
  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 8 }}>
        <T variant="body" style={{ fontWeight: '700' }}>Conferência antes de enviar ao Ministério</T>
        {checks.map((c, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <Ionicons name={c.ok ? 'checkmark-circle' : c.level === 'erro' ? 'close-circle' : 'alert-circle'} size={20} color={c.ok ? colors.success : c.level === 'erro' ? colors.danger : colors.warning} />
            <T variant="small" style={{ flex: 1 }}>{c.text}</T>
          </View>
        ))}
        {errors > 0 && <Notice text={`${errors} ponto(s) para corrigir. Dá para exportar assim mesmo; o que faltar sai como "(a preencher)".`} />}
      </Card>
      {aud && <Indicators aud={aud} p={p} items={items} />}
      <Button big icon="document-text-outline" title="Baixar Projeto Técnico (Word)" onPress={() => run('doc', onExportDoc)} loading={busy === 'doc'} />
      <Button kind="tonal" icon="grid-outline" title="Baixar planilha do orçamento" onPress={() => run('csv', onExportCsv)} loading={busy === 'csv'} />
      <T variant="small">A planilha traz cada item com as 3 cotações, menor, média, mediana, critério escolhido e memória de cálculo, para copiar no Plano de Aplicação Detalhado do Transferegov.br.</T>
      <T variant="small" color={colors.textMuted}>Rubricas como {stageLabel('rh')} e {stageLabel('material')} seguem as etapas que o relatório de prestação de contas (RCO) vai cobrar.</T>
    </View>
  );
}
