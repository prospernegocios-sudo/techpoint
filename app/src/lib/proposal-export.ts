// Celular: gera o Word do Projeto Técnico ou a planilha do orçamento e abre o compartilhar.
import { Packer } from 'docx';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { buildBudgetCsv, buildProposalDoc, proposalFileName, type ProposalDocCtx } from './proposal-doc';

function saveTemp(name: string) {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  return f;
}
export async function exportProposalDoc(c: ProposalDocCtx) {
  const f = saveTemp(proposalFileName(c.p, 'docx'));
  f.write(await Packer.toBase64String(buildProposalDoc(c)), { encoding: 'base64' });
  await Sharing.shareAsync(f.uri, { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', dialogTitle: 'Projeto Técnico' });
}
export async function exportBudgetCsv(c: ProposalDocCtx) {
  const f = saveTemp(proposalFileName(c.p, 'csv').replace('Projeto-Tecnico', 'Orcamento'));
  f.write(buildBudgetCsv(c));
  await Sharing.shareAsync(f.uri, { mimeType: 'text/csv', dialogTitle: 'Planilha do orçamento' });
}
