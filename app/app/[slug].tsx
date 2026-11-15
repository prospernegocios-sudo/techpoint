// techpoint.app.br/<endereço-da-entidade>: entrada com a marca do clube (white label).
import { useLocalSearchParams } from 'expo-router';
import { BrandEntry } from '@/components/brand-entry';

export default function EntradaDaEntidade() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <BrandEntry slug={slug!} />;
}
