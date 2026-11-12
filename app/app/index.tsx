// Porta de entrada: manda para o login ou para o app.
import { Redirect } from 'expo-router';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function Index() {
  const { session, loading } = useAuth();
  if (loading) return <Loading text="Abrindo o TechPoint..." />;
  return <Redirect href={session ? '/(tabs)' : '/login'} />;
}
