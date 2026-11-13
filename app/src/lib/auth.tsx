// Login com Google (uma vez) + sessão guardada + trava por biometria ao reabrir o app.
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const BIOMETRIC_KEY = 'techpoint.biometric';
// Volta a pedir a biometria se o app ficou em segundo plano por mais que isso (ajustável no Perfil).
const RELOCK_KEY = 'techpoint.relock-min';
export const RELOCK_OPTIONS = [2, 10, 30];

type AuthCtx = {
  session: Session | null;
  loading: boolean;
  locked: boolean;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  signInWithGoogle: () => Promise<{ ok: boolean; message?: string }>;
  signInWithPassword: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signUpWithPassword: (email: string, password: string, fullName: string) => Promise<{ ok: boolean; message?: string }>;
  resetPassword: (email: string) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
  unlock: () => Promise<boolean>;
  setBiometricEnabled: (on: boolean) => Promise<void>;
  relockMinutes: number;
  setRelockMinutes: (m: number) => void;
};

const Ctx = createContext<AuthCtx | null>(null);

// O código do Google só pode ser trocado uma vez. A troca pode ser pedida por dois
// caminhos (retorno do navegador e abertura do app pelo link), então guardamos a promessa.
const exchanges = new Map<string, Promise<{ ok: boolean; message?: string }>>();
export function completeSignIn(code: string) {
  let p = exchanges.get(code);
  if (!p) {
    p = supabase.auth.exchangeCodeForSession(code).then(({ error }) =>
      error ? { ok: false, message: 'Não foi possível concluir o login. Tente de novo.' } : { ok: true },
    );
    exchanges.set(code, p);
  }
  return p;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [biometricEnabled, setBioEnabled] = useState(true);
  const [biometricAvailable, setBioAvailable] = useState(false);
  const backgroundAt = useRef<number | null>(null);
  const [relockMinutes, setRelockState] = useState(2);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    SecureStore.getItemAsync(RELOCK_KEY).then((v) => { if (v && RELOCK_OPTIONS.includes(Number(v))) setRelockState(Number(v)); }).catch(() => {});
  }, []);
  const setRelockMinutes = useCallback((m: number) => {
    setRelockState(m);
    SecureStore.setItemAsync(RELOCK_KEY, String(m)).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      const web = Platform.OS === 'web'; // no navegador não há biometria do aparelho
      const [{ data }, hasHw, enrolled, pref] = await Promise.all([
        supabase.auth.getSession(),
        web ? false : LocalAuthentication.hasHardwareAsync().catch(() => false),
        web ? false : LocalAuthentication.isEnrolledAsync().catch(() => false),
        web ? null : SecureStore.getItemAsync(BIOMETRIC_KEY).catch(() => null),
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
        if (away > relockMinutes * 60_000 && session && biometricAvailable && biometricEnabled) setLocked(true);
      }
    });
    return () => sub.remove();
  }, [session, biometricAvailable, biometricEnabled, relockMinutes]);

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
      if (Platform.OS === 'web') {
        // Navegador: vai para o Google e volta para /auth-callback deste mesmo site.
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/auth-callback`, queryParams: { prompt: 'select_account' } },
        });
        if (error) throw error;
        return { ok: true };
      }
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
      const r = await completeSignIn(code);
      if (r.ok) setLocked(false);
      return r;
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (/network|fetch/i.test(msg)) return { ok: false, message: 'Sem internet. Conecte-se para entrar pela primeira vez.' };
      if (/provider is not enabled|Unsupported provider/i.test(msg)) {
        return { ok: false, message: 'O login com Google ainda não foi ativado no servidor.' };
      }
      return { ok: false, message: 'Não foi possível entrar com o Google. Tente de novo.' };
    }
  }, []);

  // Conta com e-mail e senha (para quem não tem Google).
  const callbackUrl = () => (Platform.OS === 'web' ? `${window.location.origin}/auth-callback` : Linking.createURL('auth-callback'));
  const passwordError = (msg: string) => {
    if (/invalid login|invalid credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
    if (/not confirmed/i.test(msg)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
    if (/already registered|already been registered/i.test(msg)) return 'Este e-mail já tem conta. Use "Entrar" ou "Esqueci a senha".';
    if (/password should be|weak/i.test(msg)) return 'A senha precisa ter pelo menos 8 caracteres, com letras e números.';
    if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas. Aguarde alguns minutos.';
    if (/network|fetch/i.test(msg)) return 'Sem internet. Conecte-se e tente de novo.';
    return 'Não foi possível concluir. Tente de novo.';
  };

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) return { ok: false, message: passwordError(error.message) };
    setLocked(false);
    return { ok: true };
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(), password,
      options: { data: { full_name: fullName.trim() }, emailRedirectTo: callbackUrl() },
    });
    if (error) return { ok: false, message: passwordError(error.message) };
    if (!data.session) return { ok: true, message: 'Conta criada. Enviamos um link de confirmação para o seu e-mail: abra o link e depois entre com e-mail e senha.' };
    return { ok: true };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: callbackUrl() });
    if (error) return { ok: false, message: passwordError(error.message) };
    return { ok: true, message: 'Se o e-mail tiver conta, enviamos um link para entrar. Depois, defina uma nova senha em Perfil.' };
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
      value={{ session, loading, locked, biometricEnabled, biometricAvailable, signInWithGoogle, signInWithPassword, signUpWithPassword, resetPassword, signOut, unlock, setBiometricEnabled, relockMinutes, setRelockMinutes }}
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
