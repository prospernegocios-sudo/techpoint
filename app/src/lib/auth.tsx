// Login com Google (uma vez) + sessão guardada + trava por biometria ao reabrir o app.
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const BIOMETRIC_KEY = 'techpoint.biometric';
// Volta a pedir a biometria se o app ficou em segundo plano por mais que isso.
const RELOCK_AFTER_MS = 2 * 60 * 1000;

type AuthCtx = {
  session: Session | null;
  loading: boolean;
  locked: boolean;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  signInWithGoogle: () => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
  unlock: () => Promise<boolean>;
  setBiometricEnabled: (on: boolean) => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [biometricEnabled, setBioEnabled] = useState(true);
  const [biometricAvailable, setBioAvailable] = useState(false);
  const backgroundAt = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data }, hasHw, enrolled, pref] = await Promise.all([
        supabase.auth.getSession(),
        LocalAuthentication.hasHardwareAsync().catch(() => false),
        LocalAuthentication.isEnrolledAsync().catch(() => false),
        SecureStore.getItemAsync(BIOMETRIC_KEY).catch(() => null),
      ]);
      const available = hasHw && enrolled;
      const enabled = pref !== 'off';
      setBioAvailable(available);
      setBioEnabled(enabled);
      setSession(data.session);
      setLocked(Boolean(data.session) && available && enabled);
      setLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Trava de novo quando o app volta depois de um tempo em segundo plano.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundAt.current = Date.now();
      if (state === 'active' && backgroundAt.current) {
        const away = Date.now() - backgroundAt.current;
        backgroundAt.current = null;
        if (away > RELOCK_AFTER_MS && session && biometricAvailable && biometricEnabled) setLocked(true);
      }
    });
    return () => sub.remove();
  }, [session, biometricAvailable, biometricEnabled]);

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloquear o TechPoint',
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar senha do celular',
      disableDeviceFallback: false,
    });
    if (result.success) setLocked(false);
    return result.success;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const redirectTo = Linking.createURL('auth-callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
      });
      if (error || !data?.url) throw error ?? new Error('sem url');
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type !== 'success') return { ok: false, message: 'Login cancelado.' };
      const url = new URL(res.url);
      const errDesc = url.searchParams.get('error_description');
      if (errDesc) return { ok: false, message: `O Google recusou o login: ${errDesc}` };
      const code = url.searchParams.get('code');
      if (!code) return { ok: false, message: 'Não recebemos a confirmação do Google. Tente de novo.' };
      const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
      if (exErr) throw exErr;
      setLocked(false);
      return { ok: true };
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (/network|fetch/i.test(msg)) return { ok: false, message: 'Sem internet. Conecte-se para entrar pela primeira vez.' };
      if (/provider is not enabled|Unsupported provider/i.test(msg)) {
        return { ok: false, message: 'O login com Google ainda não foi ativado no servidor.' };
      }
      return { ok: false, message: 'Não foi possível entrar com o Google. Tente de novo.' };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setLocked(false);
  }, []);

  const setBiometricEnabled = useCallback(async (on: boolean) => {
    if (!on) {
      // Desligar exige confirmar a identidade antes.
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirme para desligar a biometria' });
      if (!r.success) return;
    }
    await SecureStore.setItemAsync(BIOMETRIC_KEY, on ? 'on' : 'off');
    setBioEnabled(on);
  }, []);

  return (
    <Ctx.Provider
      value={{ session, loading, locked, biometricEnabled, biometricAvailable, signInWithGoogle, signOut, unlock, setBiometricEnabled }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
