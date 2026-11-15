// Perfil do currículo (D84): foto, título, sobre mim, metas, contatos, referências e galeria.
// Só o atleta e os responsáveis editam. Contatos no link público só com "mostrar contatos" ligado.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Image, Switch, View } from 'react-native';
import { Button, Card, Field, Notice, T, styles } from '@/components/ui';
import type { CvProfile, CvReference } from '@/lib/cv';
import { pickAndUploadCvImage, removeCvImage } from '@/lib/cv-media';
import { toFriendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

type Props = { athleteId: string; profile: CvProfile | null | undefined; photoUrl: string | null; galleryUrls: string[] };

export function CvProfileCard({ athleteId, profile, photoUrl, galleryUrls }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ headline: '', about: '', goals: '', phone: '', email: '', instagram: '', city: '', show: false });
  const [refs, setRefs] = useState<CvReference[]>([]);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setF({
      headline: profile?.headline ?? '', about: profile?.about ?? '', goals: (profile?.goals ?? []).join('\n'),
      phone: profile?.contact_phone ?? '', email: profile?.contact_email ?? '', instagram: profile?.instagram ?? '', city: profile?.city ?? '',
      show: profile?.show_contacts ?? false,
    });
    setRefs(profile?.references ?? []);
  }, [profile]);
  const refresh = () => qc.invalidateQueries({ queryKey: ['cv', athleteId] });
  const upsert = async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from('athlete_cv_profile').upsert({ athlete_id: athleteId, ...patch, updated_at: new Date().toISOString() });
    if (error) throw error;
  };

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      await upsert({
        headline: f.headline.trim() || null, about: f.about.trim() || null,
        goals: f.goals.split('\n').map((g) => g.replace(/^[•\-–*]\s*/, '').trim()).filter(Boolean).slice(0, 10),
        contact_phone: f.phone.trim() || null, contact_email: f.email.trim() || null, instagram: f.instagram.trim() || null,
        city: f.city.trim() || null, show_contacts: f.show,
        references: refs.filter((r) => r.name.trim()).slice(0, 4).map((r) => ({ name: r.name.trim(), role: r.role?.trim() || null, phone: r.phone?.trim() || null })),
      });
      setMsg({ tone: 'success', text: 'Currículo salvo.' }); refresh();
    } catch (e) { setMsg({ tone: 'danger', text: toFriendlyError(e).message }); } finally { setBusy(false); }
  };

  const setPhoto = async () => {
    try {
      const path = await pickAndUploadCvImage(athleteId, 'foto');
      if (!path) return;
      const old = profile?.photo_path;
      await upsert({ photo_path: path });
      if (old) await removeCvImage(old);
      refresh();
    } catch (e) { setMsg({ tone: 'danger', text: toFriendlyError(e).message }); }
  };
  const addGallery = async () => {
    if ((profile?.gallery?.length ?? 0) >= 6) return setMsg({ tone: 'danger', text: 'Até 6 fotos na galeria.' });
    try {
      const path = await pickAndUploadCvImage(athleteId, 'galeria');
      if (!path) return;
      await upsert({ gallery: [...(profile?.gallery ?? []), path] });
      refresh();
    } catch (e) { setMsg({ tone: 'danger', text: toFriendlyError(e).message }); }
  };
  const removeGallery = async (i: number) => {
    const g = [...(profile?.gallery ?? [])];
    const [gone] = g.splice(i, 1);
    await upsert({ gallery: g });
    if (gone) await removeCvImage(gone);
    refresh();
  };

  return (
    <Card>
      <View style={[styles.row, { alignItems: 'center' }]}>
        {photoUrl
          ? <Image source={{ uri: photoUrl }} style={{ width: 72, height: 90, borderRadius: 10 }} accessibilityLabel="Foto do atleta" />
          : <View style={{ width: 72, height: 90, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#A3ACBB', alignItems: 'center', justifyContent: 'center' }}><T variant="small">Sem foto</T></View>}
        <View style={{ flex: 1, gap: 6 }}>
          <Button title={photoUrl ? 'Trocar foto' : 'Pôr foto do atleta'} kind="outline" onPress={setPhoto} />
          <Button title={open ? 'Fechar edição' : 'Editar sobre mim, metas, contatos'} kind="ghost" onPress={() => setOpen(!open)} />
        </View>
      </View>
      {msg && <Notice tone={msg.tone} text={msg.text} />}
      {open && (
        <View style={{ gap: 8 }}>
          <Field label="Título" value={f.headline} onChangeText={(v) => setF({ ...f, headline: v })} maxLength={80} placeholder="Ex.: Jogador de vôlei de areia" />
          <Field label="Sobre mim" value={f.about} onChangeText={(v) => setF({ ...f, about: v })} maxLength={1500} multiline placeholder="Escola, rotina de treinos, trajetória e objetivos" />
          <Field label="Metas (uma por linha)" value={f.goals} onChangeText={(v) => setF({ ...f, goals: v })} multiline placeholder={'Integrar um clube de alto rendimento\nJogar um mundial Sub 19'} />
          <T variant="subtitle">Contatos</T>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Telefone" keyboardType="phone-pad" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} maxLength={30} /></View>
            <View style={{ flex: 1 }}><Field label="Instagram" autoCapitalize="none" value={f.instagram} onChangeText={(v) => setF({ ...f, instagram: v })} maxLength={60} placeholder="@" /></View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="E-mail" autoCapitalize="none" keyboardType="email-address" value={f.email} onChangeText={(v) => setF({ ...f, email: v })} maxLength={120} /></View>
            <View style={{ flex: 1 }}><Field label="Cidade" value={f.city} onChangeText={(v) => setF({ ...f, city: v })} maxLength={80} placeholder="Brasília - DF" /></View>
          </View>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <T variant="small" style={{ flex: 1 }}>Mostrar contatos e referências no link compartilhado (no PDF que vocês baixam, aparecem sempre)</T>
            <Switch accessibilityLabel="Mostrar contatos no link" value={f.show} onValueChange={(v) => setF({ ...f, show: v })} />
          </View>
          <T variant="subtitle">Referências (até 4)</T>
          {refs.map((r, i) => (
            <View key={i} style={{ gap: 6 }}>
              <View style={styles.row}>
                <View style={{ flex: 2 }}><Field label="Nome" value={r.name} onChangeText={(v) => setRefs(refs.map((x, j) => (j === i ? { ...x, name: v } : x)))} maxLength={80} /></View>
                <View style={{ flex: 1 }}><Field label="Função" value={r.role ?? ''} onChangeText={(v) => setRefs(refs.map((x, j) => (j === i ? { ...x, role: v } : x)))} maxLength={40} placeholder="Treinador" /></View>
              </View>
              <View style={styles.row}>
                <View style={{ flex: 2 }}><Field label="Telefone" value={r.phone ?? ''} onChangeText={(v) => setRefs(refs.map((x, j) => (j === i ? { ...x, phone: v } : x)))} maxLength={30} /></View>
                <View style={{ flex: 1, justifyContent: 'flex-end' }}><Button title="Tirar" kind="ghost" onPress={() => setRefs(refs.filter((_, j) => j !== i))} /></View>
              </View>
            </View>
          ))}
          {refs.length < 4 && <Button title="+ Referência" kind="ghost" onPress={() => setRefs([...refs, { name: '', role: 'Treinador', phone: '' }])} />}
          <Button title={busy ? 'Salvando...' : 'Salvar'} kind="accent" disabled={busy} onPress={save} />
        </View>
      )}
      <T variant="subtitle">Fotos ({galleryUrls.length}/6)</T>
      <View style={styles.wrap}>
        {galleryUrls.map((u, i) => (
          <View key={u} style={{ gap: 4 }}>
            <Image source={{ uri: u }} style={{ width: 96, height: 72, borderRadius: 8 }} accessibilityLabel={`Foto ${i + 1}`} />
            <Button title="Tirar" kind="ghost" onPress={() => removeGallery(i)} />
          </View>
        ))}
      </View>
      {galleryUrls.length < 6 && <Button title="+ Foto na galeria" kind="outline" onPress={addGallery} />}
    </Card>
  );
}
