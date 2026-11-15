// Justificar falta (auditoria, item 16): o atleta ou o responsável escolhe o motivo e explica.
// Pode ser antes do treino ("não vou poder ir") ou depois (falta). O treinador vê no relatório de frequência.
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { toast } from '@/components/toast';
import { Button, Chip, Field, Notice, T, styles } from '@/components/ui';
import { REASONS, reasonLabel, saveJustification, type Justification, type Reason } from '@/lib/convocations';
import { toFriendlyError } from '@/lib/errors';
import { useTheme } from '@/lib/theme';

export function JustifyAbsence({ orgId, eventId, athleteId, label, existing, past }: {
  orgId: string; eventId: string; athleteId: string; label: string; existing?: Justification; past: boolean;
}) {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason | null>(existing?.reason ?? null);
  const [details, setDetails] = useState(existing?.details ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!reason) return setErr('Escolha o motivo.');
    if (reason === 'outro' && details.trim().length < 3) return setErr('Conte rapidamente o motivo.');
    setBusy(true); setErr(null);
    try {
      await saveJustification({ orgId, eventId, athleteId, reason, details });
      await qc.invalidateQueries({ queryKey: ['justifications'] });
      setOpen(false); toast('Justificativa enviada ao treinador.');
    } catch (e) { setErr(toFriendlyError(e).message); } finally { setBusy(false); }
  };
  return (
    <>
      {existing ? (
        <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={[styles.row, { gap: 6, paddingVertical: 4 }]}>
          <Text style={{ color: colors.text, fontSize: 14 }}>✓ Justificado: <Text style={{ fontWeight: '700' }}>{reasonLabel(existing.reason)}</Text>{existing.details ? ` · ${existing.details}` : ''}</Text>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Editar</Text>
        </Pressable>
      ) : (
        <Button title={past ? 'Justificar falta' : 'Não vou poder ir: justificar'} kind="tonal" icon="chatbox-ellipses-outline" onPress={() => setOpen(true)} />
      )}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: colors.surface, padding: 20, gap: 12, borderTopLeftRadius: 28, borderTopRightRadius: 28, width: '100%', maxWidth: 560 }}>
            <T variant="subtitle">{past ? 'Justificar falta' : 'Avisar que não vai'}</T>
            <T variant="small">{label}. O treinador recebe e vê no relatório de frequência.</T>
            <T variant="small" style={{ fontWeight: '700' }}>Qual o motivo?</T>
            <View style={styles.wrap}>{REASONS.map((r) => <Chip key={r.key} label={r.label} selected={reason === r.key} onPress={() => setReason(r.key)} />)}</View>
            <Field label={reason === 'outro' ? 'Conte o motivo' : 'Detalhes (opcional)'} value={details} onChangeText={setDetails} maxLength={500} multiline
              placeholder="Ex.: prova de matemática no mesmo horário" />
            {reason === 'saude' && <T variant="small">Se tiver atestado, envie também em Perfil › Documentos.</T>}
            {err && <Notice tone="danger" text={err} />}
            <Button title="Enviar justificativa" loading={busy} onPress={save} />
            <Button title="Cancelar" kind="ghost" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}
