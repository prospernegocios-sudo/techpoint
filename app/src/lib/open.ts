// Abre uma tela do app: no site em uma nova aba; no celular, por cima da tela atual.
import { router } from 'expo-router';
import { Platform } from 'react-native';

export function openInNewTab(path: string) {
  if (Platform.OS === 'web') window.open(path, '_blank', 'noopener');
  else router.push(path as never);
}
