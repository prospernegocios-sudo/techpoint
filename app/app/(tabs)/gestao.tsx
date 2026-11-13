// Gestão em grupos (achado de UX nº 2). Cada pessoa vê só o que o seu papel permite;
// no modo "Equipe" não é preciso trocar de modo para achar as funções.
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Notice, Screen, T } from '@/components/ui';
import { useMe } from '@/lib/me';
import { useTheme } from '@/lib/theme';

type Item = { title: string; desc: string; href: Href; icon: keyof typeof Ionicons.glyphMap; show: boolean };

export default function Gestao() {
  const { isManager, isStaff, isAdmin, isPlatformAdmin, org, mode, modes, setMode } = useMe();
  const { colors } = useTheme();

  const groups: { title: string; items: Item[] }[] = [
    { title: 'Treinos e presença', items: [
      { title: 'Novo treino', desc: 'Marcar um treino ou um treino de teste agora', href: '/cadastro/treino', icon: 'calendar-outline', show: isStaff },
      { title: 'Relatórios', desc: 'Frequência avulsa ou relatório emitido de projeto', href: '/cadastro/relatorios', icon: 'document-text-outline', show: isStaff },
    ] },
    { title: 'Projetos', items: [
      { title: 'Projetos incentivados', desc: 'Plano aprovado, metas, beneficiários e indicadores', href: '/projeto', icon: 'ribbon-outline', show: isStaff },
    ] },
    { title: 'Estrutura', items: [
      { title: 'Atletas', desc: 'Cadastrar atletas e colocar em equipes', href: '/cadastro/atletas', icon: 'people-outline', show: isStaff },
      { title: 'Equipes', desc: 'Categorias e turmas (Sub 15, Sub 17...)', href: '/cadastro/equipes', icon: 'shirt-outline', show: isManager },
      { title: 'Locais de treino', desc: '"Estou no local agora" e raio permitido', href: '/cadastro/locais', icon: 'location-outline', show: isManager },
    ] },
    { title: 'Entidade', items: [
      { title: 'Dados da entidade', desc: 'CNPJ, endereço, logo e cores, responsáveis legais', href: '/entidade/dados', icon: 'business-outline', show: isAdmin },
      { title: 'Pessoas com acesso', desc: 'Administradores, gestores e treinadores', href: '/cadastro/pessoas', icon: 'key-outline', show: isManager },
    ] },
    { title: 'Equipe TechPoint', items: [
      { title: 'Entidades cadastradas', desc: 'Análise e contato com as entidades', href: '/entidade/analise', icon: 'shield-checkmark-outline', show: isPlatformAdmin },
    ] },
  ];
  const visible = groups.map((g) => ({ ...g, items: g.items.filter((i) => i.show) })).filter((g) => g.items.length > 0);

  return (
    <Screen>
      <T variant="title">{org?.name ?? 'Gestão'}</T>
      {mode !== 'team' && modes.includes('team') && (
        <Notice tone="info" text="Você está no modo Atleta. Toque aqui embaixo para voltar ao modo Equipe." />
      )}
      {mode !== 'team' && modes.includes('team') && (
        <Pressable accessibilityRole="button" onPress={() => setMode('team')} style={{ paddingVertical: 8 }}>
          <T variant="body" color={colors.primary} style={{ fontWeight: '700' }}>Usar o modo Equipe ›</T>
        </Pressable>
      )}
      {visible.map((g) => (
        <View key={g.title} style={{ gap: 8 }}>
          <T variant="small" style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>{g.title}</T>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }}>
            {g.items.map((i, idx) => (
              <Pressable
                key={i.title}
                accessibilityRole="button"
                accessibilityLabel={`${i.title}. ${i.desc}`}
                onPress={() => router.push(i.href)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, minHeight: 64,
                  borderTopWidth: idx ? 1 : 0, borderTopColor: colors.border, opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={i.icon} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="body" style={{ fontWeight: '700' }}>{i.title}</T>
                  <T variant="small">{i.desc}</T>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}
