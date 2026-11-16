// Execução do projeto aprovado e prestação de contas (Fase C, onda 1): resumo combinado × gasto, repasses,
// despesas com comprovantes por item do orçamento e o RCO em Word.
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { DateField } from '@/components/date-field';
import { toast } from '@/components/toast';
import { Badge, Button, Card, Chip, Field, Loading, Notice, Screen, T } from '@/components/ui';
import { digits } from '@/lib/br';
import { MAX_DOC_BYTES, pickIdDocument } from '@/lib/documents';
import { toFriendlyError } from '@/lib/errors';
import {
  FILE_KINDS, addTransfer, deleteExpense, deleteExpenseFile, deleteTransfer, executionSummary, fileKindLabel, missingFiles, openExpenseFile,
  requiredFiles, saveExpense, saveRcoTexts, setItemExecution, uploadExpenseFile, useExecution, type ExecItem, type Expense, type FileKind,
} from '@/lib/execution';
import { parseBrDate, toIsoDate } from '@/lib/format';
import { useMe } from '@/lib/me';
import { brl } from '@/lib/proposal';
import { useIndicators } from '@/lib/projects';
import { RCO_TEXTS } from '@/lib/rco-doc';
import { exportRco } from '@/lib/rco-export';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

const TABS = ['Resumo', 'Repasses', 'Despesas', 'RCO'] as const;
type Tab = (typeof TABS)[number];
const num = (s: string) => { const n = Number(String(s).replace(/\./g, '').replace(',', '.')); return String(s).trim() && Number.isFinite(n) ? n : 0; };
const isoOf = (s: string) => { const d = parseBrDate(s); return d ? toIsoDate(d) : null; };
const br = (iso: string | null | undefined) => (iso ? iso.split('-').reverse().join('/') : '');
const todayBr = () => new Date().toLocaleDateString('pt-BR');
function confirmThen(msg: string, go: () => void) {
  if (Platform.OS === 'web') { if (window.confirm(msg)) go(); }
  else Alert.alert(msg, undefined, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: go }]);
}

