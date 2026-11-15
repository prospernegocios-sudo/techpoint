// PDF do currículo esportivo (celular): gera e abre o compartilhar.
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { cvHtml, type Cv } from './cv';

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').slice(0, 40);

export async function exportCvPdf(cv: Cv) {
  const { uri } = await Print.printToFileAsync({ html: cvHtml(cv), width: 595, height: 842, margins: { left: 28, right: 28, top: 28, bottom: 28 } });
  const target = new File(Paths.cache, `curriculo_${slug(cv.full_name)}.pdf`);
  try { if (target.exists) target.delete(); } catch { /* ignora */ }
  new File(uri).move(target);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Compartilhamento indisponível neste celular.');
  await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Enviar currículo' });
}
