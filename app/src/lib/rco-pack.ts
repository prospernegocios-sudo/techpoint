// Celular: o pacote ZIP com todos os anexos é montado no site (o navegador do computador lida melhor com muitos arquivos).
import type { RcoCtx } from './rco-doc';
import type { CobStatus, Media, PointRow } from './staff';

export type PackInput = {
  rco: RcoCtx; points: { rows: PointRow[]; from: string; to: string; orgName: string };
  media: Media[]; cob: { athletes: CobStatus[]; staff: CobStatus[] };
};
export async function downloadRcoPack(_p: PackInput, _onProgress?: (t: string) => void): Promise<number> {
  throw new Error('O pacote ZIP é gerado no site (techpoint.expo.app), pelo computador.');
}
