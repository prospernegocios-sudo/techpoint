// Site: baixa o RCO em Word.
import { Packer } from 'docx';
import { buildRcoDoc, rcoFileName, type RcoCtx } from './rco-doc';

export async function exportRco(c: RcoCtx) {
  const url = URL.createObjectURL(await Packer.toBlob(buildRcoDoc(c)));
  const a = document.createElement('a');
  a.href = url; a.download = rcoFileName(c.project);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
