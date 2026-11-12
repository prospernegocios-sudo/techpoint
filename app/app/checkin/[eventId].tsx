// Check-in / check-out do atleta:
// 1) lê a localização uma vez  2) tira a foto na hora (só câmera, nunca galeria)
// 3) envia ao servidor, que confere hora, raio e antifraude.
import { useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Linking, View } from 'react-native';
import { Button, Card, Field, Loading, Notice, Screen, T } from '@/components/ui';
import {
  getDeviceId, newPendingRecord, preparePhoto, readLocationOnce, submitRecord,
  type Fix, type Kind, type LocationProblem, type PendingRecord, type SubmitResult,
} from '@/lib/attendance';
import { flagLabels } from '@/lib/errors';
import { formatTime } from '@/lib/format';
import { formatDistance, isInsideRadius } from '@/lib/geo';
import { useMe } from '@/lib/me';
import { useEvent } from '@/lib/queries';
import { useTheme } from '@/lib/theme';

type Step = 'locating' | 'location_problem' | 'camera' | 'review' | 'sending' | 'justify' | 'result';

const locationMessages: Record<LocationProblem, string> = {
  permission_denied: 'Precisamos da sua localização no momento do registro. Toque em "Abrir configurações", vá em Permissões > Localização e escolha "Permitir durante o uso do app".',
  services_off: 'O GPS do celular está desligado. Puxe a barra de notificações e ligue a "Localização".',
  unavailable: 'Não conseguimos achar sua localização. Vá para um lugar mais aberto, perto de uma janela ou porta, e tente de novo.',
};

