// Menu de gestão (gestor e treinador).
import { router, type Href } from 'expo-router';
import { Button, Card, Notice, Screen, T } from '@/components/ui';
import { roleLabels, useMe } from '@/lib/me';
import { useTheme } from '@/lib/theme';

export default function Gestao() {
  const { isManager, isStaff, isPlatformAdmin, org, role, roles, setRole } = useMe();
  const canBeManager = !isManager && roles.includes('manager');
  const { colors } = useTheme();
  const items: { title: string; desc: string; href: Href; show: boolean }[] = [
    { title: 'Novo treino', desc: 'Marcar um treino (ou um treino de teste agora)', href: '/cadastro/treino', show: isStaff },
    { title: 'Projetos incentivados', desc: 'Plano aprovado, metas, beneficiários, indicadores e relatórios emitidos', href: '/projeto', show: isStaff },
    { title: 'Relatório de frequência', desc: 'PDF e planilha para prestação de contas de projetos e patrocinadores', href: '/cadastro/relatorio', show: isStaff },
    { title: 'Atletas', desc: 'Cadastrar atletas e colocar em equipes', href: '/cadastro/atletas', show: isStaff },
    { title: 'Locais de treino', desc: 'Cadastrar local com "Estou no local agora" e raio', href: '/cadastro/locais', show: isManager },
    { title: 'Equipes', desc: 'Criar equipes e categorias (Sub 15, Sub 17...)', href: '/cadastro/equipes', show: isManager },
    { title: 'Gestores e treinadores', desc: 'Dar acesso a outras pessoas pelo e-mail Google', href: '/cadastro/pessoas', show: isManager },
    { title: 'Nova organização', desc: 'Criar um clube ou escola cliente (admin da plataforma)', href: '/cadastro/organizacao', show: isPlatformAdmin },
  ];
  return (
    <Screen>
      <T variant="title">{org?.name ?? 'Gestão'}</T>
      {canBeManager && (
        <>
          <Notice
            tone="info"
            text={`Você está no modo ${role ? roleLabels[role] : ''}. Locais, Equipes e Gestores e treinadores aparecem no modo Gestor.`}
          />
          <Button title="Mudar para o modo Gestor" kind="outline" onPress={() => setRole('manager')} />
        </>
      )}
      {items.filter((i) => i.show).map((i) => (
        <Card key={i.title} onPress={() => router.push(i.href)}>
          <T variant="subtitle">{i.title}</T>
          <T variant="muted">{i.desc}</T>
          <T variant="small" color={colors.primary}>Abrir ›</T>
        </Card>
      ))}
    </Screen>
  );
}
