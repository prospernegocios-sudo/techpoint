// Check-in / check-out: localização no instante, foto da câmera, envio e fila offline.
// A localização é lida SOMENTE quando o atleta toca no botão. Nada roda em segundo plano.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { isNetworkError, toFriendlyError, type FriendlyError } from './errors';
import { PHOTO_BUCKET, supabase } from './supabase';

export type Kind = 'check_in' | 'check_out';

export type Fix = { latitude: number; longitude: number; accuracy: number | null; mocked: boolean; at: string };

export type LocationProblem = 'permission_denied' | 'services_off' | 'unavailable';

/** Lê a localização uma única vez. */
export async function readLocationOnce(): Promise<{ fix?: Fix; problem?: LocationProblem }> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') return { problem: 'permission_denied' };
  if (!(await Location.hasServicesEnabledAsync())) return { problem: 'services_off' };
  try {
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000)),
    ]);
    return {
      fix: {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
        // Android informa quando a localização vem de app de "GPS falso".
        mocked: Boolean(pos.mocked),
        at: new Date(pos.timestamp || Date.now()).toISOString(),
      },
    };
  } catch {
    return { problem: 'unavailable' };
  }
}

let cachedDeviceId: string | null = null;
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  let id: string | null = null;
  try {
    id = Platform.OS === 'android' ? Application.getAndroidId() : await Application.getIosIdForVendorAsync();
  } catch {
    id = null;
  }
  cachedDeviceId = `${Platform.OS}:${id ?? 'desconhecido'}`;
  return cachedDeviceId;
}

/** Reduz a foto (economiza dados e armazenamento) e devolve base64 + impressão digital (SHA-256). */
export async function preparePhoto(uri: string): Promise<{ base64: string; sha256: string }> {
  const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 720 } }], {
    compress: 0.6,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!out.base64) throw new Error('foto sem conteúdo');
  const bytes = base64ToBytes(out.base64);
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  const sha256 = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return { base64: out.base64, sha256 };
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export type PendingRecord = {
  localId: string;
  eventId: string;
  athleteId: string;
  kind: Kind;
  fix: Fix;
  clientAt: string;
  photoBase64: string;
  photoSha256: string;
  photoPath: string;
  deviceId: string;
  justification: string | null;
};

export type SubmitResult =
  | { type: 'done'; status: 'valid' | 'pending'; serverAt: string; distance: number; flags: string[] }
  | { type: 'queued' }
  | { type: 'outside_radius'; distance?: number; radius?: number }
  | { type: 'error'; error: FriendlyError };

async function uploadPhoto(path: string, base64: string) {
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, base64ToBytes(base64), { contentType: 'image/jpeg', upsert: false });
  // "já existe" acontece numa nova tentativa: tudo bem, a foto já está lá.
  if (error && !/exists|Duplicate/i.test(error.message)) throw error;
}

async function callServer(rec: PendingRecord, offline: boolean) {
  const { data, error } = await supabase.rpc('record_attendance', {
    p_event_id: rec.eventId,
    p_kind: rec.kind,
    p_latitude: rec.fix.latitude,
    p_longitude: rec.fix.longitude,
    p_accuracy_m: rec.fix.accuracy,
    p_photo_path: rec.photoPath,
    p_photo_sha256: rec.photoSha256,
    p_device_id: rec.deviceId,
    p_is_mocked: rec.fix.mocked,
    p_client_at: rec.clientAt,
    p_synced_offline: offline,
    p_justification: rec.justification,
  });
  if (error) throw error;
  return data as { status: 'valid' | 'pending'; server_at: string; distance_m: number; flags: string[] };
}

/** Envia agora; se não houver internet, guarda na fila com a hora real do registro. */
export async function submitRecord(rec: PendingRecord): Promise<SubmitResult> {
  try {
    await uploadPhoto(rec.photoPath, rec.photoBase64);
    const r = await callServer(rec, false);
    return { type: 'done', status: r.status, serverAt: r.server_at, distance: r.distance_m, flags: r.flags };
  } catch (e) {
    if (isNetworkError(e)) {
      await enqueue(rec);
      return { type: 'queued' };
    }
    const fe = toFriendlyError(e);
    if (fe.code === 'TP_OUTSIDE_RADIUS') {
      return { type: 'outside_radius', distance: Number(fe.detail?.distance_m), radius: Number(fe.detail?.radius_m) };
    }
    return { type: 'error', error: fe };
  }
}

// ---------------- Fila offline ----------------
const QUEUE_KEY = 'techpoint.offline-queue';

export async function getQueue(): Promise<PendingRecord[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? '[]');
  } catch {
    return [];
  }
}

async function saveQueue(q: PendingRecord[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

async function enqueue(rec: PendingRecord) {
  const q = await getQueue();
  if (!q.some((r) => r.localId === rec.localId)) q.push(rec);
  await saveQueue(q);
}

let syncing = false;
/** Tenta enviar o que ficou guardado. Devolve quantos foram enviados e os erros definitivos. */
export async function syncQueue(): Promise<{ sent: number; failed: { rec: PendingRecord; error: FriendlyError }[]; remaining: number }> {
  if (syncing) return { sent: 0, failed: [], remaining: (await getQueue()).length };
  syncing = true;
  let sent = 0;
  const failed: { rec: PendingRecord; error: FriendlyError }[] = [];
  try {
    const q = await getQueue();
    const keep: PendingRecord[] = [];
    for (const rec of q) {
      try {
        await uploadPhoto(rec.photoPath, rec.photoBase64);
        await callServer(rec, true);
        sent++;
      } catch (e) {
        if (isNetworkError(e)) {
          keep.push(rec); // continua sem internet: tenta depois
        } else {
          const fe = toFriendlyError(e);
          if (fe.code === 'TP_ALREADY_RECORDED') sent++;
          else failed.push({ rec, error: fe }); // erro definitivo: avisa e tira da fila
        }
      }
    }
    await saveQueue(keep);
    return { sent, failed, remaining: keep.length };
  } finally {
    syncing = false;
  }
}

export function newPendingRecord(p: Omit<PendingRecord, 'localId' | 'photoPath' | 'clientAt'> & { clientAt?: string }): PendingRecord {
  const localId = Crypto.randomUUID();
  return {
    ...p,
    localId,
    clientAt: p.clientAt ?? new Date().toISOString(),
    photoPath: `${p.athleteId}/${p.eventId}/${p.kind}-${localId}.jpg`,
  };
}
