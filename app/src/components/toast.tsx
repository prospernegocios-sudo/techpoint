// Aviso de sucesso (D86): pop-up no centro da tela por ~2 segundos, que some sozinho.
// Use toast('Logo salvo.') depois de qualquer ação que deu certo.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';

type Item = { id: number; text: string; tone: 'success' | 'danger' };
let listener: ((t: Item) => void) | null = null;
let seq = 0;

export function toast(text: string, tone: 'success' | 'danger' = 'success') {
  listener?.({ id: ++seq, text, tone });
}

export function ToastHost() {
  const { colors } = useTheme();
  const [item, setItem] = useState<Item | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    listener = (t) => setItem(t);
    return () => { listener = null; };
  }, []);
  useEffect(() => {
    if (!item) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start();
    const hide = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: Platform.OS !== 'web' }).start(() => setItem((cur) => (cur?.id === item.id ? null : cur)));
    }, 2000);
    return () => clearTimeout(hide);
  }, [item?.id]);
  if (!item) return null;
  const bg = item.tone === 'success' ? colors.success : colors.danger;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.18)', opacity }} />
      <Animated.View accessibilityRole="alert" accessibilityLiveRegion="polite"
        style={{ opacity, transform: [{ scale: opacity.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
          alignItems: 'center', gap: 10, width: 280, maxWidth: '86%', paddingVertical: 24, paddingHorizontal: 20, borderRadius: 28,
          backgroundColor: colors.surfaceContainerHigh, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={item.tone === 'success' ? 'checkmark' : 'alert'} size={32} color="#FFFFFF" />
        </View>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17, textAlign: 'center' }}>{item.text}</Text>
      </Animated.View>
    </View>
  );
}
