// Site: baixa o Word do Projeto Técnico ou a planilha do orçamento.
import { Packer } from 'docx';
import { buildBudgetCsv, buildProposalDoc, proposalFileName, type ProposalDocCtx } from './proposal-doc';

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export async function exportProposalDoc(c: ProposalDocCtx) {
  download(await Packer.toBlob(buildProposalDoc(c)), proposalFileName(c.p, 'docx'));
}
export async function exportBudgetCsv(c: ProposalDocCtx) {
  download(new Blob([buildBudgetCsv(c)], { type: 'text/csv;charset=utf-8' }), proposalFileName(c.p, 'csv').replace('Projeto-Tecnico', 'Orcamento'));
}
