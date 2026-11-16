// Site: gera o Word e baixa direto.
import { Packer } from 'docx';
import { buildDeclarationsDoc, declarationsFileName, type Annex, type DeclCtx } from './declarations';

export async function exportDeclarations(annexes: Annex[], ctx: DeclCtx) {
  const blob = await Packer.toBlob(buildDeclarationsDoc(annexes, ctx));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = declarationsFileName(annexes, ctx.org.name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
