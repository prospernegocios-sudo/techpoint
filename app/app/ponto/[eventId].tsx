// Ponto do profissional (treinador, auxiliar, gestor) num treino: foto na hora, localização e hora do servidor,
// como o check-in do atleta. Vira a folha de ponto do RCO (decisão 1a do TG).
import { useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { Button, Card, Field, Loading, Notice, Screen, T } from '@/components/ui';
import { getDeviceId, preparePhoto, readLocationOnce, type Fix, type LocationProblem } from '@/lib/attendance';
import { formatTime } from '@/lib/format';
import { formatDistance, isInsideRadius } from '@/lib/geo';
import { useMe } from '@/lib/me';
import { useEvent } from '@/lib/queries';
import { recordStaffPoint, type StaffKind, type StaffResult } from '@/lib/staff';
import { useTheme } from '@/lib/theme';

const locationMessages: Record<LocationProblem, string> = {
  permission_denied: 'Precisamos da sua localização no momento do ponto. Abra as configurações e permita a localização durante o uso do app.',
  services_off: 'O GPS do celular está desligado. Ligue a "Localização" e tente de novo.',
  unavailable: 'Não conseguimos achar sua localização. Vá para um lugar mais aberto e tente de novo.',
};

export default function PontoScreen() {
  const { eventId, kind: k } = useLocalSearchParams<{ eventId: string; kind: StaffKind }>();
  const kind: StaffKind = k === 'check_out' ? 'check_out' : 'check_in';
  const me = useMe();
  const event = useEvent(eventId);
  const qc = useQueryClient();
  const { colors } = useTheme();
  const [fix, setFix] = useState<Fix | null>(null);
  const [problem, setProblem] = useState<LocationProblem | null>(null);
  const [perm, requestPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<{ base64: string; sha256: string } | null>(null);
  const [result, setResult] = useState<StaffResult | null>(null);
  const [just, setJust] = useState('');

  const locate = useCallback(async () => {
    setProblem(null);
    const r = await readLocationOnce();
    if (r.problem) setProblem(r.problem); else setFix(r.fix!);
  }, []);
  useEffect(() => { locate(); }, [locate]);

  const send = async (ph: { base64: string; sha256: string }, justification?: string) => {
    if (!fix || !event.data || !me.profile) return;
    setBusy(true);
    const r = await recordStaffPoint({
      orgId: event.data.org_id, userId: me.profile.id, eventId: eventId!, kind, fix, photoBase64: ph.base64, photoSha256: ph.sha256,
      deviceId: await getDeviceId(), justification: justification ?? null,
    });
    setBusy(false);
    setResult(r);
    qc.invalidateQueries({ queryKey: ['my-staff-points'] });
  };
  const shoot = async () => {
    if (!cam.current || !fix) return;
    setBusy(true);
    try {
      const pic = await cam.current.takePictureAsync({ quality: 0.7 });
      const ph = await preparePhoto(pic.uri);
      setPhoto(ph);
      await send(ph);
    } catch {
      setBusy(false);
      setResult({ type: 'error', message: 'Não foi possível tirar a foto. Tente de novo.' });
    }
  };

  if (event.isLoading || me.loading) return <Loading />;
  const ev = event.data;
  const local = fix && ev?.venues ? isInsideRadius(fix, ev.venues) : null;
  const title = kind === 'check_in' ? 'Ponto de entrada' : 'Ponto de saída';

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      {ev && (
        <Card>
          <T variant="subtitle">{ev.teams?.name}</T>
          <T variant="muted">{ev.venues?.name} · {formatTime(ev.starts_at)}–{formatTime(ev.ends_at)}</T>
        </Card>
      )}
      <T variant="small">Seu ponto entra na folha de ponto do projeto, com foto, localização e a hora do servidor.</T>
      {problem && (
        <View style={{ gap: 10 }}>
          <Notice tone="danger" text={locationMessages[problem]} />
          {problem === 'permission_denied' && <Button title="Abrir configurações" onPress={() => Linking.openSettings()} />}
          <Button kind="outline" title="Tentar de novo" onPress={locate} />
        </View>
      )}
      {!fix && !problem && <Notice tone="info" text="Lendo sua localização..." />}
      {local && !result && (
        <Notice tone={local.inside ? 'success' : 'warning'} text={local.inside
          ? `Você está a ${formatDistance(local.distance)} do local, dentro da área (${ev!.venues!.radius_m} m).`
          : `Você está a ${formatDistance(local.distance)} do local, fora da área (${ev!.venues!.radius_m} m). Será pedida uma justificativa.`} />
      )}

      {!result && (
        !perm ? <Loading text="Preparando a câmera..." /> : !perm.granted ? (
          <View style={{ gap: 10 }}>
            <Notice text="Precisamos da câmera para a foto do ponto." />
            {perm.canAskAgain ? <Button title="Permitir câmera" onPress={requestPerm} /> : <Button title="Abrir configurações" onPress={() => Linking.openSettings()} />}
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <View style={{ borderRadius: 20, overflow: 'hidden', aspectRatio: 3 / 4, backgroundColor: '#000' }}>
              <CameraView ref={cam} style={{ flex: 1 }} facing="front" />
            </View>
            <Button big kind="accent" title={kind === 'check_in' ? 'Registrar entrada' : 'Registrar saída'} onPress={shoot} loading={busy} disabled={!fix} />
          </View>
        )
      )}

      {result?.type === 'outside_radius' && photo && (
        <View style={{ gap: 10 }}>
          <Notice tone="warning" text={`O servidor confirmou que você está fora da área${result.distance ? ` (${formatDistance(result.distance)} do local)` : ''}. Explique o motivo; o gestor vai ver na folha de ponto.`} />
          <Field label="Justificativa" value={just} onChangeText={setJust} multiline maxLength={300} placeholder="Ex.: treino na quadra anexa" />
          <Button title="Enviar com justificativa" disabled={just.trim().length < 3} loading={busy} onPress={() => send(photo, just.trim())} />
        </View>
      )}
      {result?.type === 'done' && (
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <T variant="title" color={colors.success} style={{ fontSize: 44 }}>✓</T>
          <T variant="title">{kind === 'check_in' ? 'Entrada registrada' : 'Saída registrada'}</T>
          <T variant="muted">às {formatTime(result.serverAt)} (hora do servidor){result.status === 'pending' ? ' · com justificativa' : ''}</T>
        </Card>
      )}
      {result?.type === 'error' && <Notice tone="danger" text={result.message} />}
      {result && result.type !== 'outside_radius' && <Button title="Voltar" onPress={() => router.back()} />}
    </Screen>
  );
}
