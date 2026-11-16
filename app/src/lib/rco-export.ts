// Celular: gera o RCO em Word e abre o compartilhar.
import { Packer } from 'docx';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { buildRcoDoc, rcoFileName, type RcoCtx } from './rco-doc';

export async function exportRco(c: RcoCtx) {
  const f = new File(Paths.cache, rcoFileName(c.project));
  if (f.exists) f.delete();
  f.create();
  f.write(await Packer.toBase64String(buildRcoDoc(c)), { encoding: 'base64' });
  await Sharing.shareAsync(f.uri, { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', dialogTitle: 'RCO' });
}