export default function CheckinScreen() {
  const { eventId, kind: kindParam } = useLocalSearchParams<{ eventId: string; kind: Kind }>();
  const kind: Kind = kindParam === 'check_out' ? 'check_out' : 'check_in';
  const label = kind === 'check_in' ? 'check-in' : 'check-out';
  const { colors } = useTheme();
  const me = useMe();
  const qc = useQueryClient();
  const event = useEvent(eventId);
  const [step, setStep] = useState<Step>('locating');
  const [problem, setProblem] = useState<LocationProblem | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [record, setRecord] = useState<PendingRecord | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [justification, setJustification] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [taking, setTaking] = useState(false);

  const locate = useCallback(async () => {
    setStep('locating');
    const r = await readLocationOnce();
    if (r.problem) {
      setProblem(r.problem);
      setStep('location_problem');
      return;
    }
    setFix(r.fix!);
    setStep('camera');
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    setTaking(true);
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.7, skipProcessing: false });
      setPhotoUri(pic.uri);
      setStep('review');
    } catch {
      setCameraError('Não foi possível tirar a foto. Feche outros apps que usam a câmera e tente de novo.');
    } finally {
      setTaking(false);
    }
  };

  const send = async (rec: PendingRecord) => {
    setStep('sending');
    const r = await submitRecord(rec);
    if (r.type === 'outside_radius') {
      setResult(r);
      setStep('justify');
      return;
    }
    setResult(r);
    setStep('result');
    qc.invalidateQueries({ queryKey: ['my-attendance'] });
  };

  const confirm = async () => {
    if (!photoUri || !fix || !me.athlete || !eventId) return;
    setStep('sending');
    try {
      const photo = await preparePhoto(photoUri);
      const rec = newPendingRecord({
        eventId, athleteId: me.athlete.id, kind, fix, clientAt: new Date().toISOString(),
        photoBase64: photo.base64, photoSha256: photo.sha256, deviceId: await getDeviceId(), justification: null,
      });
      setRecord(rec);
      await send(rec);
    } catch {
      setResult({ type: 'error', error: { code: 'PHOTO', message: 'Não foi possível preparar a foto. Tire outra foto e tente de novo.' } });
      setStep('result');
    }
  };

  const sendJustification = async () => {
    if (!record || justification.trim().length < 3) return;
    const rec = { ...record, justification: justification.trim() };
    setRecord(rec);
    await send(rec);
  };

  if (event.isLoading || me.loading) return <Loading />;
  const ev = event.data;
  const venue = ev?.venues;
  const local = fix && venue ? isInsideRadius(fix, venue) : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: kind === 'check_in' ? 'Check-in' : 'Check-out' }} />
      {ev && (
        <Card>
          <T variant="subtitle">{ev.teams?.name}</T>
          <T variant="muted">{venue?.name} · {formatTime(ev.starts_at)}–{formatTime(ev.ends_at)}</T>
        </Card>
      )}
      {!me.athlete && <Notice tone="danger" text="Seu cadastro de atleta não está ligado a esta conta. Fale com o gestor." />}

      {step === 'locating' && <Loading text="Buscando sua localização..." />}

      {step === 'location_problem' && problem && (
        <View style={{ gap: 12 }}>
          <Notice tone="danger" text={locationMessages[problem]} />
          {problem === 'permission_denied' && <Button title="Abrir configurações" onPress={() => Linking.openSettings()} />}
          <Button title="Tentar de novo" kind="outline" onPress={locate} />
        </View>
      )}

      {local && step !== 'result' && (
        <Notice
          tone={local.inside ? 'success' : 'warning'}
          text={local.inside
            ? `Você está a ${formatDistance(local.distance)} do local. Dentro da área permitida (${venue!.radius_m} m).`
            : `Você está a ${formatDistance(local.distance)} do local, fora da área permitida (${venue!.radius_m} m). Você poderá enviar uma justificativa para o treinador.`}
        />
      )}
      {fix?.mocked && step !== 'result' && (
        <Notice tone="danger" text="Detectamos que a localização do celular está sendo simulada por outro app. O registro irá para aprovação do treinador." />
      )}

      {step === 'camera' && (
        <View style={{ gap: 12 }}>
          {!camPerm ? (
            <Loading text="Preparando a câmera..." />
          ) : !camPerm.granted ? (
            <View style={{ gap: 12 }}>
              <Notice text="Precisamos da câmera para a foto do registro. A foto é tirada na hora e só o seu treinador vê." />
              {camPerm.canAskAgain ? (
                <Button title="Permitir câmera" onPress={requestCamPerm} />
              ) : (
                <Button title="Abrir configurações" onPress={() => Linking.openSettings()} />
              )}
            </View>
          ) : cameraError ? (
            <View style={{ gap: 12 }}>
              <Notice tone="danger" text={cameraError} />
              <Button title="Tentar de novo" kind="outline" onPress={() => setCameraError(null)} />
            </View>
          ) : (
            <>
              <T variant="muted">Enquadre o seu rosto e toque em "Tirar foto".</T>
              <View style={{ borderRadius: 20, overflow: 'hidden', aspectRatio: 3 / 4, backgroundColor: '#000' }}>
                <CameraView
                  ref={cameraRef}
                  style={{ flex: 1 }}
                  facing="front"
                  onMountError={() => setCameraError('A câmera não está disponível agora. Feche outros apps que usam a câmera e tente de novo.')}
                />
              </View>
              <Button title="Tirar foto" kind="accent" big loading={taking} onPress={takePhoto} />
            </>
          )}
        </View>
      )}

      {step === 'review' && photoUri && (
        <View style={{ gap: 12 }}>
          <Image source={{ uri: photoUri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 20 }} accessibilityLabel="Foto tirada agora" />
          <Button title={`Confirmar ${label}`} kind="accent" big onPress={confirm} />
          <Button title="Tirar outra foto" kind="outline" onPress={() => { setPhotoUri(null); setStep('camera'); }} />
        </View>
      )}

      {step === 'sending' && <Loading text="Enviando seu registro..." />}

      {step === 'justify' && (
        <View style={{ gap: 12 }}>
          <Notice
            tone="warning"
            text={`O servidor confirmou que você está fora da área do treino${result?.type === 'outside_radius' && result.distance ? ` (${formatDistance(result.distance)} do local)` : ''}. Se você está no treino, explique o motivo. Seu treinador vai aprovar ou recusar.`}
          />
          <Field
            label="Justificativa"
            placeholder="Ex.: o GPS marca errado dentro do ginásio"
            value={justification}
            onChangeText={setJustification}
            multiline
            maxLength={300}
          />
          <Button title="Enviar para o treinador" disabled={justification.trim().length < 3} onPress={sendJustification} />
          <Button title="Cancelar" kind="ghost" onPress={() => router.back()} />
        </View>
      )}

      {step === 'result' && result && (
        <View style={{ gap: 12 }}>
          {result.type === 'done' && result.status === 'valid' && (
            <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
              <T variant="title" color={colors.success} style={{ fontSize: 48 }}>✓</T>
              <T variant="title">{kind === 'check_in' ? 'Check-in feito!' : 'Check-out feito!'}</T>
              <T variant="muted">Registrado às {formatTime(result.serverAt)} (hora do servidor)</T>
            </Card>
          )}
          {result.type === 'done' && result.status === 'pending' && (
            <Notice tone="warning" text={`Registro enviado às ${formatTime(result.serverAt)} e aguardando aprovação do treinador.`} />
          )}
          {result.type === 'done' && result.flags.filter((f) => f !== 'outside_radius').length > 0 && (
            <T variant="small">Observações: {result.flags.map((f) => flagLabels[f] ?? f).join(', ')}</T>
          )}
          {result.type === 'queued' && (
            <Notice tone="warning" text="Sem internet agora. Seu registro foi guardado no celular com a hora real e será enviado automaticamente quando a conexão voltar. Não desinstale o app até lá." />
          )}
          {result.type === 'error' && <Notice tone="danger" text={result.error.message} />}
          <Button title="Voltar ao início" onPress={() => router.back()} />
        </View>
      )}
    </Screen>
  );
}
