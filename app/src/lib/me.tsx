// Quem sou eu: organizações, papéis e cadastros de atleta da conta logada.
// Uma mesma conta pode ter vários papéis; o usuário escolhe em qual "modo" está.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import { useTheme } from './theme';
import { supabase } from './supabase';

export type Role = 'admin' | 'manager' | 'coach' | 'athlete' | 'guardian';
export const roleLabels: Record<Role, string> = {
  admin: 'Administrador',
  manager: 'Gestor',
  coach: 'Treinador',
  athlete: 'Atleta',
  guardian: 'Responsável',
};

export type Org = {
  id: string; name: string; review_status?: 'pending' | 'approved' | 'suspended';
  logo_path?: string | null; theme_primary?: string | null; theme_accent?: string | null;
};
export type Profile = { id: string; full_name: string | null; email: string | null; is_platform_admin: boolean };
type Membership = { org_id: string; role: Role; organizations: Org | null };
export type MyAthlete = { id: string; org_id: string; full_name: string };

type MeData = { profile: Profile | null; memberships: Membership[]; athletes: MyAthlete[] };

async function fetchMe(userId: string): Promise<MeData> {
  const [p, m, a] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, is_platform_admin').eq('id', userId).maybeSingle(),
    supabase.from('memberships').select('org_id, role, organizations(id, name, review_status, logo_path, theme_primary, theme_accent)').eq('profile_id', userId).eq('active', true),
    supabase.from('athletes').select('id, org_id, full_name').eq('profile_id', userId),
  ]);
  if (p.error) throw p.error;
  if (m.error) throw m.error;
  if (a.error) throw a.error;
  return {
    profile: p.data as Profile | null,
    memberships: (m.data ?? []) as unknown as Membership[],
    athletes: (a.data ?? []) as MyAthlete[],
  };
}

type MeCtx = {
  loading: boolean;
  error: unknown;
  refetch: () => void;
  profile: Profile | null;
  orgs: Org[];
  org: Org | null;
  setOrgId: (id: string) => void;
  roles: Role[];            // papéis na organização atual
  role: Role | null;        // modo atual
  setRole: (r: Role) => void;
  athlete: MyAthlete | null; // meu cadastro de atleta na organização atual
  isStaff: boolean;
  isManager: boolean;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
};

const Ctx = createContext<MeCtx | null>(null);
const KEY = 'techpoint.mode';

export function MeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const q = useQuery({ queryKey: ['me', userId], queryFn: () => fetchMe(userId!), enabled: Boolean(userId) });
  const [orgId, setOrgId] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const s = JSON.parse(raw);
        setOrgId(s.orgId ?? null);
        setRole(s.role ?? null);
      })
      .catch(() => {});
  }, []);

  const value = useMemo<MeCtx>(() => {
    const data = q.data;
    const orgMap = new Map<string, Org>();
    data?.memberships.forEach((m) => m.organizations && orgMap.set(m.org_id, m.organizations));
    const orgs = [...orgMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    const org = orgs.find((o) => o.id === orgId) ?? orgs[0] ?? null;
    const order: Role[] = ['admin', 'manager', 'coach', 'athlete', 'guardian'];
    const roles = order.filter((r) => data?.memberships.some((m) => m.org_id === org?.id && m.role === r));
    const current = role && roles.includes(role) ? role : roles[0] ?? null;
    const athlete = data?.athletes.find((a) => a.org_id === org?.id) ?? null;
    const isPlatformAdmin = Boolean(data?.profile?.is_platform_admin);
    return {
      loading: q.isLoading,
      error: q.error,
      refetch: () => void q.refetch(),
      profile: data?.profile ?? null,
      orgs,
      org,
      setOrgId: (id) => {
        setOrgId(id);
        AsyncStorage.setItem(KEY, JSON.stringify({ orgId: id, role })).catch(() => {});
      },
      roles,
      role: current,
      setRole: (r) => {
        setRole(r);
        AsyncStorage.setItem(KEY, JSON.stringify({ orgId: org?.id, role: r })).catch(() => {});
      },
      athlete,
      // Administrador faz tudo que o gestor faz (e mais).
      isStaff: current === 'admin' || current === 'manager' || current === 'coach',
      isManager: current === 'admin' || current === 'manager',
      isAdmin: current === 'admin',
      isPlatformAdmin,
    };
  }, [q.data, q.isLoading, q.error, orgId, role]);

  // Aplica as cores do clube atual no tema de todos que usam esta entidade.
  const { setClubColors } = useTheme();
  const tp = value.org?.theme_primary, ta = value.org?.theme_accent;
  useEffect(() => {
    setClubColors(tp && ta ? { primary: tp, accent: ta } : null);
  }, [tp, ta, setClubColors]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Endereço público do logo da entidade. */
export function orgLogoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from('org-logos').getPublicUrl(path).data.publicUrl;
}

export function useMe() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMe fora do MeProvider');
  return ctx;
}
