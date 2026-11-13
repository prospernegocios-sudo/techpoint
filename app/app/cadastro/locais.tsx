// Locais de treino. O ponto no mapa é capturado com "Estou no local agora"
// (sem mapa pago no MVP). O raio é configurável por local.
import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { Button, Card, Field, Notice, Screen, T, styles } from '@/components/ui';
import { readLocationOnce, type Fix } from '@/lib/attendance';
import { toFriendlyError } from '@/lib/errors';
import { useMe } from '@/lib/me';
import { useVenues, type Venue } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

export default function Locais() {
  const { org, isManager } = useMe();
  const venues = useVenues(org?.id);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Venue | 'new' | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [radius, setRadius] = useState('150');
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'danger' | 'success' | 'warning'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const start = (v: Venue | 'new') => {
    setEditing(v);
    setMsg(null);
    setFix(null);
    if (v === 'new') { setName(''); setAddress(''); setRadius('150'); }
    else { setName(v.name); setAddress(v.address ?? ''); setRadius(String(v.radius_m)); }
  };

  const here = async () => {
    setLocating(true);
    setMsg(null);
    const r = await readLocationOnce();
    setLocating(false);
    if (r.problem === 'permission_denied') {
      setMsg({ tone: 'danger', text: 'Permita a localização nas configurações do celular para marcar o local.' });
      Linking.openSettings();
      return;
    }
    if (r.problem) return setMsg({ tone: 'danger', text: 'Não conseguimos sua localização. Ligue o GPS e tente em um lugar aberto.' });
    setFix(r.fix!);
    const acc = r.fix!.accuracy ? Math.round(r.fix!.accuracy) : null;
    setMsg({ tone: acc && acc > 50 ? 'warning' : 'success', text: `Ponto marcado${acc ? ` (precisão de ${acc} m)` : ''}.${acc && acc > 50 ? ' A precisão está baixa: se puder, vá para o centro da quadra e marque de novo.' : ''}` });
  };

  const save = async () => {
    const r = Number(radius);
    if (name.trim().length < 2) return setMsg({ tone: 'danger', text: 'Dê um nome ao local.' });
    if (!Number.isInteger(r) || r < 20 || r > 2000) return setMsg({ tone: 'danger', text: 'O raio deve ser entre 20 e 2000 metros.' });
    if (editing === 'new' && !fix) return setMsg({ tone: 'danger', text: 'Toque em "Estou no local agora" estando no local.' });
    setSaving(true);
    const payload = { name: name.trim(), address: address.trim() || null, radius_m: r, ...(fix ? { latitude: fix.latitude, longitude: fix.longitude } : {}) };
    const { error } = editing === 'new'
      ? await supabase.from('venues').insert({ ...payload, org_id: org!.id, latitude: fix!.latitude, longitude: fix!.longitude })
      : await supabase.from('venues').update(payload).eq('id', (editing as Venue).id);
    setSaving(false);
    if (error) return setMsg({ tone: 'danger', text: toFriendlyError(error).message });
    qc.invalidateQueries({ queryKey: ['venues'] });
    setEditing(null);
    Alert.alert('Pronto', 'Local salvo.');
  };

  if (!isManager) return <Screen><Notice tone="danger" text="Apenas o gestor cadastra locais." /></Screen>;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Locais de treino' }} />
      {editing ? (
        <View style={{ gap: 12 }}>
          <T variant="subtitle">{editing === 'new' ? 'Novo local' : 'Editar local'}</T>
          <Field label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Ginásio do Clube" />
          <Field label="Endereço (opcional)" value={address} onChangeText={setAddress} placeholder="Rua, número, bairro" />
          <Field label="Raio permitido (metros)" value={radius} onChangeText={setRadius} keyboardType="number-pad" hint="Padrão: 150 m. Aumente se o local for grande." />
          <Button title={editing === 'new' ? 'Estou no local agora' : 'Atualizar ponto: estou no local agora'} kind={fix ? 'outline' : 'accent'} loading={locating} onPress={here} />
          {msg && <Notice tone={msg.tone} text={msg.text} />}
          <Button title="Salvar" loading={saving} onPress={save} />
          <Button title="Cancelar" kind="ghost" onPress={() => setEditing(null)} />
        </View>
      ) : (
        <>
          <Button title="+ Novo local" onPress={() => start('new')} />
          {venues.error && <Notice tone="danger" text="Não foi possível carregar os locais." />}
          {venues.data?.length === 0 && <Notice tone="info" text="Nenhum local ainda. Vá até o ginásio, toque em Novo local e use Estou no local agora." />}
          {(venues.data ?? []).map((v) => (
            <Card key={v.id} onPress={() => start(v)}>
              <T variant="subtitle">{v.name}</T>
              {v.address && <T variant="muted">{v.address}</T>}
              <View style={styles.wrap}><T variant="small">Raio: {v.radius_m} m · {v.latitude.toFixed(5)}, {v.longitude.toFixed(5)}</T></View>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