export default function Execucao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const allowed = (me.isManager || me.isPlatformAdmin) && me.hasModule('investimentos');
  const q = useExecution(allowed ? id : undefined);
  const ind = useIndicators(allowed ? id : undefined);
  const orgId = q.data?.project.org_id;
  const org = useQuery({
    queryKey: ['org-rco', orgId], enabled: Boolean(orgId),
    queryFn: async () => (await supabase.from('organizations').select('name, legal_name, cnpj').eq('id', orgId!).single()).data as { name: string; legal_name: string | null; cnpj: string | null },
  });
  const qc = useQueryClient();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('Resumo');
  const sum = useMemo(() => (q.data ? executionSummary(q.data.items, q.data.expenses, q.data.transfers) : null), [q.data]);

  if (!allowed) return <Screen><Stack.Screen options={{ title: 'Execução' }} /><Notice tone="info" text="Disponível para gestores e administradores com o módulo de Gestão de Investimentos." /></Screen>;
  if (q.isLoading) return <Loading />;
  if (!q.data || !sum) return <Screen><Notice tone="danger" text="Projeto não encontrado." /></Screen>;
  const { project, proposal, items, expenses, transfers, goals } = q.data;
  if (!proposal) return <Screen><Notice tone="info" text="Este projeto não veio de um Projeto Técnico aprovado no TechPoint." /></Screen>;
  const refresh = () => qc.invalidateQueries({ queryKey: ['execution', id] });
  const global = Number(proposal.mesp_value) + Number(proposal.counterpart_value);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Execução e prestação de contas' }} />
      <T variant="title">{project.name}</T>
      <T variant="small">Termo de Fomento nº {project.process_number} · vigência {br(project.starts_on)} a {br(project.ends_on)}</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
        {TABS.map((t) => <Chip key={t} label={t} selected={tab === t} onPress={() => setTab(t)} />)}
      </ScrollView>

      {tab === 'Resumo' && (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {[['Valor do projeto', brl(global)], ['Repassado', brl(sum.received)], ['Gasto', brl(sum.executed)], ['Pago', brl(sum.paid)], ['Saldo em conta', brl(sum.inAccount)]].map(([k, v]) => (
              <View key={k} style={{ flexGrow: 1, flexBasis: 150, padding: 12, borderRadius: 16, backgroundColor: colors.surfaceContainer }}>
                <T variant="body" style={{ fontWeight: '700' }}>{v}</T><T variant="small">{k}</T>
              </View>
            ))}
          </View>
          {sum.over > 0 && <Notice tone="danger" text={`${sum.over} item(ns) com gasto acima do combinado.`} />}
          {sum.pendingDocs > 0 && <Notice text={`${sum.pendingDocs} despesa(s) sem todos os comprovantes que o RCO pede.`} />}
          <Card style={{ gap: 10 }}>
            <T variant="body" style={{ fontWeight: '700' }}>Combinado × gasto por etapa ({sum.pct}% executado)</T>
            {sum.byStage.map((s) => {
              const pct = s.agreed ? Math.min(100, (s.executed / s.agreed) * 100) : 100;
              return (
                <View key={s.stage} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <T variant="small" style={{ fontWeight: '700', flex: 1 }}>{s.label}</T>
                    <T variant="small">{brl(s.executed)} de {brl(s.agreed)}</T>
                  </View>
                  <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.surfaceContainerHigh, overflow: 'hidden' }}>
                    <View style={{ width: `${pct}%`, height: 10, backgroundColor: s.executed > s.agreed + 0.005 ? colors.danger : colors.primary }} />
                  </View>
                </View>
              );
            })}
          </Card>
          {ind.data && (
            <Card style={{ gap: 6 }}>
              <T variant="body" style={{ fontWeight: '700' }}>Beneficiários e metas (check-in)</T>
              <T variant="small">Previstos: {project.planned_beneficiaries ?? '—'} · atendidos com presença: {ind.data.indicators.unique_beneficiaries} · frequência média: {ind.data.indicators.avg_frequency_pct ?? '—'}%</T>
              {ind.data.goals.map((g) => <T key={g.id} variant="small">{g.code}: {g.result ?? '—'} {g.unit ?? ''}{g.target != null ? ` (meta ${g.target})` : ''}{g.reached != null ? (g.reached ? ' ✓' : ' – abaixo') : ''}</T>)}
            </Card>
          )}
        </View>
      )}

      {tab === 'Repasses' && <Repasses orgId={project.org_id} projectId={project.id} transfers={transfers} total={global} received={sum.received} refresh={refresh} />}
      {tab === 'Despesas' && <Despesas projectId={project.id} orgId={project.org_id} userId={me.profile?.id ?? ''} byItem={sum.byItem} refresh={refresh} />}
      {tab === 'RCO' && (
        <Rco
          project={project}
          onExport={async (texts) => {
            const goalResults = goals.map((_, i) => {
              const g = ind.data?.goals.find((x) => x.code === `Meta ${i + 1}`);
              return { code: `Meta ${i + 1}`, result: g?.result ?? null, reached: g?.reached ?? null, unit: g?.unit ?? null, target: g?.target ?? null };
            });
            await exportRco({
              project: { ...project, rco: texts }, proposal, goals, items, expenses, transfers, goalResults,
              realBeneficiaries: ind.data?.indicators.unique_beneficiaries ?? null, avgFrequency: ind.data?.indicators.avg_frequency_pct ?? null,
              org: org.data ?? { name: me.org?.name ?? '' },
            });
          }}
          refresh={refresh}
          pending={{ docs: sum.pendingDocs, over: sum.over }}
        />
      )}
    </Screen>
  );
}

