// Registro do celular do responsável para receber avisos de chegada e saída (push).
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Mostra o aviso mesmo com o app aberto.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

let registered = false;

export async function registerForPush(profileId: string): Promise<'ok' | 'denied' | 'unavailable'> {
  if (registered) return 'ok';
  if (Platform.OS === 'web' || !Device.isDevice) return 'unavailable';
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('avisos', {
        name: 'Chegada e saída', importance: Notifications.AndroidImportance.HIGH, sound: 'default',
      });
    }
    const current = await Notifications.getPermissionsAsync();
    const perm = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!perm.granted) return 'denied';
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('push_tokens').upsert({ token, profile_id: profileId, platform: Platform.OS, updated_at: new Date().toISOString() });
    registered = true;
    return 'ok';
  } catch {
    return 'unavailable';
  }
}
