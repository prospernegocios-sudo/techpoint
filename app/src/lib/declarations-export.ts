// Celular: gera o Word e abre o compartilhar (salvar, WhatsApp, e-mail...).
import { Packer } from 'docx';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { buildDeclarationsDoc, declarationsFileName, type Annex, type DeclCtx } from './declarations';

export async function exportDeclarations(annexes: Annex[], ctx: DeclCtx) {
  const b64 = await Packer.toBase64String(buildDeclarationsDoc(annexes, ctx));
  const file = new File(Paths.cache, declarationsFileName(annexes, ctx.org.name));
  if (file.exists) file.delete();
  file.create();
  file.write(b64, { encoding: 'base64' });
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    dialogTitle: 'Declarações em Word',
  });
}
