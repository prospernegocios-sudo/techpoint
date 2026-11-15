// PDF do currículo esportivo (site): abre a impressão do navegador ("Salvar como PDF").
import { cvHtml, cvImageUrls, type Cv } from './cv';

export async function exportCvPdf(cv: Cv) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(cvHtml(cv, await cvImageUrls(cv)).replace('<head>', `<head><title>curriculo_${cv.full_name}</title><style>@page { size: A4 portrait; margin: 10mm; }</style>`));
  doc.close();
  await Promise.all(Array.from(doc.images).map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
  setTimeout(() => frame.remove(), 60_000);
}