function Repasses({ orgId, projectId, transfers, total, received, refresh }: { orgId: string; projectId: string; transfers: { id: string; source: string; received_on: string; value: number; note: string | null }[]; total: number; received: number; refresh: () => void }) {
  const [f, setF] = useState({ source: 'concedente' as 'concedente' | 'convenente', date: todayBr(), value: '', note: '' });
  const [busy, setBusy] = useState(false);
  const add = async () => {
    const date = isoOf(f.date);
    if (!date || num(f.value) <= 0) { toast('Informe data e valor.', 'danger'); return; }
    setBusy(true);
    try { await addTransfer({ org_id: orgId, project_id: projectId, source: f.source, received_on: date, value: num(f.value), note: f.note.trim() || null }); toast('Repasse registrado.'); setF({ ...f, value: '', note: '' }); refresh(); }
    catch (e) { toast(toFriendlyError(e).message, 'danger'); } finally { setBusy(false); }
  };
  return (
    <View style={{ gap: 12 }}>
      <Notice tone={Math.abs(received - total) < 0.01 ? 'success' : 'info'} text={`Recebido ${brl(received)} de ${brl(total)}.`} />
      <Card style={{ gap: 10 }}>
        <T variant="body" style={{ fontWeight: '700' }}>Registrar repasse recebido na conta do projeto</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Ministério (concedente)" selected={f.source === 'concedente'} onPress={() => setF({ ...f, source: 'concedente' })} />
          <Chip label="Contrapartida (convenente)" selected={f.source === 'convenente'} onPress={() => setF({ ...f, source: 'convenente' })} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <View style={{ flexGrow: 1, flexBasis: 160 }}><DateField label="Data do crédito" mode="date" value={f.date} onChange={(t) => setF({ ...f, date: t })} /></View>
          <View style={{ flexGrow: 1, flexBasis: 160 }}><Field label="Valor (R$)" value={f.value} onChangeText={(t) => setF({ ...f, value: t })} keyboardType="decimal-pad" /></View>
        </View>
        <Field label="Observação" value={f.note} onChangeText={(t) => setF({ ...f, note: t })} placeholder="Ex.: 1ª parcela" />
        <Button title="Registrar repasse" onPress={add} loading={busy} />
      </Card>
      {transfers.map((t) => (
        <Card key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <T variant="body" style={{ fontWeight: '700' }}>{brl(Number(t.value))}</T>
            <T variant="small">{br(t.received_on)} · {t.source === 'concedente' ? 'Ministério' : 'Contrapartida'}{t.note ? ` · ${t.note}` : ''}</T>
          </View>
          <Button kind="ghost" icon="trash-outline" title="" onPress={() => confirmThen('Apagar este repasse?', () => deleteTransfer(t.id).then(() => { toast('Repasse apagado.'); refresh(); }).catch((e) => toast(toFriendlyError(e).message, 'danger')))} />
        </Card>
      ))}
    </View>
  );
}

