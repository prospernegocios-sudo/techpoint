// Endereço desconhecido: se for o endereço de uma entidade (ex.: /dfvolei), mostra a entrada com a marca dela.
import { usePathname } from 'expo-router';
import { BrandEntry } from '@/components/brand-entry';

export default function NaoEncontrado() {
  const path = usePathname();
  const slug = path.replace(/^\/+|\/+$/g, '').split('/')[0] ?? '';
  return <BrandEntry slug={slug.toLowerCase()} />;
}
