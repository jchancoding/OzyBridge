import { findFiioModel } from './fiio/models';
import { KTMICRO_MODELS } from './ktmicro/models';
import { WALKPLAY_MODELS } from './walkplay/models';

export function matchFamily(
  vendorId: number,
  productId: number,
  productName?: string,
): 'fiio' | 'walkplay' | 'ktmicro' | null {
  if (findFiioModel(vendorId, productId, productName)) return 'fiio';
  if (WALKPLAY_MODELS.some((m) => m.vendorId === vendorId && m.productId === productId)) return 'walkplay';
  if (KTMICRO_MODELS.some((m) => m.vendorId === vendorId && m.productId === productId)) return 'ktmicro';
  return null;
}