type ExpForm = { id?: string; supplier: string; doc: string; number: string; value: string; date: string; paid: string; note: string };
function Despesas({ projectId, orgId, userId, byItem, refresh }: { projectId: string; orgId: string; userId: string; byItem: ReturnType<typeof executionSummary>['byItem']; refresh: () => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<{ itemId: string; f: ExpForm } | null>(null);
  const [change, setChange] = useState<{ itemId: string; status: ExecItem['exec_status']; note: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const saveExp = async () => {
    if (!form) return;
    const { f } = form;
    if (f.supplier.trim().length < 2 || num(f.value) <= 0 || !isoOf(f.date)) { toast('Informe fornecedor, valor e data.', 'danger'); return; }
    const doc = digits(f.doc);
    if (doc && doc.length !== 11 && doc.length !== 14) { toast('CPF (11) ou CNPJ (14 números).', 'danger'); return; }
    setBusy(true);
    try {
      await saveExpense({ id: f.id, org_id: orgId, project_id: projectId, item_id: form.itemId, supplier: f.supplier.trim(), supplier_doc: doc || null,
        doc_number: f.number.trim() || null, value: num(f.value), spent_on: isoOf(f.date)!, paid_on: isoOf(f.paid), note: f.note.trim() || null });
      toast('Despesa salva. Agora anexe os comprovantes.'); setForm(null); refresh();
    } catch (e) { toast(toFriendlyError(e).message, 'danger'); } finally { setBusy(false); }
  };
  const attach = async (e: Expense, kind: FileKind) => {
    const picked = await pickIdDocument();
    if (!picked) return;
    if (!picked.mime) { toast('Envie PDF, PNG ou JPG.', 'danger'); return; }
    if (picked.size > MAX_DOC_BYTES * 3) { toast('Arquivo muito grande.', 'danger'); return; }
    setBusy(true);
    try { await uploadExpenseFile({ orgId, expenseId: e.id, uploaderId: userId, kind, picked }); toast('Comprovante enviado.'); refresh(); }
    catch (err) { toast(toFriendlyError(err).message, 'danger'); } finally { setBusy(false); }
  };
  const saveChange = async () => {
    if (!change) return;
    try { await setItemExecution(change.itemId, change.status, change.note); toast('Situação do item salva.'); setChange(null); refresh(); }
    catch (e) { toast(toFriendlyError(e).message, 'danger'); }
  };

  return (
    <View style={{ gap: 10 }}>
      <T variant="small">Cada gasto entra no item do orçamento aprovado. Os comprovantes pedidos mudam conforme o tipo de despesa, como no modelo do RCO. Fotos são reduzidas antes de enviar.</T>
      {byItem.map((x) => {
        const isOpen = open === x.item.id;
        const req = requiredFiles(x.item.stage, { clt: x.item.rh?.contract === 'CLT' });
        return (
          <Card key={x.item.id} style={{ gap: 8 }}>
            <Pressable accessibilityRole="button" onPress={() => setOpen(isOpen ? null : x.item.id)} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <T variant="body" style={{ fontWeight: '700', flex: 1 }}>{x.item.stage === 'rh' && x.item.rh ? x.item.rh.role : x.item.description}</T>
                {x.over && <Badge label="Acima do combinado" tone="danger" />}
                {x.pendingDocs > 0 && <Badge label={`${x.pendingDocs} sem comprovante`} tone="warning" />}
                {(x.item.exec_status ?? 'normal') !== 'normal' && <Badge label={x.item.exec_status === 'substituido' ? 'Substituído' : 'Não adquirido'} tone="primary" />}
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
              </View>
              <T variant="small">Gasto {brl(x.executed)} de {brl(Number(x.item.total))} · saldo {brl(x.balance)} · {x.expenses.length} despesa(s)</T>
            </Pressable>
            {isOpen && (
              <View style={{ gap: 10 }}>
                <T variant="small">Comprovantes pedidos: {req.map((r) => r.label).join('; ')}.</T>
                {x.expenses.map((e) => {
                  const miss = missingFiles(x.item.stage, e.expense_files ?? [], { clt: x.item.rh?.contract === 'CLT' });
                  return (
                    <View key={e.id} style={{ gap: 6, padding: 12, borderRadius: 16, backgroundColor: colors.surfaceContainerHigh }}>
                      <T variant="body" style={{ fontWeight: '700' }}>{brl(Number(e.value))} · {e.supplier}</T>
                      <T variant="small">{br(e.spent_on)}{e.doc_number ? ` · ${e.doc_number}` : ''}{e.paid_on ? ` · pago em ${br(e.paid_on)}` : ' · ainda não pago'}</T>
                      {(e.expense_files ?? []).map((f) => (
                        <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Ionicons name="document-attach-outline" size={18} color={colors.primary} />
                          <Pressable accessibilityRole="link" onPress={() => openExpenseFile(f).catch((err) => toast(toFriendlyError(err).message, 'danger'))} style={{ flex: 1 }}>
                            <T variant="small" color={colors.primary}>{fileKindLabel(f.kind)}</T>
                          </Pressable>
                          <Button kind="ghost" icon="close" title="" onPress={() => confirmThen('Apagar este comprovante?', () => deleteExpenseFile(f).then(refresh))} />
                        </View>
                      ))}
                      {miss.length > 0 ? <Notice text={`Falta: ${miss.join('; ')}.`} /> : <Badge label="Comprovantes completos" tone="success" />}
                      <T variant="small" style={{ fontWeight: '700' }}>Anexar</T>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {FILE_KINDS.filter((k) => k.key !== 'outro').map((k) => <Chip key={k.key} label={`+ ${k.label}`} onPress={() => attach(e, k.key)} />)}
                        <Chip label="+ Outro" onPress={() => attach(e, 'outro')} />
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        <Button kind="tonal" icon="create-outline" title="Editar" onPress={() => setForm({ itemId: x.item.id, f: { id: e.id, supplier: e.supplier, doc: e.supplier_doc ?? '', number: e.doc_number ?? '', value: String(e.value).replace('.', ','), date: br(e.spent_on), paid: br(e.paid_on), note: e.note ?? '' } })} />
                        <Button kind="outline" icon="trash-outline" title="Apagar" onPress={() => confirmThen('Apagar esta despesa e os comprovantes?', () => deleteExpense(e).then(() => { toast('Despesa apagada.'); refresh(); }).catch((err) => toast(toFriendlyError(err).message, 'danger')))} />
                      </View>
                    </View>
                  );
                })}
                {form?.itemId === x.item.id ? (
                  <View style={{ gap: 10 }}>
                    <Field label="Fornecedor" value={form.f.supplier} onChangeText={(t) => setForm({ ...form, f: { ...form.f, supplier: t } })} />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                      <View style={{ flexGrow: 1, flexBasis: 160 }}><Field label="CNPJ ou CPF" value={form.f.doc} onChangeText={(t) => setForm({ ...form, f: { ...form.f, doc: t } })} keyboardType="number-pad" /></View>
                      <View style={{ flexGrow: 1, flexBasis: 140 }}><Field label="Nº da nota ou recibo" value={form.f.number} onChangeText={(t) => setForm({ ...form, f: { ...form.f, number: t } })} /></View>
                      <View style={{ flexGrow: 1, flexBasis: 140 }}><Field label="Valor (R$)" value={form.f.value} onChangeText={(t) => setForm({ ...form, f: { ...form.f, value: t } })} keyboardType="decimal-pad" /></View>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                      <View style={{ flexGrow: 1, flexBasis: 160 }}><DateField label="Data da nota/recibo" mode="date" value={form.f.date} onChange={(t) => setForm({ ...form, f: { ...form.f, date: t } })} /></View>
                      <View style={{ flexGrow: 1, flexBasis: 160 }}><DateField label="Data do pagamento" mode="date" value={form.f.paid} onChange={(t) => setForm({ ...form, f: { ...form.f, paid: t } })} placeholder="dd/mm/aaaa" /></View>
                    </View>
                    <Field label="Observação" value={form.f.note} onChangeText={(t) => setForm({ ...form, f: { ...form.f, note: t } })} />
                    <View style={{ flexDirection: 'row', gap: 10 }}><Button title="Salvar despesa" onPress={saveExp} loading={busy} /><Button kind="outline" title="Cancelar" onPress={() => setForm(null)} /></View>
                  </View>
                ) : (
                  <Button kind="tonal" icon="add" title="Lançar despesa neste item" onPress={() => setForm({ itemId: x.item.id, f: { supplier: '', doc: '', number: '', value: '', date: todayBr(), paid: '', note: '' } })} />
                )}
                {change?.itemId === x.item.id ? (
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <Chip label="Normal" selected={change.status === 'normal'} onPress={() => setChange({ ...change, status: 'normal' })} />
                      <Chip label="Substituído" selected={change.status === 'substituido'} onPress={() => setChange({ ...change, status: 'substituido' })} />
                      <Chip label="Não adquirido" selected={change.status === 'nao_adquirido'} onPress={() => setChange({ ...change, status: 'nao_adquirido' })} />
                    </View>
                    {change.status !== 'normal' && <Field label="Justificativa (vai no RCO)" value={change.note} onChangeText={(t) => setChange({ ...change, note: t })} multiline />}
                    <View style={{ flexDirection: 'row', gap: 10 }}><Button title="Salvar situação" onPress={saveChange} /><Button kind="outline" title="Cancelar" onPress={() => setChange(null)} /></View>
                  </View>
                ) : (
                  <Button kind="ghost" title="Item trocado ou não comprado?" onPress={() => setChange({ itemId: x.item.id, status: x.item.exec_status ?? 'normal', note: x.item.exec_note ?? '' })} />
                )}
              </View>
            )}
          </Card>
        );
      })}
    </View>
  );
}

function Rco({ project, onExport, refresh, pending }: { project: { id: string; rco: Record<string, string> }; onExport: (texts: Record<string, string>) => Promise<void>; refresh: () => void; pending: { docs: number; over: number } }) {
  const [t, setT] = useState<Record<string, string>>({ ...(project.rco ?? {}) });
  const [busy, setBusy] = useState<string | null>(null);
  const dirty = JSON.stringify(t) !== JSON.stringify(project.rco ?? {});
  const save = async () => { setBusy('save'); try { await saveRcoTexts(project.id, t); toast('Textos do RCO salvos.'); refresh(); } catch (e) { toast(toFriendlyError(e).message, 'danger'); } finally { setBusy(null); } };
  return (
    <View style={{ gap: 12 }}>
      <T variant="small">O RCO sai do que já está no sistema: identificação, metas com o resultado medido pelo check-in, beneficiários real × previsto, combinado × gasto por etapa, detalhamento de cada etapa e relação de despesas. Aqui você escreve só os comentários.</T>
      {(pending.docs > 0 || pending.over > 0) && <Notice text={`Antes de enviar: ${[pending.docs && `${pending.docs} despesa(s) sem todos os comprovantes`, pending.over && `${pending.over} item(ns) acima do combinado`].filter(Boolean).join(' e ')}.`} />}
      {RCO_TEXTS.map((s) => (
        <Card key={s.key} style={{ gap: 6 }}>
          <T variant="body" style={{ fontWeight: '700' }}>{s.title}</T>
          <T variant="small">{s.hint}</T>
          <Field label={s.title} value={t[s.key] ?? ''} onChangeText={(v) => setT({ ...t, [s.key]: v })} multiline />
        </Card>
      ))}
      {dirty && <Button title="Salvar textos" onPress={save} loading={busy === 'save'} />}
      <Button big icon="document-text-outline" title="Baixar RCO (Word)" loading={busy === 'doc'}
        onPress={async () => { setBusy('doc'); try { if (dirty) await saveRcoTexts(project.id, t); await onExport(t); } catch (e) { toast(toFriendlyError(e).message, 'danger'); } finally { setBusy(null); } }} />
    </View>
  );
}
